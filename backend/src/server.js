require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { authLimiter, apiLimiter } = require('./middleware/rateLimit');

const app = express();
app.set('trust proxy', 1); // Render/Vercel proxies — req.protocol honors x-forwarded-proto
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});

app.set('io', io);

// ── Middleware ──
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));

// General rate limiter for the whole /api surface
app.use('/api', apiLimiter);

// Stripe webhook needs raw body — mount BEFORE express.json()
const shopRoutes = require('./routes/shop.routes');
app.use('/api/shop', shopRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ──
// Stricter limiter on top of the general one for auth endpoints (login/register/etc.)
app.use('/api/auth', authLimiter, require('./routes/auth.routes'));
app.use('/api/upload', require('./routes/upload.routes'));
app.use('/api/media', require('./routes/media.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/feed', require('./routes/feed.routes'));
app.use('/api/posts', require('./routes/post.routes'));
app.use('/api/stories', require('./routes/story.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/chats', require('./routes/chat.routes'));
app.use('/api/messages', require('./routes/message.routes'));
app.use('/api/streams', require('./routes/stream.routes'));
app.use('/api/guard', require('./routes/guard.routes'));
app.use('/api/channels', require('./routes/channels.routes'));
app.use('/api/polls', require('./routes/polls.routes'));
app.use('/api/playlists', require('./routes/playlists.routes'));

// ── Health check ──
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'shurma-api', ts: new Date().toISOString() }));

// ── 404 ──
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Sockets ──
const setupSockets = require('./sockets/index');
setupSockets(io);

// ── Storage bootstrap ──
const { ensureBucket, isConfigured: storageConfigured } = require('./services/storage.service');
if (storageConfigured()) {
  ensureBucket()
    .then(() => console.log('Storage bucket ready'))
    .catch((err) => console.error('Storage bucket setup failed:', err.message));
} else {
  require('./services/media.service').ensureTable()
    .then(() => console.log('DB media store ready'))
    .catch((err) => console.error('Media table setup failed:', err.message));
}

// ── Start ──
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Shurma API running on port ${PORT}`);
});
