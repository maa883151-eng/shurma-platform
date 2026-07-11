# Shurma

> **Anti-Algorithmic · Verified · Secure · Authentic**
> An all-in-one social platform — AI-ranked feed, real-time chat, live streaming with tipping, and a full e-commerce marketplace — built and deployed solo.

[![CI](https://github.com/maa883151-eng/shurma-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/maa883151-eng/shurma-platform/actions/workflows/ci.yml)

**Live demo:** [shurma-platform.vercel.app](https://shurma-platform.vercel.app) · **API:** [shurma-api.onrender.com](https://shurma-api.onrender.com/health)

<!-- Add a hero screenshot or short GIF here: docs/screenshot.png -->

---

## What it does

Shurma unifies five product surfaces into one platform, sharing a single auth system, database, and real-time layer:

| Module | What it is |
|--------|-----------|
| **Feed** | Social feed ranked by Claude AI for genuine quality — no engagement-bait optimization. Posts, stories, polls, reposts, bookmarks, trending. |
| **Chat** | Real-time 1:1 and group messaging over Socket.io, with typing indicators and read receipts. |
| **Stream** | Live streaming with viewer chat, Stripe-powered tipping, and in-stream product showcases. |
| **Shop** | Multi-vendor marketplace: carts, wishlists, flash deals, reviews, Stripe Checkout, and webhook-driven order fulfillment. |
| **Guard** | AI content moderation layer — every piece of content can be screened by Claude, with an audit log and admin rules engine. |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    SHURMA PLATFORM                   │
│                                                     │
│  ┌──────────────┐      ┌────────────────────────┐   │
│  │   Frontend   │      │       Backend          │   │
│  │  React 19    │◄────►│   Node.js / Express    │   │
│  │  Vite 6      │ HTTP │   Socket.io            │   │
│  │  Tailwind 3  │  WS  │   JWT Auth             │   │
│  │  Zustand 5   │      │   Claude AI            │   │
│  └──────────────┘      │   Stripe               │   │
│       Vercel           └───────────┬────────────┘   │
│                                    │                │
│                             ┌──────▼──────┐         │
│                             │ PostgreSQL  │         │
│                             │ (Supabase)  │         │
│                             └─────────────┘         │
│                              Render / Supabase      │
└─────────────────────────────────────────────────────┘
```

**Stack:** React 19 · Vite 6 · Tailwind CSS 3 · Zustand 5 · Node.js/Express 4 · Socket.io 4 · PostgreSQL (Supabase) · Stripe · Anthropic Claude · Deployed on Vercel + Render

## Architecture decisions

A few choices worth explaining, since they come up often:

- **AI that degrades gracefully.** Feed ranking and moderation call Claude, but the platform never depends on it: if the API key is absent or the call fails, ranking falls back to an engagement-based heuristic and moderation fails open with an audit-log entry. The app works identically with zero external AI configuration.
- **Stripe webhooks over client-side confirmation.** Orders are marked paid only by a signature-verified `checkout.session.completed` webhook — the client redirect is never trusted. The webhook route is mounted *before* `express.json()` because Stripe signature verification requires the raw request body.
- **Zustand over Redux.** Five modules share one store shape; Zustand keeps that at ~1/10th the boilerplate with no providers, which matters when one person maintains 15+ pages.
- **JWT with per-request user lookup.** Tokens carry only a user ID; the auth middleware re-fetches the user on each request, so bans, role changes, and deletions take effect immediately instead of at token expiry.
- **Idempotent SQL schema.** The whole schema is `CREATE TABLE IF NOT EXISTS` / additive migrations, safe to re-run on a live database — no migration tooling needed at this scale.

## Project structure

```
shurma/
├── backend/
│   ├── src/
│   │   ├── config/        # pg pool, SQL schema
│   │   ├── controllers/   # one per domain (auth, feed, shop, guard, …)
│   │   ├── middleware/    # JWT auth, admin gate
│   │   ├── routes/        # Express routers
│   │   ├── services/      # Claude AI, Stripe
│   │   ├── sockets/       # Socket.io event handlers
│   │   └── server.js
│   └── tests/             # Jest + supertest (auth, payments, moderation)
├── frontend/
│   └── src/
│       ├── api/           # axios instance
│       ├── components/    # shared UI
│       ├── modules/       # feature components (feed, …)
│       ├── pages/         # route-level pages
│       └── store/         # Zustand stores
└── DOCUMENTATION.md       # full technical docs: schema, API reference, deploy guide
```

## Running locally

Requires Node 20+ and a PostgreSQL database (a free Supabase project works).

```bash
# Backend
cd backend
npm install
cp .env.example .env   # set DATABASE_URL and JWT_SECRET (others optional)
npm run dev            # http://localhost:5000

# Frontend (second terminal)
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Apply the schema once: run `backend/src/config/schema.sql` against your database (it's idempotent).

Optional integrations — the app runs without them:

| Variable | Enables |
|----------|---------|
| `ANTHROPIC_API_KEY` | AI feed ranking + content moderation |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Real payments (otherwise checkout runs in demo mode) |

Full environment reference in [DOCUMENTATION.md](DOCUMENTATION.md).

## Testing

```bash
cd backend
npm test
```

The suite covers the highest-risk surfaces:

- **Auth** — registration validation, credential handling, JWT issuance/verification, expired and forged tokens, admin gating. Asserts passwords are bcrypt-hashed and never echoed back.
- **Payments** — the Stripe webhook is tested against Stripe's *real* signature verification: tampered and unsigned payloads must be rejected; valid events mark orders paid and clear carts.
- **AI moderation & ranking** — verdict parsing, audit logging, content truncation, and every degraded mode (no API key, API errors).

CI runs the backend suite and a production frontend build on every push and PR.

## Documentation

Full technical documentation — database schema, complete API reference, deployment and maintenance guides — lives in [DOCUMENTATION.md](DOCUMENTATION.md).

---

Built by **Ahmed Al-Madani** ([@ahmed.builds](https://instagram.com/ahmed.builds))
