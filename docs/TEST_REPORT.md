# Smart Finance — Test Report

Date: 2026-10-31 · Machine: Windows 11, Node 22.20, PostgreSQL via embedded instance
(Prisma migrations applied per run) for integration suites.

## Executed results

| Suite | Runner | Scope | Result |
| --- | --- | --- | --- |
| Server — health + CSRF | Vitest + Supertest | health envelope, 404 shape, CSRF mint/reject/mismatch | ✅ 6/6 |
| Server — auth v1 | Vitest + Supertest | register, login, me, refresh rotation, family revocation on reuse, logout, password change, session restore | ✅ 10/10 |
| Server — finance v1 | Vitest + Supertest | accounts, categories, transactions CRUD + filters + CSV, budgets, goals + contributions, dashboard, reports | ✅ 15/15 |
| Server — security audit | Vitest + Supertest | cookie flags, no hash/token leakage, 401 on all protected routes (GET + POST), rate limiting, tampered JWTs, safe errors | ✅ 6/6 |
| Server — financial correctness | Vitest + Supertest | zero/negative/fractional rejection, ₹9 crore bigint values, safe-integer cap, mixed-op totals, transfers leave totals untouched, same-account transfer rejected, refunds, timezone month boundaries (IST), budget recompute on edit/delete, ownership isolation, DB CHECK constraints | ✅ 12/12 |
| Server — data integrity scenario | Vitest + Supertest | the 15-step integration spec incl. transfers + logout | ✅ 11/11 |
| Client — landing + login | Vitest + Testing Library | title/CTAs, 50/30/20 calculator, login validation | ✅ 4/4 |
| **Total** | | | **79 / 79 passed** |

## Build results

| Build | Result |
| --- | --- |
| `tsc --noEmit` server | ✅ 0 errors |
| `tsc -b --noEmit` client | ✅ 0 errors |
| `npm run build` server (→ dist) | ✅ |
| `npm run build` client (→ dist, PWA manifest + sw.js emitted) | ✅ |
| `npx prisma validate` | ✅ valid |
| `prisma migrate deploy` (embedded + dev database) | ✅ 3 migrations applied |

## Android artifacts

| Artifact | Path | Verification |
| --- | --- | --- |
| Debug APK | `smart-finance-debug.apk` (6.3 MB) | built via Gradle 8.13; points at `http://10.0.2.2:4000` for emulator use; aapt: `com.smartfinance.app`, label "Smart Finance" |
| Signed release APK | `smart-finance-release.apk` (4.8 MB) | `apksigner verify`: signed, CN=Smart Finance |
| Signed AAB | `smart-finance-release.aab` (4.6 MB) | `bundleRelease` succeeded |

## Known limitations / honest notes

- **Runtime device testing was not performed**: no runnable Android emulator or physical
  device exists on the build machine (BlueStacks launcher fails silently; LDPlayer is a
  stub). Static verification (aapt badging, apksigner) passed; the on-device steps to run
  the test are in `client/android/BUILD.md`.
- **Password-reset email delivery** prints the single-use link to the API console (dev
  mode). SMTP wiring is required for real email delivery.
- **Deployment URLs are pending** — `render.yaml` and `vercel.json` are committed; the
  actual Vercel/Render/Postgres deployment requires account credentials and is documented
  step-by-step in `docs/DEPLOYMENT.md`.
- **Assistant**: rule-based answers always work; LLM refinement requires `AI_API_KEY`.
- The security suite's rate-limit test intentionally exhausts the 50-request auth window;
  subsequent suites use fresh app instances per file, so no cross-suite interference.
