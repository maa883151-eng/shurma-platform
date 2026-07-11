const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
const pool = require('../src/config/db');

jest.mock('../src/services/claude.service', () => ({
  moderateContent: jest.fn(),
  rankFeed: jest.fn(),
}));
const { moderateContent } = require('../src/services/claude.service');

const guardRoutes = require('../src/routes/guard.routes');

const app = express();
app.use(express.json());
app.use('/api/guard', guardRoutes);

const regularUser = { id: 'user-1', username: 'ahmed', role: 'user' };
const adminUser = { id: 'admin-1', username: 'admin', role: 'admin' };

function tokenFor(user) {
  return `Bearer ${jwt.sign({ userId: user.id }, process.env.JWT_SECRET)}`;
}

// First pool.query call in every authed request is the middleware's user lookup.
function primeAuth(user) {
  pool.query.mockResolvedValueOnce({ rows: [user] });
}

describe('POST /api/guard/check', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/guard/check').send({ content: 'hi' });
    expect(res.status).toBe(401);
    expect(moderateContent).not.toHaveBeenCalled();
  });

  it('rejects requests without content', async () => {
    primeAuth(regularUser);
    const res = await request(app)
      .post('/api/guard/check')
      .set('Authorization', tokenFor(regularUser))
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns the moderation verdict and writes an audit log', async () => {
    primeAuth(regularUser);
    moderateContent.mockResolvedValueOnce({
      verdict: 'flagged',
      score: 0.72,
      categories: { spam: true },
      reason: 'looks like spam',
    });
    pool.query.mockResolvedValueOnce({ rows: [] }); // guard_logs insert

    const res = await request(app)
      .post('/api/guard/check')
      .set('Authorization', tokenFor(regularUser))
      .send({ content: 'BUY NOW!!! CLICK HERE', content_type: 'text', source: 'post' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('flagged');

    const [logSql, logParams] = pool.query.mock.calls[1];
    expect(logSql).toMatch(/INSERT INTO guard_logs/);
    expect(logParams[0]).toBe(regularUser.id);
    expect(logParams[4]).toBe('flagged');
  });

  it('truncates stored content to 2000 characters in the audit log', async () => {
    primeAuth(regularUser);
    moderateContent.mockResolvedValueOnce({ verdict: 'safe', score: 0, categories: {}, reason: 'ok' });
    pool.query.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .post('/api/guard/check')
      .set('Authorization', tokenFor(regularUser))
      .send({ content: 'y'.repeat(6000) });

    const storedContent = pool.query.mock.calls[1][1][1];
    expect(storedContent).toHaveLength(2000);
  });
});

describe('GET /api/guard/logs (admin only)', () => {
  it('blocks regular users with 403', async () => {
    primeAuth(regularUser);
    const res = await request(app)
      .get('/api/guard/logs')
      .set('Authorization', tokenFor(regularUser));
    expect(res.status).toBe(403);
  });

  it('returns logs for admins, filtered by verdict', async () => {
    primeAuth(adminUser);
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'log-1', verdict: 'blocked' }] });

    const res = await request(app)
      .get('/api/guard/logs?verdict=blocked')
      .set('Authorization', tokenFor(adminUser));

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(1);
    const [sql, params] = pool.query.mock.calls[1];
    expect(sql).toMatch(/WHERE verdict=\$3/);
    expect(params[2]).toBe('blocked');
  });
});
