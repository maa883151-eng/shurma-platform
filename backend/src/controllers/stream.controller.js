const pool = require('../config/db');
const { createTipCheckout } = require('../services/stripe.service');

const getStreams = async (req, res) => {
  try {
    const { status = 'live' } = req.query;
    const { rows } = await pool.query(
      `SELECT s.*, u.name, u.username, u.avatar, u.is_verified FROM streams s
       JOIN users u ON u.id=s.user_id
       WHERE s.status=$1 ORDER BY s.viewer_count DESC, s.started_at DESC LIMIT 30`,
      [status]
    );
    res.json({ streams: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createStream = async (req, res) => {
  try {
    const { title, description, category, thumbnail_url } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const { rows } = await pool.query(
      `INSERT INTO streams (user_id, title, description, category, thumbnail_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, title, description || null, category || 'General', thumbnail_url || null]
    );
    res.status(201).json({ stream: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getStream = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.name, u.username, u.avatar, u.is_verified FROM streams s
       JOIN users u ON u.id=s.user_id WHERE s.id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Stream not found' });
    res.json({ stream: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const startStream = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE streams SET status='live', started_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Stream not found or not your stream' });

    await pool.query('UPDATE users SET is_streamer=TRUE WHERE id=$1', [req.user.id]);

    const io = req.app.get('io');
    if (io) io.emit('stream_started', rows[0]);

    res.json({ stream: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const endStream = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE streams SET status='ended', ended_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Stream not found' });

    const io = req.app.get('io');
    if (io) io.to(`stream:${req.params.id}`).emit('stream_ended', { streamId: req.params.id });

    res.json({ stream: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addStreamComment = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const { rows } = await pool.query(
      `INSERT INTO stream_comments (stream_id, user_id, message) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, req.user.id, message.trim()]
    );

    const comment = { ...rows[0], name: req.user.name, username: req.user.username, avatar: req.user.avatar };
    const io = req.app.get('io');
    if (io) io.to(`stream:${req.params.id}`).emit('stream_comment', comment);

    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const tipStreamer = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 0.5) return res.status(400).json({ error: 'Minimum tip is $0.50' });

    const { rows: stream } = await pool.query('SELECT * FROM streams WHERE id=$1', [req.params.id]);
    if (!stream[0]) return res.status(404).json({ error: 'Stream not found' });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const session = await createTipCheckout({
      amount,
      streamId: req.params.id,
      toUserId: stream[0].user_id,
      fromUserId: req.user.id,
      successUrl: `${clientUrl}/streams/${req.params.id}?tip=success`,
      cancelUrl: `${clientUrl}/streams/${req.params.id}`,
    });

    if (!session) return res.status(503).json({ error: 'Payments not configured' });

    await pool.query(
      `INSERT INTO stream_tips (stream_id, from_user_id, to_user_id, amount, stripe_session_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, req.user.id, stream[0].user_id, amount, session.id]
    );

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getStreamProducts = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stream_products WHERE stream_id=$1 ORDER BY is_showcasing DESC, created_at DESC',
      [req.params.id]
    );
    res.json({ products: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getStreams, createStream, getStream, startStream, endStream, addStreamComment, tipStreamer, getStreamProducts };
