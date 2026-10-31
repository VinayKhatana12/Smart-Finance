# Smart Finance — Personal Finance Manager

A full-stack personal finance manager: track income and expenses across multiple accounts, plan
category budgets, save toward goals, read honest reports — with offline support on Android and an
installable PWA on the web.

| | |
|---|---|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS v4, React Router, TanStack Query, React Hook Form + Zod, Recharts |
| **Backend** | Node.js, Express 5, TypeScript, **Prisma ORM**, **PostgreSQL** |
| **Auth** | JWT access + refresh tokens in HttpOnly cookies, bcrypt hashing, CSRF double-submit, rotation with reuse detection |
| **PWA** | vite-plugin-pwa, service worker, IndexedDB outbox, offline transaction queue with idempotent sync |
| **Android** | Capacitor 8 (`com.smartfinance.app`), debug/release APK + Play Store AAB |

The UI is art-directed by the Taste Skill (`design-taste-frontend`): no gradients, no decorative
noise — flat surfaces, tabular figures, honest zeros, and the app's own data as the star.

## Features

- **Accounts** — cash / bank / wallet / other; balances are always computed from the ledger
  (opening balance + signed transaction sum), never stored, so they can never drift.
- **Transactions** — income, expenses and **transfers** between accounts; search, type / category /
  account / date filters, sorting, pagination, CSV export. Money is **BigInt paise** end to end —
  no floating point anywhere.
- **Budgets** — per category per month; spent amounts are computed from real expense transactions;
  80 % / 100 % / exceeded warnings with guaranteed deduplication (one notification per budget per
  threshold per month).
- **Savings goals** — target, deadline, contributions; the saved amount is always derived from
  contribution records.
- **Recurring rules** — daily / weekly / monthly / yearly; a scheduled backend job books due
  transactions idempotently via unique occurrence keys (`rule:{id}:{date}`) — running twice or
  crashing mid-run can never double-book.
- **Insights** — rule-based observations: biggest category, month-over-month changes, unusual
  increases, savings rate, average daily spend, budget usage. Historical facts only — no
  predictions presented as guaranteed.
- **Notifications** — notification center with unread state, mark-read, mark-all, clear; budget
  threshold alerts land here and on the dashboard.
- **Reports** — monthly, annual, income, expense, category and savings views; CSV export and a
  real downloadable **PDF** (pdfkit, no headless browser).
- **Dashboard** — computed totals, income vs expenses chart, category breakdown, recent
  transactions, budget and goal progress, financial alerts.
- **Assistant (optional)** — answers questions ("where did I spend the most?") from the signed-in
  user's own aggregates. Rule-based answers always work; an LLM refinement runs only if
  `AI_API_KEY` is configured. Only sums leave the server — never identities, notes or credentials.
- **PWA** — installable, offline app shell, IndexedDB outbox for transactions created offline,
  background-safe idempotent sync, connection indicator.
- **Android** — Capacitor build with generated icons and splash; session persists via cookies;
  the offline queue survives restarts.

## Architecture

```
Browser / Android WebView          Express 5 API (Node + TS)            PostgreSQL (Prisma)
┌──────────────────────┐   HTTPS   ┌──────────────────────────┐          ┌────────────────┐
│ React SPA (Vite)     │──────────▶│ routes → controllers →   │─────────▶│ users          │
│ TanStack Query cache │  cookies  │ services → Prisma client │          │ accounts       │
│ IndexedDB outbox     │◀──────────│ zod validation, CSRF,    │◀─────────│ transactions   │
│ service worker shell │           │ JWT access+refresh,      │          │ budgets        │
└──────────────────────┘           │ rate limiting            │          │ goals, …       │
                                   └──────────────────────────┘          └────────────────┘
```

- All money is **integer paise** (`BigInt`) — no floating point anywhere.
- Every query is scoped to the authenticated user.
- The API surface is versioned under **`/api/v1`**.
- Full contract: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) · schema:
  [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) · architecture:
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Repository layout

```
├── client/                 # React SPA + PWA + Capacitor Android project
│   ├── android/            # Generated Android Studio project (Gradle)
│   ├── src/features/       # Feature-based modules (auth, transactions, planning, …)
│   ├── src/lib/            # API client, IndexedDB outbox, sync manager, PWA helpers
│   ├── public/             # PWA icons, splash, images
│   └── scripts/            # Icon/splash generator (pure Node, no image libs)
├── server/                 # Express API
│   ├── prisma/             # Schema, migrations, seed
│   ├── src/routes|controllers|services|middleware|validation|utils|db
│   └── tests/              # Vitest + Supertest (61 tests, embedded PostgreSQL)
├── docs/                   # Plan, architecture, API contract, DB schema, design
└── smart-finance-*.apk/.aab  # Built artifacts (not committed — see Builds)
```

## Getting started

Prerequisites: **Node 22+**, **PostgreSQL 14+**, and for Android builds the Android SDK
(see [client/android/BUILD.md](client/android/BUILD.md)).

```bash
# 1. Install
npm run install:all            # root script: server + client

# 2. Configure the API
cp server/.env.example server/.env
#   → set DATABASE_URL (postgres://…) and JWT_SECRET (48+ random chars)

# 3. Create the database and seed system categories + demo user
cd server
npx prisma migrate deploy
npm run db:seed                # prints the demo login once
cd ..

# 4. Run web (API :4000 + Vite :5173 with proxy)
npm run dev
```

Open http://localhost:5173 — sign up and the Overview, Accounts, Transactions,
Budgets, Goals, Reports, Notifications, Insights and Settings pages are live against real data.

## Builds

```bash
# Web (static, PWA manifest + service worker included)
cd client && npm run build          # → dist/

# Android (Capacitor)
cd client
cp .env.capacitor.example .env.capacitor   # set VITE_API_URL=https://<deployed-https-backend>
npm run build:android                       # tsc + vite build --mode capacitor
npx cap sync android                        # copy web assets into the Android project
cd android
gradlew assembleDebug                       # → app/build/outputs/apk/debug/app-debug.apk
gradlew assembleRelease                     # signed (see keystore.properties)
gradlew bundleRelease                       # → app/build/outputs/bundle/release/app-release.aab
```

Backend configuration for the Android client: deploy the API behind HTTPS and set
`COOKIE_SAMESITE=none` plus `CLIENT_ORIGIN=https://localhost` on it — the WebView is a
different site, so auth cookies need SameSite=None over HTTPS.

## Testing

```bash
npm run test          # root: runs both suites
```

- **Server**: 61 tests (Vitest + Supertest) against a real PostgreSQL started per run
  (embedded instance) — auth incl. refresh-token rotation and reuse detection, CSRF, cross-user
  isolation, transaction/account/budget/goal CRUD, offline-replay idempotency
  (`clientRequestId`), recurring generation, budget-notification deduplication, insights,
  reports, PDF, and the full data-integrity scenario (income → expense → balance → budget
  utilization → goal contribution → edit/delete recomputation → transfer → logout).
- **Client**: 4 tests (Vitest + Testing Library) covering the landing page and login validation.

## Security model

- Passwords: bcrypt (12 rounds); hashes never leave the server.
- Sessions: short-lived access JWT + rotating refresh token, both HttpOnly; refresh reuse
  revokes the whole token family.
- Mutations: CSRF double-submit (timing-safe compare) + zod validation + rate limiting on auth.
- Ownership: every row is read and written through `userId`-scoped queries.
- Secrets: `.env` only (gitignored); `.env.example` files document every variable.

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/PLAN.md](docs/PLAN.md) | Phased delivery plan |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, request lifecycle, folder trees |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | `/api/v1` endpoints, envelopes, error codes |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Tables, indexes, money handling, seed policy |
| [docs/DESIGN.md](docs/DESIGN.md) | Taste-Skill art direction, tokens, imagery credits |
| [client/android/BUILD.md](client/android/BUILD.md) | Android SDK setup + APK/AAB commands |
