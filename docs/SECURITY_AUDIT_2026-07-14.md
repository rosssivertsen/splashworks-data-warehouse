# Security & Confidentiality Audit — 2026-07-14

**Target:** splashworks-data-warehouse (production — Hostinger VPS `2.24.202.170`, repo at `/opt/splashworks/`, tracks `main`)
**Scope:** Customer data confidentiality end-to-end — external attack surface, authN/authZ, query guardrails, PII isolation, container/infra posture. Follow-up to `SECURITY_AUDIT_2026-03-28.md`.
**Method:** Live external probing of production endpoints + origin IP, repo-wide static review (production reflects `main`), direct read of DB grant scripts. On-box verification (firewall, container state, secret-file perms) **pending SSH key unlock** — see §7.
**Auditor:** Claude (Sherpa) via Claude Code

---

## Executive summary

**Production confidentiality posture is strong.** The front door is locked (Cloudflare Access enforced on every subdomain), the origin server is not directly reachable (tunnel-only; Postgres not internet-exposed), real customer PII in `raw_skimmer` is unreachable through the query API by design, and staging serves only anonymized data behind a fail-closed leak check.

**Two MEDIUM findings, both about the audit log**, are the meaningful gaps and both are cheap to fix:
1. The API's read-only DB role can *read* `query_audit_log` (it was only meant to write to it), exposing every user's email, IP, and natural-language questions — which routinely contain customer names/addresses — to any authenticated user via `/api/query/raw`.
2. That same audit log accumulates PII-bearing questions indefinitely with no retention policy.

Everything else is LOW / defense-in-depth. Several March findings are now **resolved** (see §6).

| Severity | Count | Notes |
|----------|-------|-------|
| CRITICAL | 0 | — |
| HIGH | 0 | (March H-1/H-3 resolved; H-2 CSP downgraded to LOW in practice) |
| MEDIUM | 2 | Both audit-log confidentiality; fixes below |
| LOW | 7 | Defense-in-depth / hardening |

---

## 1. External attack surface — VERIFIED GOOD

Live probes on 2026-07-14:

- **All four production subdomains enforce Cloudflare Access.** Unauthenticated `GET` to `app`, `api`, `bi`, and `ripple`.splshwrks.com each returns `302` to `canyoncreek.cloudflareaccess.com/cdn-cgi/access/login/...`. No app content served pre-auth. The BI (Metabase) and API hosts — the two that would most directly leak data — are behind Access, not just the SPA.
- **Origin not directly exposed.** Direct connections to the VPS public IP on 80/443/5432/8080/3000 are filtered; **Postgres 5432 is not reachable from the internet.** Traffic enters only via the Cloudflare tunnel (`splashworks-warehouse`, `--protocol http2`), so the app's own auth middleware is never the sole gate — Cloudflare Access sits in front of it.

**Net:** an external attacker with no `canyoncreek` Zero Trust identity cannot reach any application surface or the database. This is the single most important control for customer-data confidentiality and it is holding.

## 2. Authentication / authorization — VERIFIED GOOD

- **Cloudflare Access JWT fully validated at the app layer too** (`api/middleware/cf_access.py`): RS256 signature against Cloudflare JWKS, `audience` = AUD tag, `issuer` = team domain; JWKS cached with stampede lock; 401 on missing/expired/invalid, 503 if JWKS unavailable. Unit-tested for wrong-audience/issuer/key/expired.
- **Fail-closed in production** (`/.dockerenv` → `fail_closed=True`) on both main API and Ripple: if auth env is misconfigured the API returns 503 rather than serving open. This was the March CRITICAL (C-1) and is confirmed fixed and applied to Ripple.
- **CORS** restricted to the specific app origins, GET/POST only, credentials off.
- LOW nits: JWKS "first key" fallback on `kid` miss (not exploitable — signature must still verify); `/api/health` and `OPTIONS` exempt (health returns status only).

## 3. Query guardrails — VERIFIED GOOD (with one MEDIUM downstream)

The AI-to-SQL path is the deliberate "let users run queries" surface, so its containment matters most.

- **Least privilege is the real backstop.** The API connects as `splashworks_ro`, a non-superuser with `USAGE`/`SELECT` only on `public`, `public_staging`, `public_warehouse`, `public_semantic`. **It is NOT granted `raw_skimmer`** — so the raw customer PII source tables are unreachable through the query API even with fully arbitrary SELECT. Superuser-only file functions (`pg_read_file`, `lo_import`, etc.) fail; `dblink`/`postgres_fdw` not installed.
- **Layered SQL validation** (`api/services/query_executor.py`, applied to both `/api/query` and `/api/query/raw`, and to repaired SQL): must start with `SELECT`/`WITH`; dollar-quoting rejected; string-aware keyword blocklist (INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/GRANT/REVOKE/EXEC) that also catches CTE-write tricks; semicolons outside strings blocked (no stacked statements). Statement timeout (30s prod), 10K row cap, `work_mem` bound, rate limits (20/min AI, 30/min raw).
- LOW: resource-exhaustion functions (`pg_sleep`, huge cross joins) remain callable but are bounded by timeout/row-limit/rate-limit. Recommend adding `SET TRANSACTION READ ONLY` in `execute_query` as belt-and-suspenders.

## 4. PII handling — VERIFIED GOOD (prod) with one MEDIUM (audit log)

- **Prod PII isolation confirmed** — real PII (`MobilePhone`, `PrimaryEmail`, `BillingAddress`, names…) lives in `raw_skimmer`, which the API role cannot reach (§3).
- **Staging serves only anonymized data behind a fail-closed gate** — `anonymize-staging.sql` deterministically masks any PII-named column across `raw_skimmer`/`public_warehouse`/`public_semantic`; `staging-refresh.sh` aborts the refresh if `dim_customer` names come through unmasked, leaving the prior anonymized copy in place. Real prod data is never served on the public staging URLs.
- **Secret scrubbing before storage and before LLM egress** — `etl/triage.py` strips passwords, connection-string creds, `sk-ant-…` keys, and JWTs from log excerpts before they hit `etl_incident_log` or Anthropic.

### MEDIUM-1 — Read-only role can READ the audit log (cross-user PII/attribution exposure) — FIXED & DEPLOYED

> **Status 2026-07-14 (deployed to prod, PR #24):** Schema-isolation fix live on `2.24.202.170`.
> Verified end-to-end in the running DB:
> - **Exposure confirmed live before fix:** `splashworks_ro` read 66 rows from `public.query_audit_log`.
> - **Migration applied:** self-verify `OK` notice fired; **66 rows before → 66 after** (zero data loss).
> - **Hole closed:** `splashworks_ro` SELECT on `audit.query_audit_log` → `permission denied`;
>   `public.query_audit_log` no longer exists.
> - **Audit writes intact:** plain `INSERT` as `splashworks_ro` (the app's exact statement) succeeds;
>   running API container serves the new `INSERT INTO audit.query_audit_log` code; no audit errors in logs.
>
> Note: the app INSERT uses no `RETURNING` clause, so revoking SELECT does not affect it (an
> `INSERT ... RETURNING` *would* need SELECT). MEDIUM-2 (retention) remains open.

- **Evidence:** `infrastructure/postgres/init/03-create-readonly-user.sql:18` grants `SELECT ON ALL TABLES IN SCHEMA public` to `splashworks_ro`. `query_audit_log` lives in `public` (`02-create-audit-log.sql`). Line 30 only *needed* to grant `INSERT` on that table — the blanket `public` SELECT over-grants read on it.
- **Impact:** Any authenticated user can `POST /api/query/raw` with `SELECT * FROM query_audit_log` and read **every other user's** `cf_access_email`, `client_ip`, natural-language `question` (routinely contains customer names/addresses), and generated/executed SQL. That's cross-user attribution data plus PII, reachable through the intended query surface.
- **Fix (recommended):** Move `query_audit_log` (and `etl_incident_log`) into a dedicated `audit` schema the RO role has no `USAGE` on; grant `splashworks_ro` only `INSERT` + sequence usage on the log table. Alternatively, keep the table in `public` but `REVOKE SELECT ON public.query_audit_log FROM splashworks_ro;` after the blanket grant. The schema move is cleaner and also protects future audit tables.

### MEDIUM-2 — Audit log retains PII-bearing questions indefinitely

- **Evidence:** `query_audit_log` stores the raw NL `question` + `cf_access_email` + `client_ip` with no TTL (`02-create-audit-log.sql`, `api/services/audit_logger.py`).
- **Impact:** A growing store of "who asked what about which customer," in a table currently over-readable (MEDIUM-1). Even after MEDIUM-1 is fixed, indefinite retention of PII-bearing queries is a confidentiality/минimization concern.
- **Fix:** Add a retention policy — e.g., a nightly `DELETE FROM query_audit_log WHERE created_at < now() - interval '90 days'` (tune to whatever the audit requirement actually is), or partition by month and drop old partitions. Decide the retention window with the data-governance question in mind.

## 5. Container / infra posture — VERIFIED GOOD

- **All published container ports bound to `127.0.0.1`** (postgres 5432, api 8080, frontend 3001, metabase 3000, ripple 8082/3003) — nothing on `0.0.0.0`. Consistent with the origin-not-exposed finding in §1.
- No privileged containers, no sensitive host mounts, healthchecks + `restart: unless-stopped`, per-service least-privilege DB users (api→`splashworks_ro`, ripple→`ripple_rw` scoped to `ripple`, metabase→`metabase_ro`). Postgres connection/DDL/slow-query logging on.
- **No secrets in source** — repo-wide grep clean; every credential from env/`${VAR}`. `.env`, `data/`, `*.db`, `*.log` gitignored and untracked. `.dockerignore` keeps SQLite extracts and `.git` out of build context.
- LOW: Metabase on embedded H2 app-DB (stores `metabase_ro` creds + session secrets in a file not on the postgres backup path — corruption/backup risk, carried from March as SA-M3); `:latest`/untagged image digests; `ripple_rw` retains `CREATE ON DATABASE` (needed only at first boot).

## 6. Status of March 2026 findings

| ID | Finding | Status now |
|----|---------|-----------|
| C-1 | Ripple missing fail_closed | **FIXED** (verified — fail-closed in Docker on Ripple) |
| H-1 | Hardcoded default passwords in init scripts | **RESOLVED** — init now uses `'will_be_reset_by_init_script'` placeholder reset from env by `06-set-passwords.sh`; no `changeme_*` literal remains |
| H-2 | Missing CSP header | Open, but **LOW in practice** — every surface is behind CF Access; recommend adding CSP to nginx confs when convenient |
| H-3 | Ripple CORS/auth middleware ordering | **FIXED** (verified) |
| M-1 | SQL comment-strip bypass | **LOW / fail-safe** — comment in `--`/`/* */` causes false *rejection*, not bypass |
| M-2 | Rate limiter uses spoofable `X-Forwarded-For` | Open — switch to `CF-Connecting-IP` (needs on-box confirm of current code) |
| M-3 | Metabase H2 | Open (LOW) — see §5 |
| M-4 | Audit logger shares DATABASE_URL | Superseded by MEDIUM-1/2 (the grant scope, not the connection string, is the real issue) |
| M-5 | `npm install` vs `npm ci` | Lockfiles now tracked; confirm Dockerfile uses `ci` on-box |
| M-6 | MD5 ETL checksums | Open (LOW) — cosmetic; checksums are change-detection, not security |
| M-7 | `ripple_rw` CREATE ON DATABASE | Open (LOW) |
| L-1..L-6 | Header/CSRF/root-container nits | Open (LOW); CF Access + loopback binding mitigate most |

## 7. On-box verification — COMPLETE (2026-07-14)

SSH verification of `root@2.24.202.170` (hostname `srv1590691`) done. Results:

1. **DW services still tunnel-only — GOOD.** `cloudflared` runs as an active systemd service and
   proxies `app/api/bi/ripple.splshwrks.com` to loopback-bound containers (`127.0.0.1:3001/8080/3000/8082`).
   These are not published on `0.0.0.0`.
2. **Host nginx IS public on `0.0.0.0:80/443` — but it serves the *other* app on this shared box**
   (`app.jomopools.com` / jomo-inventory, `proxy_pass → 127.0.0.1:8000`, Certbot cert), plus a `_`
   catch-all. There is **no** `app.splshwrks.com` server block in host nginx — DW traffic never
   traverses it — so hitting the origin IP directly with a spoofed `Host: app.splshwrks.com` lands on
   the catch-all, not the DW frontend. No Access bypass for this stack. (Governance note: the
   jomo-inventory public exposure is owned by the `inventory-app` repo, out of scope here.)
3. **Postgres not publicly exposed — GOOD.** Bound to `127.0.0.1:5432` and the **tailnet** IP
   `100.124.108.126:5432` (Tailscale, access-controlled) — never `0.0.0.0`.
4. **Secret file perms — GOOD.** `/opt/splashworks/.env` and `/root/.slack_webhook` are `600 root:root`.
   (`/root/.ssh/staging_pull_ed25519` correctly absent on prod — it lives on the staging box.)
5. **MEDIUM-1 confirmed live and then fixed** — see the MEDIUM-1 box above (66-row exposure proven,
   then closed).

### NEW LOW — Host firewall (`ufw`) is inactive

- **Evidence:** `ufw status` = `inactive` on `2.24.202.170`.
- **Impact:** Low in practice — the DW services are loopback+tunnel, Postgres is loopback+tailnet, and
  nothing sensitive binds `0.0.0.0` except the intentionally-public jomo-inventory nginx (22/80/443).
  But there is no host-level default-deny as defense-in-depth; a future service that accidentally binds
  `0.0.0.0` would be immediately internet-exposed with nothing behind it.
- **Fix:** enable `ufw` with default-deny inbound, allowing only 22/80/443 (and rely on Tailscale ACLs
  for the tailnet Postgres). Schedule in the `feature/in-*` hardening batch. Coordinate with the
  `inventory-app` owner since the box is shared.

### NEW LOW — `.gitignore` did not cover raw data extracts (now fixed)

- Raw customer databases (`Skimmer Nightly/*.db`, `*.db.gz`), BI workbooks (`*.pbix`, `*.xlsx`), and a
  meeting recording sat untracked in the working tree but were **not** gitignored — one `git add -A`
  from being committed to a shared GitHub repo. Fixed in PR #24 with broad ignore patterns.
  **History scan run 2026-07-14:** `git log --all --diff-filter=A -- '*.db' '*.db.gz' '*.pbix' '*.xlsx'`
  returned NONE — no database or workbook file was ever committed. No historical exposure; the
  near-miss was caught before any commit.

## 8. Recommended actions (priority order)

1. **Fix MEDIUM-1** — revoke RO read on the audit log (schema move or targeted `REVOKE`). ~15 min, migration + redeploy. *This is the one I'd do first.*
2. **Fix MEDIUM-2** — add an audit-log retention job. Decide window during the Green Mill / data-governance conversation.
3. **Unlock SSH** so I can complete §7 (10 min of checks) and confirm the running DB matches the init scripts.
4. Low-priority hardening batch (CSP header, `CF-Connecting-IP` rate limiting, `SET TRANSACTION READ ONLY`, Metabase→Postgres app-DB, pin image digests) — schedule as one `feature/in-*` PR.
5. Consider a full Shannon pentest (~1.5h/~$50) now that the stack is more mature than the March light-mode scan.

---

*Generated by Claude Code security audit — 2026-07-14. Supersedes SECURITY_AUDIT_2026-03-28.md for current-state posture; that file retains the original finding detail.*
