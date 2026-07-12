const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
const pool = require('../src/config/db');

const chatRoutes = require('../src/routes/chat.routes');

const user = { id: 'user-1', username: 'ahmed', role: 'user' };
const token = `Bearer ${jwt.sign({ userId: user.id }, process.env.JWT_SECRET)}`;

const ioEmit = jest.fn();
const io = { to: jest.fn(() => ({ emit: ioEmit })) };

const app = express();
app.set('io', io);
app.use(express.json());
app.use('/api/chats', chatRoutes);

function primeAuth() {
  pool.query.mockResolvedValueOnce({ rows: [user] });
}

describe('POST /api/chats/:id/read', () => {
  it('denies non-participants', async () => {
    primeAuth();
    pool.query.mockResolvedValueOnce({ rows: [] }); // participant check
    const res = await request(app)
      .post('/api/chats/chat-9/read')
      .set('Authorization', token);
    expect(res.status).toBe(403);
  });

  it('marks unread messages read and notifies the chat room', async () => {
    primeAuth();
    pool.query
      .mockResolvedValueOnce({ rows: [{ 1: 1 }] }) // participant check
      .mockResolvedValueOnce({ rowCount: 3 }); // insert into message_reads

    const res = await request(app)
      .post('/api/chats/chat-1/read')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.read).toBe(3);

    const [insertSql, insertParams] = pool.query.mock.calls[2];
    expect(insertSql).toMatch(/INSERT INTO message_reads/);
    expect(insertSql).toMatch(/sender_id <> \$2/); // own messages never marked
    expect(insertSql).toMatch(/ON CONFLICT \(message_id, user_id\) DO NOTHING/); // idempotent
    expect(insertParams).toEqual(['chat-1', user.id]);

    expect(io.to).toHaveBeenCalledWith('chat:chat-1');
    expect(ioEmit).toHaveBeenCalledWith('messages_read', { chatId: 'chat-1', userId: user.id });
  });

  it('does not broadcast when nothing was newly read', async () => {
    primeAuth();
    pool.query
      .mockResolvedValueOnce({ rows: [{ 1: 1 }] })
      .mockResolvedValueOnce({ rowCount: 0 });

    const res = await request(app)
      .post('/api/chats/chat-1/read')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.read).toBe(0);
    expect(ioEmit).not.toHaveBeenCalled();
  });
});

describe('GET /api/chats unread counts', () => {
  it('returns per-chat unread_count scoped to messages from others', async () => {
    primeAuth();
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { id: 'chat-1', is_group: false, unread_count: '4' },
          { id: 'chat-2', is_group: true, unread_count: '0' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // participants chat-1
      .mockResolvedValueOnce({ rows: [] }); // participants chat-2

    const res = await request(app).get('/api/chats').set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.chats[0].unread_count).toBe('4');

    const [listSql] = pool.query.mock.calls[1];
    expect(listSql).toMatch(/unread_count/);
    expect(listSql).toMatch(/m\.sender_id <> \$1/);
    expect(listSql).toMatch(/NOT EXISTS \(SELECT 1 FROM message_reads/);
  });
});
