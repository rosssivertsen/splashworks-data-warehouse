# Cloudflare Access JWT Validation — Design Spec

**Date:** 2026-03-17
**Stream:** IN (Infrastructure)
**Backlog ID:** IN-5 (new)
**Effort:** M
**Status:** Approved

---

## Problem

The API has no application-level authentication. It relies entirely on Cloudflare Access as a network-edge gate. If Cloudflare is bypassed (direct VPS access, tunnel compromise, DNS hijack), the API is fully exposed. The `cf-access-authenticated-user-email` header used for audit logging can be spoofed by any client that reaches the API directly.

## Goal

Add a FastAPI middleware that validates the Cloudflare Access JWT on every request (except `/api/health`). Extract the user email from the JWT claims (cryptographically verified, not from a spoofable header). Reject unauthenticated or expired tokens with a 401.

## Non-Goals

- User roles or RBAC (future concern)
- Frontend changes (browser already sends CF-Authorization cookie)
- Replacing Cloudflare Access (this is defense-in-depth, not a replacement)
- Session management or refresh token handling (Cloudflare manages sessions)

## Design

### Middleware: `api/middleware/cf_access.py`

A Starlette middleware added to the FastAPI app. Runs on every request.

**Request flow:**

1. Check path — if `/api/health`, skip validation (passthrough)
2. Check method — if `OPTIONS` (CORS preflight), skip validation (passthrough). Preflight requests never carry cookies, so they must pass before CORS middleware adds headers.
3. Extract JWT from `CF-Authorization` cookie, falling back to `Authorization: Bearer` header
4. Fetch Cloudflare JWKS public keys (cached in-memory, 5-minute TTL, 5-second HTTP timeout)
5. Validate JWT: RS256 signature, `aud` claim matches `CF_ACCESS_AUD`, `iss` claim matches `https://{CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`, `exp` not passed
6. Extract `email` from JWT payload
7. Set `request.state.cf_user_email` for downstream use
8. On failure: return 401 JSON response, log the rejection reason at WARNING level

**JWKS caching strategy:**

- In-memory dict: `{ "keys": [...], "fetched_at": timestamp }`
- TTL: 300 seconds (5 minutes)
- On cache miss or expiry: HTTPS GET to `https://<team-domain>.cloudflareaccess.com/cdn-cgi/access/certs`
- On fetch failure with valid cache: use stale cache (log warning)
- On fetch failure with no cache: return 503 "Auth service temporarily unavailable"
- HTTP timeout: 5 seconds on JWKS fetch to prevent cascading slowness
- Stampede protection: simple threading lock so only one coroutine refreshes at a time; others use stale cache

**Disabled mode (local dev / tests):**

If `CF_ACCESS_AUD` environment variable is not set, the middleware is completely disabled — all requests pass through with `request.state.cf_user_email = None`. A warning is logged once at startup. This ensures `pytest`, local development, and `npm run dev:vite` work without Cloudflare credentials.

### Environment variables (new)

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `CF_ACCESS_TEAM_DOMAIN` | Yes (prod) | Cloudflare Access team domain for JWKS endpoint | `splashworks` |
| `CF_ACCESS_AUD` | Yes (prod) | Audience tag from Cloudflare Access application config | `64-character hex string` |

Both stored in `.env` on VPS, passed to API container via Docker Compose. Not set in test environments (middleware disabled).

### Error responses

| Scenario | Status | Body |
|----------|--------|------|
| No JWT cookie or header | 401 | `{"detail": "Authentication required"}` |
| Invalid signature, wrong audience, or expired | 401 | `{"detail": "Invalid or expired token"}` |
| JWKS fetch failed, no cached keys | 503 | `{"detail": "Auth service temporarily unavailable"}` |
| `/api/health` | 200 | Normal health response (no auth check) |

### Changes to existing code

**`api/routers/query.py`** — The `_cf_email()` helper currently reads the raw `cf-access-authenticated-user-email` header. Change it to read `request.state.cf_user_email` (set by the middleware from validated JWT claims). When middleware is disabled (local dev), `request.state.cf_user_email` is `None` — the helper returns `None`, not a header fallback. This ensures production deploys never accidentally use the spoofable header path.

**`api/config.py`** — Add `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` with `os.environ.get()` (optional, not required — empty string default enables disabled mode).

**`api/main.py`** — Add the middleware to the FastAPI app.

**`docker-compose.yml` and `docker-compose.staging.yml`** — Pass new env vars to API container.

**`.env.example`** — Document new variables.

**`api/requirements.txt`** — Add `PyJWT[crypto]>=2.8.0`.

## Files

| File | Action |
|------|--------|
| `api/middleware/__init__.py` | **New** — empty |
| `api/middleware/cf_access.py` | **New** — middleware, JWKS cache, JWT validation |
| `api/main.py` | **Modify** — add middleware |
| `api/config.py` | **Modify** — add CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD |
| `api/routers/query.py` | **Modify** — read email from request.state instead of header |
| `api/requirements.txt` | **Modify** — add PyJWT[crypto] |
| `docker-compose.yml` | **Modify** — pass CF_ACCESS_* env vars |
| `docker-compose.staging.yml` | **Modify** — pass CF_ACCESS_* env vars |
| `.env.example` | **Modify** — document new vars |
| `api/tests/unit/test_cf_access_middleware.py` | **New** — unit tests |

## Testing

| Test | What it verifies |
|------|-----------------|
| Valid JWT passes, email extracted to request.state | Happy path |
| Expired JWT returns 401 | Expiration check works |
| Wrong audience returns 401 | Audience validation works |
| Invalid signature returns 401 | Signature verification works |
| Missing JWT returns 401 | No cookie or header |
| Malformed JWT (random string) returns 401 | Graceful handling of garbage input |
| OPTIONS request passes without JWT | CORS preflight not blocked |
| Wrong issuer returns 401 | Issuer validation works |
| `/api/health` bypasses auth | Exempt path works |
| Middleware disabled when CF_ACCESS_AUD unset | Local dev / test mode |
| JWKS fetch failure with cache returns 200 | Stale cache fallback |
| JWKS fetch failure without cache returns 503 | Graceful degradation |
| Existing query endpoint tests still pass | No regressions (middleware disabled in test env) |

## Deployment

1. Get the audience tag from Cloudflare dashboard: Zero Trust → Access → Applications → your app → Overview → Application Audience (AUD) Tag
2. Add to VPS `.env`: `CF_ACCESS_TEAM_DOMAIN=splashworks` and `CF_ACCESS_AUD=<the-tag>`
3. Push branch, create PR
4. After PR merge: `git pull && docker compose up -d --build api`
5. Verify: hit `api.splshwrks.com/api/health` (should work), hit `api.splshwrks.com/api/prompts` without Cloudflare auth (should get 401)
