const pool = require('../config/db');

const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before;

    // Verify membership
    const { rows: access } = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id=$1 AND user_id=$2',
      [chatId, req.user.id]
    );
    if (!access.length) return res.status(403).json({ error: 'Access denied' });

    const query = before
      ? `SELECT m.*, u.name, u.username, u.avatar FROM messages m
         JOIN users u ON u.id=m.sender_id
         WHERE m.chat_id=$1 AND m.created_at < $2
         ORDER BY m.created_at DESC LIMIT $3`
      : `SELECT m.*, u.name, u.username, u.avatar FROM messages m
         JOIN users u ON u.id=m.sender_id
         WHERE m.chat_id=$1
         ORDER BY m.created_at DESC LIMIT $2`;

    const params = before ? [chatId, before, limit] : [chatId, limit];
    const { rows } = await pool.query(query, params);

    res.json({ messages: rows.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, message_type, file_url, file_name, reply_to } = req.body;

    if (!content?.trim() && !file_url) {
      return res.status(400).json({ error: 'Message content or file required' });
    }

    const { rows: access } = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id=$1 AND user_id=$2',
      [chatId, req.user.id]
    );
    if (!access.length) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await pool.query(
      `INSERT INTO messages (chat_id, sender_id, content, message_type, file_url, file_name, reply_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [chatId, req.user.id, content?.trim() || null, message_type || 'text', file_url || null, file_name || null, reply_to || null]
    );

    await pool.query(
      'UPDATE chats SET last_message=$1, last_message_at=NOW(), updated_at=NOW() WHERE id=$2',
      [content?.slice(0, 100) || 'File', chatId]
    );

    const message = {
      ...rows[0],
      name: req.user.name,
      username: req.user.username,
      avatar: req.user.avatar,
    };

    const io = req.app.get('io');
    if (io) io.to(`chat:${chatId}`).emit('new_message', message);

    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getMessages, sendMessage };
