const pool = require('../config/db');

const MSG_FIELDS = (userIdParam) => `
  m.*, u.name, u.username, u.avatar,
  COALESCE((SELECT json_object_agg(r.reaction, r.cnt) FROM (
    SELECT reaction, COUNT(*) AS cnt FROM message_reactions WHERE message_id=m.id GROUP BY reaction
  ) r), '{}'::json) AS reactions,
  (SELECT reaction FROM message_reactions WHERE message_id=m.id AND user_id=${userIdParam}) AS my_reaction,
  (SELECT row_to_json(rpl) FROM (
    SELECT rm.id, rm.content, rm.message_type, rm.file_url, ru.name AS sender_name
    FROM messages rm JOIN users ru ON ru.id=rm.sender_id WHERE rm.id=m.reply_to
  ) rpl) AS reply_message
`;

const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before;

    const { rows: access } = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id=$1 AND user_id=$2',
      [chatId, req.user.id]
    );
    if (!access.length) return res.status(403).json({ error: 'Access denied' });

    let query, params;
    if (before) {
      query = `SELECT ${MSG_FIELDS('$4')} FROM messages m JOIN users u ON u.id=m.sender_id
               WHERE m.chat_id=$1 AND m.created_at < $2 ORDER BY m.created_at DESC LIMIT $3`;
      params = [chatId, before, limit, req.user.id];
    } else {
      query = `SELECT ${MSG_FIELDS('$3')} FROM messages m JOIN users u ON u.id=m.sender_id
               WHERE m.chat_id=$1 ORDER BY m.created_at DESC LIMIT $2`;
      params = [chatId, limit, req.user.id];
    }

    const { rows } = await pool.query(query, params);
    res.json({ messages: rows.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, message_type, file_url, file_name, reply_to, forwarded_from } = req.body;

    if (!content?.trim() && !file_url) {
      return res.status(400).json({ error: 'Message content or file required' });
    }

    const { rows: access } = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id=$1 AND user_id=$2',
      [chatId, req.user.id]
    );
    if (!access.length) return res.status(403).json({ error: 'Access denied' });

    // If forwarding, fetch original sender name
    let fwdSenderName = null;
    if (forwarded_from) {
      const { rows: orig } = await pool.query(
        'SELECT u.name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=$1',
        [forwarded_from]
      );
      fwdSenderName = orig[0]?.name || null;
    }

    const { rows } = await pool.query(
      `INSERT INTO messages (chat_id, sender_id, content, message_type, file_url, file_name, reply_to, forwarded_from, forwarded_sender_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [chatId, req.user.id, content?.trim() || null, message_type || 'text',
       file_url || null, file_name || null, reply_to || null,
       forwarded_from || null, fwdSenderName]
    );

    await pool.query(
      'UPDATE chats SET last_message=$1, last_message_at=NOW(), updated_at=NOW() WHERE id=$2',
      [content?.slice(0, 100) || '📎 File', chatId]
    );

    const message = {
      ...rows[0],
      name: req.user.name,
      username: req.user.username,
      avatar: req.user.avatar,
      reactions: {},
      my_reaction: null,
    };

    const io = req.app.get('io');
    if (io) io.to(`chat:${chatId}`).emit('new_message', message);

    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const reactToMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { reaction } = req.body;
    if (!reaction) return res.status(400).json({ error: 'reaction required' });

    const { rows: access } = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id=$1 AND user_id=$2',
      [chatId, req.user.id]
    );
    if (!access.length) return res.status(403).json({ error: 'Access denied' });

    await pool.query(
      `INSERT INTO message_reactions (message_id, user_id, reaction) VALUES ($1,$2,$3)
       ON CONFLICT (message_id, user_id) DO UPDATE SET reaction=EXCLUDED.reaction`,
      [messageId, req.user.id, reaction]
    );

    const { rows: agg } = await pool.query(
      `SELECT reaction, COUNT(*) AS cnt FROM message_reactions WHERE message_id=$1 GROUP BY reaction`,
      [messageId]
    );
    const reactions = Object.fromEntries(agg.map((r) => [r.reaction, parseInt(r.cnt)]));

    const io = req.app.get('io');
    if (io) io.to(`chat:${chatId}`).emit('message_reaction', { messageId, reactions, actorId: req.user.id, reaction });

    res.json({ reactions, my_reaction: reaction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const removeReaction = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    await pool.query('DELETE FROM message_reactions WHERE message_id=$1 AND user_id=$2', [messageId, req.user.id]);

    const { rows: agg } = await pool.query(
      'SELECT reaction, COUNT(*) AS cnt FROM message_reactions WHERE message_id=$1 GROUP BY reaction',
      [messageId]
    );
    const reactions = Object.fromEntries(agg.map((r) => [r.reaction, parseInt(r.cnt)]));

    const io = req.app.get('io');
    if (io) io.to(`chat:${chatId}`).emit('message_reaction', { messageId, reactions, actorId: req.user.id, reaction: null });

    res.json({ reactions, my_reaction: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { rows } = await pool.query('SELECT sender_id FROM messages WHERE id=$1 AND chat_id=$2', [messageId, chatId]);
    if (!rows[0]) return res.status(404).json({ error: 'Message not found' });
    if (rows[0].sender_id !== req.user.id) return res.status(403).json({ error: 'Not your message' });
    await pool.query('DELETE FROM messages WHERE id=$1', [messageId]);
    const io = req.app.get('io');
    if (io) io.to(`chat:${chatId}`).emit('message_deleted', { messageId, chatId });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getMessages, sendMessage, reactToMessage, removeReaction, deleteMessage };
