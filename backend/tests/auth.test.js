const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
const pool = require('../src/config/db');

const authRoutes = require('../src/routes/auth.routes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

const app = buildApp();

const dbUser = {
  id: 'user-uuid-1',
  name: 'Ahmed',
  username: 'ahmed',
  email: 'ahmed@example.com',
  avatar: null,
  bio: null,
  role: 'user',
  is_verified: false,
  is_streamer: false,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('POST /api/auth/register', () => {
  it('rejects missing fields with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'secret1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', username: 'a', email: 'a@b.com', password: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it('rejects duplicate email or username with 409', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', username: 'ahmed', email: 'ahmed@example.com', password: 'secret1' });
    expect(res.status).toBe(409);
  });

  it('creates a user, hashes the password, and returns a valid JWT', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // uniqueness check
      .mockResolvedValueOnce({ rows: [dbUser] }); // insert

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ahmed', username: 'Ahmed', email: 'Ahmed@Example.com', password: 'secret1' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ id: dbUser.id, username: 'ahmed' });
    expect(res.body.user.password).toBeUndefined();

    // token is signed for the new user
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe(dbUser.id);

    // insert received lowercased identifiers and a bcrypt hash, never the raw password
    const insertParams = pool.query.mock.calls[1][1];
    expect(insertParams[1]).toBe('ahmed');
    expect(insertParams[2]).toBe('ahmed@example.com');
    expect(insertParams[3]).not.toBe('secret1');
    expect(await bcrypt.compare('secret1', insertParams[3])).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  const hashedRow = async () => ({
    ...dbUser,
    password: await bcrypt.hash('secret1', 4),
  });

  it('rejects missing credentials with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for an unknown email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'secret1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns 401 for a wrong password (same message as unknown email)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [await hashedRow()] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ahmed@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('logs in with correct credentials and strips the password hash from the response', async () => {
    pool.query.mockResolvedValueOnce({ rows: [await hashedRow()] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'Ahmed@Example.com', password: 'secret1' });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(dbUser.id);
    expect(res.body.user.password).toBeUndefined();
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET).userId).toBe(dbUser.id);
    // email lookup is lowercased
    expect(pool.query.mock.calls[0][1][0]).toBe('ahmed@example.com');
  });
});

describe('GET /api/auth/me (auth middleware)', () => {
  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No token provided');
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ userId: dbUser.id }, 'attacker-secret');
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const expired = jwt.sign({ userId: dbUser.id }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when the token references a deleted user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const token = jwt.sign({ userId: 'ghost' }, process.env.JWT_SECRET);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('User not found');
  });

  it('returns the current user for a valid token', async () => {
    pool.query.mockResolvedValueOnce({ rows: [dbUser] });
    const token = jwt.sign({ userId: dbUser.id }, process.env.JWT_SECRET);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: dbUser.id, username: 'ahmed' });
  });
});

describe('adminOnly middleware', () => {
  const { adminOnly } = require('../src/middleware/auth');

  it('blocks non-admin users with 403', () => {
    const req = { user: { role: 'user' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes admins through', () => {
    const next = jest.fn();
    adminOnly({ user: { role: 'admin' } }, {}, next);
    expect(next).toHaveBeenCalled();
  });
});
