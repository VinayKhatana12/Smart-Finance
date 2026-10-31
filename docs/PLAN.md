# Smart Finance — Implementation Plan

**Smart Finance — Personal Finance Manager**
Track income and expenses, plan budgets, save toward goals, and read honest reports about your own money.

## Phase 1 (this delivery) — Foundation

| Area | Status |
| --- | --- |
| Workspace inspection | Done (folder was empty; git root is the user home directory — see report) |
| Planning docs | Done (`docs/`) |
| `server/` scaffold — Express 5 + TS, modular layers, auth (JWT HttpOnly cookie + CSRF), health check, consistent error envelope, rate limiting, PostgreSQL schema via Drizzle ORM (migrations committed), 501 stubs for phase-2 resources, Vitest + Supertest suite | Done |
| `client/` scaffold — Vite + React 19 + TS + Tailwind v4, router with all 8 pages, TanStack Query, RHF + Zod, Recharts, Toasts, skeletons, empty/error states, Taste-Skill art direction | Done |
| Verify both apps: install → typecheck → build → test → run | Done, commands and results in the final report |
| Seed vs user data separation | Design done (`docs/DATABASE_SCHEMA.md`, `server/src/scripts/` reserved); seed script lands in phase 2 |

## Later phases (not in this delivery)

1. **Phase 2 — Money in:** Transactions CRUD (list/filter/paginate/create/edit/delete), categories, CSV import.
2. **Phase 3 — Planning:** Budgets per category per month with live spent/limit computations; dashboard plan ring wired to real data.
4. **Phase 4 — Goals:** Savings goals with pots, contributions, progress.
5. **Phase 5 — Reports:** Aggregation endpoints (monthly trends, category breakdown), PDF/CSV export.
6. **Phase 6 — Hardening:** Refresh-token rotation, refresh tokens, email verification, password reset, audit log, deployment CI.

## Engineering rules honoured in phase 1

- **Database: PostgreSQL via Drizzle ORM** (explicit user decision, replacing the originally suggested MongoDB/Mongoose). SQL migrations are committed under `server/drizzle/`.
- Strict TypeScript everywhere, no `any` in either app (ESLint-ready configs included).
- Zod validation on both client (forms) and server (request bodies).
- Secrets only via environment variables; `.env` files are gitignored, `.env.example` files are committed.
- Password hashes are `select: false` and stripped by the model's `toJSON`; JWT secrets never leave the server.
- No hardcoded financial data anywhere in the app: every screen renders honest empty/zero states until a user adds data. Landing-page fragments use clearly-sample data that adds up and is listed in `docs/DESIGN.md` for replacement.
- Consistent JSON envelope: success `{ success: true, data }`, error `{ success: false, error: { code, message, details? } }`.
