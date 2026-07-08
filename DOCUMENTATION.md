# Shurma — Full Technical Documentation

> **Anti-Algorithmic, Verified, Secure, Authentic**  
> Real-time AI-Driven Next-Generation All-in-One Super Social Network Platform  
> Authored by Ahmed Al-Madani (@ahmed.builds)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Reference](#api-reference)
5. [Frontend Modules](#frontend-modules)
6. [Environment Variables](#environment-variables)
7. [Deployment Guide](#deployment-guide)
8. [Maintenance Guide](#maintenance-guide)

---

## 1. Overview

Shurma merges five production applications into a unified platform:

| Source App | Module | Purpose |
|-----------|--------|---------|
| NexFeed | Feed | AI-ranked social feed, posts, likes, comments |
| ChatsApp | Chat | Real-time 1:1 and group messaging |
| StreamFlow | Stream | Live streaming with tipping and product showcase |
| ShopStack | Shop | Full e-commerce marketplace with Stripe payments |
| GuardAI | Guard | AI content moderation layer |

**Revenue model:** $1/month subscriptions + commission on sales + ad revenue  
**Target:** 500 → 5,000 users at $100–200 acquisition cost

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    SHURMA PLATFORM                   │
│                                                     │
│  ┌──────────────┐      ┌────────────────────────┐  │
│  │   Frontend   │      │       Backend          │  │
│  │  React 19    │◄────►│   Node.js / Express    │  │
│  │  Vite 6      │ HTTP │   Socket.io            │  │
│  │  Tailwind v3 │  WS  │   JWT Auth             │  │
│  │  Zustand v5  │      │   Claude AI            │  │
│  └──────────────┘      │   Stripe               │  │
│       Vercel            └───────────┬────────────┘  │
│                                     │               │
│                              ┌──────▼──────┐        │
│                              │  PostgreSQL  │        │
│                              │  (Supabase) │        │
│                              └─────────────┘        │
│                               Supabase / Render     │
└─────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS 3, React Router 7, Zustand 5 |
| Backend | Node.js, Express 4, Socket.io 4, CommonJS |
| Database | PostgreSQL via Supabase (session pooler, SSL) |
| Auth | JWT (7-day expiry, bcrypt 12 rounds) |
| AI | Anthropic Claude Sonnet (feed ranking + content moderation) |
| Payments | Stripe Checkout Sessions + Webhooks |
| Hosting | Vercel (frontend), Render (backend), Supabase (database) |

---

## 3. Database Schema

All primary keys are UUID (`gen_random_uuid()`). The schema is idempotent — safe to run on a fresh database or over an existing NexFeed database.

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | Unified user table (superset of all 5 apps) |
| `posts` | Feed posts with AI scores |
| `likes` | Post likes |
| `comments` | Post comments |
| `follows` | Follow relationships (also used by StreamFlow) |
| `feed_scores` | AI-computed feed relevance scores |
| `chats` | Chat conversations (DM and group) |
| `chat_participants` | Chat membership |
| `messages` | Chat messages with reply threading |
| `message_reads` | Read receipts |
| `streams` | Live stream sessions |
| `stream_products` | Products showcased during streams |
| `stream_comments` | Live chat during streams |
| `stream_tips` | Stripe-backed tips to streamers |
| `shop_vendors` | Merchant accounts |
| `shop_categories` | Product categories (seeded with 6 defaults) |
| `shop_products` | Product listings |
| `shop_cart_items` | Shopping cart |
| `shop_orders` | Purchase orders |
| `shop_order_items` | Order line items |
| `shop_reviews` | Product reviews |
| `guard_logs` | Moderation audit log |
| `guard_rules` | Custom moderation rules |

---

## 4. API Reference

Base URL: `https://<your-render-app>.onrender.com/api`

All endpoints except `/auth/register` and `/auth/login` require:
```
Authorization: Bearer <jwt_token>
```

### Auth

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/auth/register` | `{name, username, email, password}` | `{user, token}` |
| POST | `/auth/login` | `{email, password}` | `{user, token}` |
| GET | `/auth/me` | — | `{user}` |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/search?q=` | Search users by name/username |
| GET | `/users/:id` | Get user profile |
| GET | `/users/u/:username` | Get profile by username |
| PUT | `/users/profile` | Update own profile |
| POST | `/users/:id/follow` | Follow a user |
| DELETE | `/users/:id/follow` | Unfollow |
| GET | `/users/:id/followers` | List followers |
| GET | `/users/:id/following` | List following |

### Feed

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/feed` | AI-ranked personal feed |
| GET | `/feed/explore` | Top posts by engagement |

### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/posts` | Create post (auto-moderated) |
| GET | `/posts/:id` | Get post |
| GET | `/posts/user/:id` | Get user's posts |
| DELETE | `/posts/:id` | Delete own post |
| POST | `/posts/:id/like` | Like |
| DELETE | `/posts/:id/like` | Unlike |
| GET | `/posts/:id/comments` | Get comments |
| POST | `/posts/:id/comments` | Add comment |

### Chats & Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chats` | List user's chats |
| POST | `/chats` | Create DM or group chat |
| GET | `/chats/:id` | Get chat details |
| GET | `/messages/:chatId` | Get messages (paginated) |
| POST | `/messages/:chatId` | Send message |

### Streams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/streams?status=live` | List streams |
| POST | `/streams` | Create stream |
| GET | `/streams/:id` | Get stream |
| POST | `/streams/:id/start` | Go live |
| POST | `/streams/:id/end` | End stream |
| POST | `/streams/:id/comments` | Send stream comment |
| POST | `/streams/:id/tip` | Tip streamer (Stripe) |
| GET | `/streams/:id/products` | Get showcased products |

### Shop

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shop/categories` | List categories |
| GET | `/shop/products` | List products (filterable) |
| GET | `/shop/products/:slug` | Get product + reviews |
| POST | `/shop/vendors` | Become a vendor |
| POST | `/shop/products` | Create product (vendors only) |
| GET | `/shop/cart` | Get cart |
| POST | `/shop/cart` | Add to cart |
| DELETE | `/shop/cart/:productId` | Remove from cart |
| POST | `/shop/checkout` | Stripe checkout |
| GET | `/shop/orders` | Get order history |
| POST | `/shop/webhook` | Stripe webhook (raw body) |

### Guard

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/guard/check` | Check content for violations |
| GET | `/guard/stats` | Moderation stats (7-day window) |
| GET | `/guard/logs` | Full log (admin only) |
| GET | `/guard/rules` | List moderation rules |
| POST | `/guard/rules` | Create rule (admin only) |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API health check |

---

## 5. Frontend Modules

### Socket.io Events (real-time)

**Client → Server**

| Event | Payload | Description |
|-------|---------|-------------|
| `join_chat` | `chatId` | Join chat room |
| `leave_chat` | `chatId` | Leave chat room |
| `typing` | `{chatId, isTyping}` | Typing indicator |
| `join_stream` | `streamId` | Join stream room |
| `leave_stream` | `streamId` | Leave stream room |

**Server → Client**

| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | message object | Real-time message |
| `user_typing` | `{userId, name, isTyping}` | Typing indicator |
| `new_post` | post object | New post in feed |
| `new_comment` | comment object | New comment |
| `stream_started` | stream object | Stream went live |
| `stream_ended` | `{streamId}` | Stream ended |
| `stream_comment` | comment object | Live stream chat |
| `viewer_count` | `{streamId, count}` | Viewer count update |
| `user_online` | `{userId}` | User came online |
| `user_offline` | `{userId}` | User went offline |
| `new_follower` | `{followerId}` | Someone followed you |

---

## 6. Environment Variables

### Backend (`.env`)

```env
PORT=5000
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
JWT_SECRET=<32+ char random hex>
JWT_EXPIRES_IN=7d
CLIENT_URL=https://<your-vercel-app>.vercel.app
ANTHROPIC_API_KEY=<optional — graceful fallback without it>
STRIPE_SECRET_KEY=<optional — demo mode without it>
STRIPE_WEBHOOK_SECRET=<optional — needed for webhook verification>
```

### Frontend (`.env.local`)

```env
VITE_API_URL=https://<your-render-app>.onrender.com/api
VITE_SOCKET_URL=https://<your-render-app>.onrender.com
```

> **Note:** Frontend env vars beginning with `VITE_` are embedded at build time.  
> Use `--build-env` flag when deploying with Vercel CLI.

---

## 7. Deployment Guide

### Step 1 — Database (Supabase)

1. Go to [supabase.com](https://supabase.com) → New project or use existing
2. SQL Editor → New query → Paste contents of `backend/src/config/schema.sql`
3. Click **Run** (choose "Run without RLS" if prompted)
4. Copy the **Session pooler** connection string from Settings → Database

### Step 2 — Backend (Render)

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect GitHub repo → select `shurma` repo
3. Set:
   - **Root directory:** `backend`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Add all environment variables from Step 1
5. Deploy — first deploy ~2 min, cold starts ~50s on free tier

### Step 3 — Frontend (Vercel)

```bash
cd frontend
npm install
npm run build
npx vercel --prod \
  --build-env VITE_API_URL=https://<render-url>/api \
  --build-env VITE_SOCKET_URL=https://<render-url>
```

Or connect GitHub repo in Vercel dashboard and set env vars there.

---

## 8. Maintenance Guide

### Daily

- Monitor Render logs for errors (`render.com → Logs`)
- Check Supabase database usage (Storage → Database Size)

### Weekly

- Review Guard moderation stats at `/guard/stats`
- Check Stripe dashboard for failed payments

### Monthly

- Rotate `JWT_SECRET` (requires all users to re-login)
- Review and update moderation rules via `/api/guard/rules`
- Check Render/Vercel/Supabase usage vs. free tier limits

### Scaling Milestones

| Users | Action |
|-------|--------|
| 500 | Upgrade Render to Starter ($7/mo), add Redis for sessions |
| 1,000 | Upgrade Supabase to Pro ($25/mo) for connection pooling |
| 5,000 | Add CDN for media (Cloudflare R2), separate read replicas |
| 10,000 | Kubernetes or Render Autoscaling, Stripe subscription billing |

### Common Fixes

**Cold start delay (~50s)**  
Free Render services sleep after 15min inactivity. Upgrade to Starter tier or use an uptime monitor (UptimeRobot pings `/health` every 5min).

**JWT token expired**  
Users are auto-redirected to `/login` by the axios interceptor. No action needed.

**Stripe webhook missing events**  
Verify `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint in Stripe dashboard. The webhook endpoint is `POST /api/shop/webhook`.

**AI moderation offline**  
The platform runs in safe-fallback mode without `ANTHROPIC_API_KEY`. Content defaults to `verdict: "safe"`. Add the key in Render env vars and redeploy.

**Database connection pool exhausted**  
Increase Supabase connection limit or switch to Transaction pooler mode in `DATABASE_URL`. The current config uses Session pooler (max 20 connections).
