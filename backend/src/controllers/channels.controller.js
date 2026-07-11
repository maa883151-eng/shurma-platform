const pool = require('../config/db');

const getChannels = async (req, res) => {
  try {
    const { q, category } = req.query;
    let where = 'WHERE 1=1';
    const params = [req.user.id];
    if (q) { params.push(`%${q}%`); where += ` AND (c.name ILIKE $${params.length} OR c.handle ILIKE $${params.length})`; }
    if (category) { params.push(category); where += ` AND c.category=$${params.length}`; }

    const { rows } = await pool.query(
      `SELECT c.*,
              EXISTS(SELECT 1 FROM channel_subscriptions cs WHERE cs.channel_id=c.id AND cs.user_id=$1) AS is_subscribed,
              u.name AS owner_name, u.username AS owner_username, u.avatar AS owner_avatar
       FROM channels c JOIN users u ON u.id=c.owner_id
       ${where}
       ORDER BY c.subscriber_count DESC`,
      params
    );
    res.json({ channels: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMyChannels = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
              EXISTS(SELECT 1 FROM channel_subscriptions cs WHERE cs.channel_id=c.id AND cs.user_id=$1) AS is_subscribed,
              u.name AS owner_name, u.username AS owner_username, u.avatar AS owner_avatar
       FROM channels c JOIN users u ON u.id=c.owner_id
       JOIN channel_subscriptions cs2 ON cs2.channel_id=c.id AND cs2.user_id=$1
       ORDER BY c.name`,
      [req.user.id]
    );
    res.json({ channels: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createChannel = async (req, res) => {
  try {
    const { name, handle, description, category, avatar, banner } = req.body;
    if (!name?.trim() || !handle?.trim()) return res.status(400).json({ error: 'name and handle required' });
    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO channels (owner_id, name, handle, description, category, avatar, banner)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.user.id, name.trim(), cleanHandle, description || null, category || 'General', avatar || null, banner || null]
      );
      const channel = rows[0];
      // Auto-subscribe owner
      await client.query(
        'INSERT INTO channel_subscriptions (channel_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [channel.id, req.user.id]
      );
      await client.query('UPDATE channels SET subscriber_count=1 WHERE id=$1', [channel.id]);
      await client.query('COMMIT');
      res.status(201).json({ channel: { ...channel, is_subscribed: true, subscriber_count: 1 } });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') return res.status(409).json({ error: 'Handle already taken' });
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT c.*,
              EXISTS(SELECT 1 FROM channel_subscriptions cs WHERE cs.channel_id=c.id AND cs.user_id=$1) AS is_subscribed,
              u.name AS owner_name, u.username AS owner_username, u.avatar AS owner_avatar
       FROM channels c JOIN users u ON u.id=c.owner_id
       WHERE c.id=$2 OR c.handle=$2`,
      [req.user.id, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Channel not found' });
    res.json({ channel: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const subscribe = async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      'INSERT INTO channel_subscriptions (channel_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [id, req.user.id]
    );
    if (rowCount > 0) await pool.query('UPDATE channels SET subscriber_count=subscriber_count+1 WHERE id=$1', [id]);
    res.json({ subscribed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const unsubscribe = async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      'DELETE FROM channel_subscriptions WHERE channel_id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    if (rowCount > 0) await pool.query('UPDATE channels SET subscriber_count=GREATEST(0,subscriber_count-1) WHERE id=$1', [id]);
    res.json({ subscribed: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getChannelPosts = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT cp.*,
              u.name, u.username, u.avatar,
              EXISTS(SELECT 1 FROM channel_post_likes l WHERE l.post_id=cp.id AND l.user_id=$1) AS is_liked
       FROM channel_posts cp JOIN users u ON u.id=cp.user_id
       WHERE cp.channel_id=$2
       ORDER BY cp.is_pinned DESC, cp.created_at DESC`,
      [req.user.id, id]
    );
    // Increment view counts
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      pool.query(`UPDATE channel_posts SET views_count=views_count+1 WHERE id=ANY($1::uuid[])`, [ids]).catch(() => {});
    }
    res.json({ posts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createChannelPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, images, video_url } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    // Check ownership
    const { rows: ch } = await pool.query('SELECT owner_id FROM channels WHERE id=$1', [id]);
    if (!ch[0]) return res.status(404).json({ error: 'Channel not found' });
    if (ch[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Not channel owner' });

    const { rows } = await pool.query(
      `INSERT INTO channel_posts (channel_id, user_id, content, images, video_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, req.user.id, content.trim(), images || null, video_url || null]
    );
    await pool.query('UPDATE channels SET post_count=post_count+1 WHERE id=$1', [id]);

    const io = req.app.get('io');
    if (io) io.to(`channel:${id}`).emit('new_channel_post', rows[0]);

    res.status(201).json({ post: { ...rows[0], name: req.user.name, username: req.user.username, avatar: req.user.avatar, is_liked: false } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const likeChannelPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { rowCount } = await pool.query(
      'INSERT INTO channel_post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [postId, req.user.id]
    );
    if (rowCount > 0) await pool.query('UPDATE channel_posts SET likes_count=likes_count+1 WHERE id=$1', [postId]);
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const unlikeChannelPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { rowCount } = await pool.query(
      'DELETE FROM channel_post_likes WHERE post_id=$1 AND user_id=$2',
      [postId, req.user.id]
    );
    if (rowCount > 0) await pool.query('UPDATE channel_posts SET likes_count=GREATEST(0,likes_count-1) WHERE id=$1', [postId]);
    res.json({ liked: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const pinChannelPost = async (req, res) => {
  try {
    const { id, postId } = req.params;
    const { rows: ch } = await pool.query('SELECT owner_id FROM channels WHERE id=$1', [id]);
    if (!ch[0] || ch[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Not channel owner' });
    await pool.query('UPDATE channel_posts SET is_pinned=FALSE WHERE channel_id=$1', [id]);
    await pool.query('UPDATE channel_posts SET is_pinned=TRUE WHERE id=$1', [postId]);
    res.json({ pinned: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getChannels, getMyChannels, createChannel, getChannel, subscribe, unsubscribe, getChannelPosts, createChannelPost, likeChannelPost, unlikeChannelPost, pinChannelPost };
