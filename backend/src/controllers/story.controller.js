const pool = require('../config/db');
const { moderateContent } = require('../services/claude.service');

const createStory = async (req, res) => {
  try {
    const { content, image_url, bg_color } = req.body;
    if (!content?.trim() && !image_url) {
      return res.status(400).json({ error: 'A story needs text or an image' });
    }

    if (content?.trim()) {
      const mod = await moderateContent(content);
      if (mod.verdict === 'blocked') {
        return res.status(422).json({ error: 'Content violates community guidelines', reason: mod.reason });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO stories (user_id, content, image_url, bg_color) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, content?.trim() || null, image_url || null, bg_color || '#7c3aed']
    );

    const story = { ...rows[0], name: req.user.name, username: req.user.username, avatar: req.user.avatar };

    const io = req.app.get('io');
    if (io) io.emit('new_story', story);

    res.status(201).json({ story });
  } catch (err) {
    console.error('createStory:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Active (non-expired) stories from self + followed users, grouped by author
const getStories = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.name, u.username, u.avatar,
              EXISTS(SELECT 1 FROM story_views v WHERE v.story_id=s.id AND v.user_id=$1) AS is_viewed
       FROM stories s JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW()
         AND (s.user_id = $1 OR s.user_id IN (SELECT following_id FROM follows WHERE follower_id=$1))
       ORDER BY s.created_at ASC`,
      [req.user.id]
    );

    const byUser = new Map();
    for (const s of rows) {
      if (!byUser.has(s.user_id)) {
        byUser.set(s.user_id, {
          user: { id: s.user_id, name: s.name, username: s.username, avatar: s.avatar },
          stories: [],
          all_viewed: true,
        });
      }
      const group = byUser.get(s.user_id);
      group.stories.push(s);
      if (!s.is_viewed) group.all_viewed = false;
    }

    // Own stories first, then unviewed groups, then the rest
    const groups = [...byUser.values()].sort((a, b) => {
      if (a.user.id === req.user.id) return -1;
      if (b.user.id === req.user.id) return 1;
      return (a.all_viewed ? 1 : 0) - (b.all_viewed ? 1 : 0);
    });

    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const viewStory = async (req, res) => {
  try {
    const r = await pool.query(
      'INSERT INTO story_views (story_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, req.user.id]
    );
    if (r.rowCount > 0) {
      await pool.query('UPDATE stories SET views_count=views_count+1 WHERE id=$1', [req.params.id]);
    }
    res.json({ viewed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Who viewed my story (owner only)
const getStoryViews = async (req, res) => {
  try {
    const { rows: own } = await pool.query('SELECT user_id FROM stories WHERE id=$1', [req.params.id]);
    if (!own[0]) return res.status(404).json({ error: 'Story not found' });
    if (own[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.username, u.avatar, v.created_at AS viewed_at
       FROM story_views v JOIN users u ON u.id = v.user_id
       WHERE v.story_id=$1 ORDER BY v.created_at DESC`,
      [req.params.id]
    );
    res.json({ views: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteStory = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT user_id FROM stories WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Story not found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM stories WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createStory, getStories, viewStory, getStoryViews, deleteStory };
