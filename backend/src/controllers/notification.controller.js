const pool = require('../config/db');

const getNotifications = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, u.name AS actor_name, u.username AS actor_username, u.avatar AS actor_avatar,
              p.content AS post_content
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       LEFT JOIN posts p ON p.id = n.post_id
       WHERE n.user_id=$1
       ORDER BY n.created_at DESC LIMIT 30`,
      [req.user.id]
    );
    res.json({ notifications: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND NOT is_read',
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const markAllRead = async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND NOT is_read', [req.user.id]);
    res.json({ read: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getNotifications, getUnreadCount, markAllRead };
