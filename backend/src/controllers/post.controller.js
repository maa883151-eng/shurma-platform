const pool = require('../config/db');
const { moderateContent } = require('../services/claude.service');

const createPost = async (req, res) => {
  try {
    const { content, image_url, hashtags } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

    const mod = await moderateContent(content);
    if (mod.verdict === 'blocked') {
      return res.status(422).json({ error: 'Content violates community guidelines', reason: mod.reason });
    }

    const { rows } = await pool.query(
      `INSERT INTO posts (user_id, content, image_url, hashtags) VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [req.user.id, content.trim(), image_url || null, hashtags || null]
    );
    await pool.query('UPDATE users SET posts_count=posts_count+1 WHERE id=$1', [req.user.id]);

    const post = { ...rows[0], author: { id: req.user.id, name: req.user.name, username: req.user.username, avatar: req.user.avatar } };

    const io = req.app.get('io');
    if (io) io.emit('new_post', post);

    res.status(201).json({ post });
  } catch (err) {
    console.error('createPost:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getPost = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.name, u.username, u.avatar, u.is_verified FROM posts p
       JOIN users u ON u.id = p.user_id WHERE p.id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.name, u.username, u.avatar, u.is_verified FROM posts p
       JOIN users u ON u.id = p.user_id WHERE p.user_id=$1 ORDER BY p.created_at DESC LIMIT 20`,
      [req.params.id]
    );
    res.json({ posts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT user_id FROM posts WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM posts WHERE id=$1', [req.params.id]);
    await pool.query('UPDATE users SET posts_count=GREATEST(posts_count-1,0) WHERE id=$1', [req.user.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const likePost = async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.id]
    );
    await pool.query('UPDATE posts SET likes_count=likes_count+1 WHERE id=$1', [req.params.id]);
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const unlikePost = async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM likes WHERE user_id=$1 AND post_id=$2', [req.user.id, req.params.id]);
    if (r.rowCount > 0) {
      await pool.query('UPDATE posts SET likes_count=GREATEST(likes_count-1,0) WHERE id=$1', [req.params.id]);
    }
    res.json({ liked: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getComments = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.name, u.username, u.avatar FROM comments c
       JOIN users u ON u.id = c.user_id WHERE c.post_id=$1 ORDER BY c.created_at ASC LIMIT 50`,
      [req.params.id]
    );
    res.json({ comments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

    const { rows } = await pool.query(
      `INSERT INTO comments (user_id, post_id, content) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, req.params.id, content.trim()]
    );
    await pool.query('UPDATE posts SET comments_count=comments_count+1 WHERE id=$1', [req.params.id]);

    const comment = { ...rows[0], name: req.user.name, username: req.user.username, avatar: req.user.avatar };
    const io = req.app.get('io');
    if (io) io.to(`post:${req.params.id}`).emit('new_comment', comment);

    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createPost, getPost, getUserPosts, deletePost, likePost, unlikePost, getComments, addComment };
