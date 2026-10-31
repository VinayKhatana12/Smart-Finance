# Production deployment guide

This project deploys as **two services + one database**:

| Piece | Provider (recommended) | Notes |
| --- | --- | --- |
| React SPA + PWA | **Vercel** | `vercel.json` included (SPA rewrites, security headers) |
| Express API | **Render** | `render.yaml` blueprint included (build, pre-deploy migrate, health check) |
| PostgreSQL | **Neon / Supabase / Render Postgres** | any managed Postgres reachable over TLS |

The same API serves the web app and the Android app. Everything below assumes the
frontend and API live on **different origins** (the normal Vercel + Render setup).

## 0. Prerequisites

- GitHub repo pushed (this one).
- Vercel + Render accounts (free tiers work).
- A managed PostgreSQL URL, e.g. `postgres://user:pass@host/db?sslmode=require`.

## 1. Database

1. Create a PostgreSQL instance and copy the connection string.
2. If the provider offers connection pooling (Neon, Supabase, Render pooler), append
   the pooled endpoint to `DATABASE_URL` and add `?pgbouncer=true&connection_limit=10`
   — Prisma works through PgBouncer in transaction mode.

## 2. API on Render

1. Render dashboard → **New → Blueprint** → select this repository. `render.yaml`
   pre-configures build (`npm ci && prisma generate && npm run build`),
   the pre-deploy command (**`prisma migrate deploy` — never `migrate dev` in production**),
   the start command (`node dist/server.js`) and the health check
   (`GET /api/v1/health` → 200 with `db: "connected"`).
2. Set the environment variables when prompted:
   - `DATABASE_URL` — the pooled Postgres URL
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — two **different** random 48+ char
     strings (Render can generate them)
   - `CLIENT_ORIGIN` — `https://<your-app>.vercel.app,https://localhost`
     (`https://localhost` is the packaged Android WebView origin)
   - `COOKIE_SAMESITE=none` — required for cross-site cookies; HTTPS is enforced
   - `NODE_ENV=production`
3. First deploy runs `prisma migrate deploy`, creating all tables.
4. (Optional) seed reference data once from your machine against the production URL:
   `DATABASE_URL=<prod-url> npm run db:seed` — this only inserts system categories
   and a clearly-marked demo user.

## 3. Frontend on Vercel

1. Vercel → **Add New → Project** → import the repo.
2. Vercel auto-detects Vite via `vercel.json`; set env `VITE_API_URL=https://<api>.onrender.com`.
3. Deploy. The PWA manifest, service worker and icons are emitted into `dist/` automatically.

## 4. Android app against production

1. `client/.env.capacitor` → `VITE_API_URL=https://<api>.onrender.com` (HTTPS mandatory).
2. `npm run build:android && npx cap sync android`
3. `cd android && gradlew assembleRelease` (signed via `keystore.properties`) —
   the APK installs and talks to the deployed API; cookies need `SameSite=None`,
   which the deployed backend already sets.

## 5. Post-deploy checks

- `GET https://<api>/api/v1/health` → `{"status":"ok","db":"connected"}`
- Register → login → dashboard from the Vercel origin (CORS + `SameSite=None` cookies).
- Register → login from the installed Android app.
- Offline transaction → banner shows pending → online → Sync now → row appears on the
  server (verified once per `clientRequestId`).

## Production environment variables (API)

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | ✔ | `production` — enables secure cookies, safe error messages |
| `DATABASE_URL` | ✔ | pooled Postgres URL |
| `JWT_ACCESS_SECRET` | ✔ | 32+ chars, random |
| `JWT_REFRESH_SECRET` | ✔ | 32+ chars, **different** from the access secret |
| `CLIENT_ORIGIN` | ✔ | comma-separated origins incl. `https://localhost` |
| `COOKIE_SAMESITE` | ✔ (Android) | `none` |
| `PORT` | — | Render injects it; the app reads `process.env.PORT` |
| `AI_API_KEY` | ✗ | enables LLM refinement in the assistant |

## Production hardening already in place

- Access tokens 15 min, refresh 7 days with rotation + reuse detection (family revocation).
- Refresh tokens stored HMAC-keyed with `JWT_REFRESH_SECRET`; reset tokens too.
- Cookies: HttpOnly, `Secure` in production, SameSite configurable.
- CSRF double-submit with timing-safe compare on every mutation.
- Rate limiting on credential endpoints (50 / 15 min per IP).
- Centralized error handler — safe messages, no stack traces in production, Prisma
  error codes mapped, ownership enforced on every query.
- Graceful shutdown on SIGINT/SIGTERM; `/api/v1/health` for Render health checks.
