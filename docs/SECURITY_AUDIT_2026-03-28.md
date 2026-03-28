# Security Audit Report — 2026-03-28

**Target:** splashworks-data-warehouse
**Stack:** React + TypeScript (Vite), FastAPI (Python), Postgres 16 + pgvector, dbt, Docker Compose, Cloudflare Tunnels
**Tools Used:** Shannon (autonomous pentesting), Security Auditor (static analysis)
**Auditor:** Claude (via Claude Code)

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | FIXED |
| HIGH | 3 | 1 fixed (H-3), 2 open |
| MEDIUM | 7 | Open |
| LOW | 6 | Open |

---

## CRITICAL (1)

### C-1: Ripple API Missing `fail_closed` — Unauthenticated Access in Production — FIXED

- **File:** `ripple/api/main.py:17-21`
- **Description:** CloudflareAccessMiddleware registered without `fail_closed=True`. If `CF_ACCESS_AUD` or `CF_ACCESS_TEAM_DOMAIN` env vars are empty/unset in Docker, the middleware silently disables itself and all Ripple endpoints become unauthenticated. The `/api/chat` endpoint accepts arbitrary user input and streams AI responses — exposing it without auth allows anyone to consume API credits and query the knowledge base.
- **OWASP:** A07:2021 — Identification and Authentication Failures (CWE-287)
- **Fix applied:** Added `fail_closed=os.path.exists("/.dockerenv")` matching the main API pattern.

---

## HIGH (3)

### H-1: Hardcoded Default Passwords in Postgres Init Scripts — OPEN

- **Files:**
  - `infrastructure/postgres/init/03-create-readonly-user.sql:6`
  - `infrastructure/postgres/init/04-create-ripple-user.sql:5`
  - `infrastructure/postgres/init/05-create-metabase-user.sql:6`
- **Description:** All three user creation scripts use `PASSWORD 'changeme_override_via_env'`. If the password is never changed after init, the database roles have a well-known weak password.
- **OWASP:** A07:2021 — Identification and Authentication Failures (CWE-798)
- **Recommended fix:** Use a shell script wrapper that reads passwords from environment variables.

### H-2: Missing Content-Security-Policy Header — OPEN

- **Files:** `frontend/nginx.conf`, `ripple/frontend/nginx.conf`
- **Description:** No `Content-Security-Policy` header. Without CSP, any XSS vector has no defense-in-depth mitigation.
- **OWASP:** A05:2021 — Security Misconfiguration (CWE-693)
- **Recommended fix:** Add a restrictive CSP header.

### H-3: Ripple API CORS Middleware Ordering — Auth Bypass — FIXED

- **File:** `ripple/api/main.py:17-33`
- **Description:** Middleware registered in wrong order — CORS ran before auth on the request path.
- **OWASP:** A07:2021 — Identification and Authentication Failures (CWE-863)
- **Fix applied:** Swapped middleware registration order to match main API pattern.

---

## MEDIUM (7)

### M-1: SQL Validation Regex Bypass via Comments

- **File:** `api/services/query_executor.py:19-53`
- **Description:** `validate_sql` strips single-quoted strings but not SQL comments. Block comment tricks could confuse the regex.
- **Mitigating factors:** Read-only DB user, statement timeout, row limits.
- **OWASP:** A03:2021 — Injection (CWE-89)

### M-2: Rate Limiter Uses Spoofable Client IP

- **File:** `api/rate_limit.py:1-4`
- **Description:** Uses `get_remote_address` which reads `X-Forwarded-For` (client-spoofable). Should use `CF-Connecting-IP` behind Cloudflare.
- **OWASP:** A04:2021 — Insecure Design (CWE-770)

### M-3: Metabase Using H2 Embedded Database

- **File:** `docker-compose.yml:64-75`
- **Description:** H2 has known CVEs and data is not backed up with the postgres volume strategy.
- **OWASP:** A06:2021 — Vulnerable and Outdated Components (CWE-1104)

### M-4: Audit Logger Shares Main DATABASE_URL

- **File:** `api/services/audit_logger.py:6`
- **Description:** Privilege separation concern — consider a separate `AUDIT_DATABASE_URL`.
- **OWASP:** A01:2021 — Broken Access Control (CWE-250)

### M-5: Frontend Dockerfile Uses `npm install` Instead of `npm ci`

- **File:** `frontend/Dockerfile:5`
- **Description:** Dynamic resolution could introduce supply chain attacks.
- **OWASP:** A06:2021 — Vulnerable and Outdated Components (CWE-1104)

### M-6: MD5 Used for ETL File Checksums

- **File:** `etl/extract.py:39-44`
- **Description:** MD5 is deprecated and collision-prone. Use SHA-256.
- **OWASP:** A02:2021 — Cryptographic Failures (CWE-328)

### M-7: Ripple `ripple_rw` Has Overly Broad CREATE DATABASE Permission

- **File:** `infrastructure/postgres/init/04-create-ripple-user.sql:20`
- **Description:** Pre-create the `ripple` schema instead and remove `CREATE ON DATABASE` grant.
- **OWASP:** A01:2021 — Broken Access Control (CWE-250)

---

## LOW (6)

| ID | Finding | File |
|---|---|---|
| L-1 | Missing Permissions-Policy header | All Nginx configs |
| L-2 | No CSRF token on mutation endpoints (mitigated by CF Access + CORS) | `api/routers/query.py` |
| L-3 | Unquoted shell variables | `scripts/deploy.sh:53` |
| L-4 | Docker containers run as root | `api/Dockerfile`, `ripple/api/Dockerfile` |
| L-5 | `firebase-debug.log` committed to repo | Root directory |
| L-6 | FastAPI docs endpoint exposed | `api/main.py:13` |

---

## Positive Security Observations

1. Read-only database user for API — limits SQL injection blast radius
2. SQL validation with keyword blocklist — defense-in-depth with RO user
3. Statement timeout + row limits — prevents resource exhaustion (10s, 10K rows)
4. Cloudflare Access JWT validation — proper JWKS verification with caching
5. Fail-closed in production (main API) — rejects all if auth misconfigured
6. Parameterized queries throughout — no string interpolation of user input
7. CORS properly restricted — specific origin allowlist
8. Ports bound to 127.0.0.1 — all Docker services on localhost only
9. Security headers — HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy
10. Pydantic input validation — length limits and pattern validation
11. React renders data safely via JSX text content
12. Audit logging — every query logged with IP, email, SQL, status, duration
13. Secrets not in source — `.env` properly gitignored

---

## Shannon Pentest (Light Mode)

A pipeline-testing scan against `https://staging-app.splshwrks.com` completed in 2m 26s ($0.36). No exploitable vulnerabilities found in light mode. A full pentest (~1.5 hours, ~$50) is recommended for thorough coverage.

---

*Generated by Claude Code security audit — 2026-03-28*
