# Smart Finance — API Contract (v1)

Base URL: `/api` (dev: proxied by Vite from `http://localhost:5173` to `http://localhost:4000`).

## Conventions

- **Success:** `{ "success": true, "data": … }`
- **Error:** `{ "success": false, "error": { "code": string, "message": string, "details"?: [{ "path": string, "message": string }] } }`
- **Auth:** JWT in HttpOnly cookie `sf_token`. Mutations require header `X-CSRF-Token` matching the `sf_csrf` cookie (double-submit). `GET /api/auth/csrf` mints the pair.
- **Status codes:** 200 ok · 201 created · 400 validation · 401 unauthenticated · 403 CSRF/forbidden · 404 not found · 409 conflict · 429 rate limited · 500 internal · 501 not implemented in this phase.

## Implemented in phase 1

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | /api/health | — | — | `{ status, db, uptimeSeconds, timestamp }` |
| GET | /api/auth/csrf | — | — | `{ csrfToken }` + sets `sf_csrf` cookie |
| POST | /api/auth/register | — | `{ name, email, password, currency? }` | 201 `{ user }`, sets session cookie |
| POST | /api/auth/login | — | `{ email, password }` | 200 `{ user }`, sets session cookie |
| POST | /api/auth/logout | ✔ | — | 200, clears cookie |
| GET | /api/auth/me | ✔ | — | `{ user }` |
| PATCH | /api/users/me | ✔ | `{ name?, currency? }` | 200 `{ user }` |

`user` shape (password hash never leaves the server):

```json
{ "id": "…", "name": "Vinay", "email": "vinay@example.com", "currency": "INR", "createdAt": "2026-10-29T…" }
```

Errors: `VALIDATION_ERROR`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `CSRF_INVALID`, `RATE_LIMITED`, `ROUTE_NOT_FOUND`, `INTERNAL`.

## Stubbed (501 NOT_IMPLEMENTED) until later phases

| Resource | Planned endpoints |
| --- | --- |
| /api/transactions | GET list (filters: type, category, month, page), POST, PATCH /:id, DELETE /:id |
| /api/budgets | GET list (month), PUT upsert, DELETE /:id |
| /api/goals | GET list, POST, PATCH /:id (contribute), DELETE /:id |
| /api/reports | GET summary (month), GET trends (12 months), GET categories |

Stub responses use the standard error envelope with `code: "NOT_IMPLEMENTED"`, so the client can render a consistent "arrives in the next build" state.
