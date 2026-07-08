const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function setupSockets(io) {
  // JWT auth handshake
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await pool.query('SELECT id, name, username, avatar FROM users WHERE id=$1', [decoded.userId]);
      if (!rows[0]) return next(new Error('User not found'));
      socket.user = rows[0];
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    console.log(`Socket connected: ${socket.user.username} (${socket.id})`);

    // Mark online
    socket.join(userId);
    await pool.query('UPDATE users SET is_online=TRUE, last_seen=NOW() WHERE id=$1', [userId]);
    socket.broadcast.emit('user_online', { userId });

    // ── Chat rooms ──
    socket.on('join_chat', (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on('typing', ({ chatId, isTyping }) => {
      socket.to(`chat:${chatId}`).emit('user_typing', {
        userId,
        name: socket.user.name,
        isTyping,
      });
    });

    // ── Stream rooms ──
    socket.on('join_stream', async (streamId) => {
      socket.join(`stream:${streamId}`);
      await pool.query(
        'UPDATE streams SET viewer_count=viewer_count+1, peak_viewers=GREATEST(peak_viewers, viewer_count+1) WHERE id=$1 AND status=$2',
        [streamId, 'live']
      );
      const { rows } = await pool.query('SELECT viewer_count FROM streams WHERE id=$1', [streamId]);
      if (rows[0]) io.to(`stream:${streamId}`).emit('viewer_count', { streamId, count: rows[0].viewer_count });
    });

    socket.on('leave_stream', async (streamId) => {
      socket.leave(`stream:${streamId}`);
      await pool.query(
        'UPDATE streams SET viewer_count=GREATEST(viewer_count-1,0) WHERE id=$1 AND status=$2',
        [streamId, 'live']
      );
      const { rows } = await pool.query('SELECT viewer_count FROM streams WHERE id=$1', [streamId]);
      if (rows[0]) io.to(`stream:${streamId}`).emit('viewer_count', { streamId, count: rows[0].viewer_count });
    });

    // ── Disconnect ──
    socket.on('disconnect', async () => {
      await pool.query('UPDATE users SET is_online=FALSE, last_seen=NOW() WHERE id=$1', [userId]);
      socket.broadcast.emit('user_offline', { userId });
      console.log(`Socket disconnected: ${socket.user.username}`);
    });
  });
}

module.exports = setupSockets;
