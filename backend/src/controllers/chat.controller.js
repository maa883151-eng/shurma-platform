const pool = require('../config/db');

const getChats = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, cp.is_admin,
              (SELECT COUNT(*) FROM messages m WHERE m.chat_id=c.id) AS message_count,
              (SELECT COUNT(*) FROM messages m
                WHERE m.chat_id=c.id AND m.sender_id <> $1
                  AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id=m.id AND mr.user_id=$1)
              ) AS unread_count
       FROM chats c
       JOIN chat_participants cp ON cp.chat_id=c.id AND cp.user_id=$1
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`,
      [req.user.id]
    );
    // attach participants to each chat
    for (const chat of rows) {
      const { rows: participants } = await pool.query(
        `SELECT u.id, u.name, u.username, u.avatar, u.is_online, cp.is_admin
         FROM chat_participants cp JOIN users u ON u.id=cp.user_id
         WHERE cp.chat_id=$1`,
        [chat.id]
      );
      chat.participants = participants;
    }
    res.json({ chats: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createChat = async (req, res) => {
  try {
    const { participantIds, name, is_group } = req.body;
    if (!participantIds?.length) return res.status(400).json({ error: 'participantIds required' });

    const allIds = [...new Set([req.user.id, ...participantIds])];

    // For DMs, check if chat already exists
    if (!is_group && allIds.length === 2) {
      const { rows: existing } = await pool.query(
        `SELECT c.id FROM chats c
         WHERE c.is_group=FALSE
           AND (SELECT COUNT(*) FROM chat_participants WHERE chat_id=c.id)=2
           AND EXISTS(SELECT 1 FROM chat_participants WHERE chat_id=c.id AND user_id=$1)
           AND EXISTS(SELECT 1 FROM chat_participants WHERE chat_id=c.id AND user_id=$2)`,
        [req.user.id, participantIds[0]]
      );
      if (existing[0]) return res.json({ chat: existing[0], existing: true });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO chats (name, is_group, created_by) VALUES ($1,$2,$3) RETURNING *`,
        [name || null, !!is_group, req.user.id]
      );
      const chat = rows[0];
      for (const uid of allIds) {
        await client.query(
          'INSERT INTO chat_participants (chat_id, user_id, is_admin) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [chat.id, uid, uid === req.user.id]
        );
      }
      await client.query('COMMIT');
      res.status(201).json({ chat });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getChat = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT c.* FROM chats c
       JOIN chat_participants cp ON cp.chat_id=c.id AND cp.user_id=$1
       WHERE c.id=$2`,
      [req.user.id, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Chat not found or access denied' });

    const { rows: participants } = await pool.query(
      `SELECT u.id, u.name, u.username, u.avatar, u.is_online, cp.is_admin
       FROM chat_participants cp JOIN users u ON u.id=cp.user_id
       WHERE cp.chat_id=$1`,
      [id]
    );
    res.json({ chat: { ...rows[0], participants } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark every message in a chat (not sent by me) as read; WhatsApp-style
// receipts are derived from message_reads rather than a per-chat cursor so
// group chats can later show per-member read state.
const markChatRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: access } = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    if (!access.length) return res.status(403).json({ error: 'Access denied' });

    const { rowCount } = await pool.query(
      `INSERT INTO message_reads (message_id, user_id)
       SELECT m.id, $2 FROM messages m
       WHERE m.chat_id=$1 AND m.sender_id <> $2
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [id, req.user.id]
    );

    if (rowCount > 0) {
      const io = req.app.get('io');
      if (io) io.to(`chat:${id}`).emit('messages_read', { chatId: id, userId: req.user.id });
    }
    res.json({ read: rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getChats, createChat, getChat, markChatRead };
