const pool = require('../config/db');
const { notify } = require('../utils/notify');

const getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT id, name, username, email, avatar, bio, role, is_verified, is_streamer,
              followers_count, following_count, posts_count, created_at,
              EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$2 AND f.following_id=users.id) AS is_following
       FROM users WHERE id=$1`,
      [id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const { rows } = await pool.query(
      `SELECT id, name, username, avatar, bio, role, is_verified, is_streamer,
              followers_count, following_count, posts_count, created_at
       FROM users WHERE username=$1`,
      [username.toLowerCase()]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, bio, avatar } = req.body;
    const { rows } = await pool.query(
      `UPDATE users SET name=COALESCE($1,name), bio=COALESCE($2,bio), avatar=COALESCE($3,avatar), updated_at=NOW()
       WHERE id=$4 RETURNING id, name, username, email, avatar, bio, role, is_verified, is_streamer`,
      [name, bio, avatar, req.user.id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const follow = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

    const r = await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, id]
    );
    if (r.rowCount > 0) {
      await pool.query('UPDATE users SET followers_count=followers_count+1 WHERE id=$1', [id]);
      await pool.query('UPDATE users SET following_count=following_count+1 WHERE id=$1', [req.user.id]);
      notify(req.app.get('io'), { userId: id, actor: req.user, type: 'follow' });
    }

    const io = req.app.get('io');
    if (io) io.to(id).emit('new_follower', { followerId: req.user.id });

    res.json({ following: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const unfollow = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM follows WHERE follower_id=$1 AND following_id=$2',
      [req.user.id, id]
    );
    if (result.rowCount > 0) {
      await pool.query('UPDATE users SET followers_count=GREATEST(followers_count-1,0) WHERE id=$1', [id]);
      await pool.query('UPDATE users SET following_count=GREATEST(following_count-1,0) WHERE id=$1', [req.user.id]);
    }
    res.json({ following: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getFollowers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.username, u.avatar, u.is_verified FROM follows f
       JOIN users u ON u.id = f.follower_id WHERE f.following_id=$1 ORDER BY f.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ followers: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getFollowing = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.username, u.avatar, u.is_verified FROM follows f
       JOIN users u ON u.id = f.following_id WHERE f.follower_id=$1 ORDER BY f.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ following: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ users: [] });
    const { rows } = await pool.query(
      `SELECT id, name, username, avatar, is_verified FROM users
       WHERE name ILIKE $1 OR username ILIKE $1 LIMIT 20`,
      [`%${q}%`]
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Who to follow: most-followed users the viewer doesn't follow yet
const getSuggestions = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, username, avatar, bio, is_verified, followers_count
       FROM users u
       WHERE u.id != $1
         AND NOT EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.following_id=u.id)
       ORDER BY u.followers_count DESC, u.created_at DESC
       LIMIT 5`,
      [req.user.id]
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getProfile, getProfileByUsername, updateProfile, follow, unfollow, getFollowers, getFollowing, searchUsers, getSuggestions };
