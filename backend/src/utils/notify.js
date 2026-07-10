const pool = require('../config/db');

// Create a notification and push it to the recipient's socket room in real time.
// Fire-and-forget: notification failures must never break the triggering action.
async function notify(io, { userId, actor, type, postId = null, commentId = null, meta = {} }) {
  try {
    if (!userId || userId === actor.id) return;
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id, meta)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [userId, actor.id, type, postId, commentId, JSON.stringify(meta)]
    );
    if (io) {
      io.to(userId).emit('notification', {
        ...rows[0],
        actor_name: actor.name,
        actor_username: actor.username,
        actor_avatar: actor.avatar,
      });
    }
  } catch (err) {
    console.error('notify:', err.message);
  }
}

module.exports = { notify };
