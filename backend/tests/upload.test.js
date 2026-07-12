const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
const pool = require('../src/config/db');

const uploadRoutes = require('../src/routes/upload.routes');

const app = express();
app.use('/api/upload', uploadRoutes);

const user = { id: 'user-1', username: 'ahmed', role: 'user' };
const token = `Bearer ${jwt.sign({ userId: user.id }, process.env.JWT_SECRET)}`;

// tiny valid PNG header buffer — content doesn't matter, multer only inspects metadata
const pngBuffer = Buffer.from('89504e470d0a1a0a', 'hex');

function primeAuth() {
  pool.query.mockResolvedValueOnce({ rows: [user] });
}

function configureStorage() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
}

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete global.fetch?.mockRestore;
});

describe('POST /api/upload', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('file', pngBuffer, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it('returns 503 when storage is not configured', async () => {
    primeAuth();
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', token)
      .attach('file', pngBuffer, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it('rejects requests without a file', async () => {
    configureStorage();
    primeAuth();
    const res = await request(app).post('/api/upload').set('Authorization', token);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it('rejects disallowed file types', async () => {
    configureStorage();
    primeAuth();
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', token)
      .attach('file', Buffer.from('#!/bin/sh'), { filename: 'evil.sh', contentType: 'application/x-sh' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported file type/i);
  });

  it('rejects files over the 5 MB limit', async () => {
    configureStorage();
    primeAuth();
    const big = Buffer.alloc(5 * 1024 * 1024 + 1);
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', token)
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too large/i);
  });

  it('uploads a valid image to storage and returns its public URL', async () => {
    configureStorage();
    primeAuth();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => '{}',
    });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', token)
      .field('folder', 'avatar')
      .attach('file', pngBuffer, { filename: 'me.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(
      /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/uploads\/avatar\/user-1\/[0-9a-f-]+\.png$/
    );

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toContain('/storage/v1/object/uploads/avatar/user-1/');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer service-role-test-key');
    expect(opts.headers['Content-Type']).toBe('image/png');

    fetchSpy.mockRestore();
  });

  it('falls back to the media folder for unknown folder values', async () => {
    configureStorage();
    primeAuth();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => '{}' });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', token)
      .field('folder', '../../etc')
      .attach('file', pngBuffer, { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.url).toContain('/uploads/media/user-1/');
    fetchSpy.mockRestore();
  });

  it('returns 500 when the storage backend rejects the upload', async () => {
    configureStorage();
    primeAuth();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'bucket not found',
    });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', token)
      .attach('file', pngBuffer, { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(500);
    fetchSpy.mockRestore();
  });
});
