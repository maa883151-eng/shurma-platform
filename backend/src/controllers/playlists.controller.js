const pool = require('../config/db');

const getPlaylists = async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id;
    const { rows } = await pool.query(
      `SELECT pl.*,
              u.name AS owner_name, u.username AS owner_username, u.avatar AS owner_avatar,
              (SELECT p.image_url FROM playlist_items pi2
               JOIN posts p ON p.id=pi2.post_id
               WHERE pi2.playlist_id=pl.id
               ORDER BY pi2.position LIMIT 1) AS cover_thumb
       FROM playlists pl JOIN users u ON u.id=pl.user_id
       WHERE pl.user_id=$1 ${userId !== req.user.id ? 'AND pl.is_public=TRUE' : ''}
       ORDER BY pl.created_at DESC`,
      [userId]
    );
    res.json({ playlists: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createPlaylist = async (req, res) => {
  try {
    const { name, description, is_public } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { rows } = await pool.query(
      'INSERT INTO playlists (user_id, name, description, is_public) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, name.trim(), description || null, is_public !== false]
    );
    res.status(201).json({ playlist: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT pl.*, u.name AS owner_name, u.username AS owner_username, u.avatar AS owner_avatar
       FROM playlists pl JOIN users u ON u.id=pl.user_id WHERE pl.id=$1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Playlist not found' });
    const pl = rows[0];
    if (!pl.is_public && pl.user_id !== req.user.id) return res.status(403).json({ error: 'Private playlist' });

    const { rows: items } = await pool.query(
      `SELECT pi.*, p.content, p.image_url, p.video_url, p.images, p.likes_count, p.created_at AS post_created_at,
              u2.name, u2.username, u2.avatar
       FROM playlist_items pi
       JOIN posts p ON p.id=pi.post_id
       JOIN users u2 ON u2.id=p.user_id
       WHERE pi.playlist_id=$1
       ORDER BY pi.position`,
      [id]
    );
    res.json({ playlist: pl, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addToPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { post_id } = req.body;

    const { rows: pl } = await pool.query('SELECT user_id FROM playlists WHERE id=$1', [id]);
    if (!pl[0]) return res.status(404).json({ error: 'Playlist not found' });
    if (pl[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { rows: cnt } = await pool.query('SELECT COUNT(*) FROM playlist_items WHERE playlist_id=$1', [id]);
    const pos = parseInt(cnt[0].count);

    const { rowCount } = await pool.query(
      'INSERT INTO playlist_items (playlist_id, post_id, position) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [id, post_id, pos]
    );
    if (rowCount > 0) await pool.query('UPDATE playlists SET item_count=item_count+1 WHERE id=$1', [id]);
    res.json({ added: rowCount > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const removeFromPlaylist = async (req, res) => {
  try {
    const { id, postId } = req.params;
    const { rows: pl } = await pool.query('SELECT user_id FROM playlists WHERE id=$1', [id]);
    if (!pl[0] || pl[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const { rowCount } = await pool.query(
      'DELETE FROM playlist_items WHERE playlist_id=$1 AND post_id=$2',
      [id, postId]
    );
    if (rowCount > 0) await pool.query('UPDATE playlists SET item_count=GREATEST(0,item_count-1) WHERE id=$1', [id]);
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deletePlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: pl } = await pool.query('SELECT user_id FROM playlists WHERE id=$1', [id]);
    if (!pl[0] || pl[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await pool.query('DELETE FROM playlists WHERE id=$1', [id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Watch Later helpers
const addWatchLater = async (req, res) => {
  try {
    const { post_id } = req.body;
    if (!post_id) return res.status(400).json({ error: 'post_id required' });
    const { rowCount } = await pool.query(
      'INSERT INTO watch_later (user_id, post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, post_id]
    );
    res.json({ added: rowCount > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const removeWatchLater = async (req, res) => {
  try {
    const { postId } = req.params;
    await pool.query('DELETE FROM watch_later WHERE user_id=$1 AND post_id=$2', [req.user.id, postId]);
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getWatchLater = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.name, u.username, u.avatar, wl.created_at AS saved_at,
              EXISTS(SELECT 1 FROM likes l WHERE l.user_id=$1 AND l.post_id=p.id) AS is_liked,
              EXISTS(SELECT 1 FROM bookmarks b WHERE b.user_id=$1 AND b.post_id=p.id) AS is_bookmarked,
              TRUE AS in_watch_later
       FROM watch_later wl
       JOIN posts p ON p.id=wl.post_id
       JOIN users u ON u.id=p.user_id
       WHERE wl.user_id=$1
       ORDER BY wl.created_at DESC`,
      [req.user.id]
    );
    res.json({ posts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getPlaylists, createPlaylist, getPlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist, addWatchLater, removeWatchLater, getWatchLater };
