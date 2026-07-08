const pool = require('../config/db');

const getChats = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, cp.is_admin,
              (SELECT COUNT(*) FROM messages m WHERE m.chat_id=c.id) AS message_count
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

module.exports = { getChats, createChat, getChat };
