# Splashworks Data Warehouse MVP — Progress Tracker

**Design Doc:** [2026-03-07-data-warehouse-mvp-design.md](./2026-03-07-data-warehouse-mvp-design.md)
**Branch:** `feature/warehouse-etl`
**Last Updated:** 2026-03-09

---

## Current Status

**Phase:** 1 — Crawl (Batch A: Data Pipeline)
**Status:** Steps 1.1-1.5 COMPLETE
**Next:** Phase 1 Batch B — Backend + Frontend

---

## Phase 0: Foundation (Week 1-2)

| Step | Deliverable | Status | Notes |
|------|-------------|--------|-------|
| 0.1 | Create branch, commit design doc | DONE | Branch `feature/warehouse-etl` created |
| 0.2 | Fix critical bugs (Dropbox token, SQL injection) | PENDING | Deferred — apply to both branches |
| 0.3 | Docker Compose + Postgres (local) | DONE | pgvector/pgvector:pg16, all schemas created |
| 0.4 | Python ETL package | DONE | 6 extract tests passing, real data validated |
| 0.5 | ETL real data test | DONE | 712,267 rows loaded (44 tables x 2 companies), checksum skip verified |
| 0.6 | dbt project scaffolded | DONE | debug passes, company_lookup seed loaded |
| 0.7 | Smoke test script | DONE | 7/7 checks passing |
| 0.8 | VPS setup: Docker on VPS | DONE | Docker 29.3.0, Postgres 16+pgvector healthy, all schemas created |
| 0.9 | rclone configured for OneDrive | DONE | Both extracts synced (76MB), nightly cron 1AM UTC |
| 0.10 | Cloudflare tunnel live | DONE | 3 subdomains routed, systemd service, 502s confirm tunnel works |

## Phase 1: Crawl (Week 3-6)

| Step | Deliverable | Status |
|------|-------------|--------|
| 1.1 | ETL on VPS + current views | DONE | 712K rows loaded, 88 views created, shm_size fixed |
| 1.2 | dbt staging models (18 tables) | DONE | union_companies macro, all 18 views building |
| 1.3 | dbt warehouse models (6 dims + 6 facts) | DONE | Star schema, date spine 2024-2027, 96K dosage rows |
| 1.4 | dbt semantic models (8 materialized) | DONE | All 8 from production SQL queries |
| 1.5 | dbt snapshots (SCD2 on customer, tech) | DONE | snap_customer (6,673 rows), snap_tech |
| 1.6 | FastAPI backend | PENDING |
| 1.7 | Semantic layer on backend | PENDING |
| 1.8 | Query guardrails | PENDING |
| 1.9 | React frontend updated | PENDING |
| 1.10 | Metabase connected | PENDING |
| 1.11 | Cloudflare Access | PENDING |

## Phase 2-4: See design doc

---

## Key Findings

- **44 tables per database** (not 30 as documented in Skimmer-schema.sql — 14 additional tables in nightly extracts)
- **Bug found and fixed:** Raw table names needed company prefix to prevent cross-company overwrites
- **AQPS:** 189,873 rows across 44 tables
- **JOMO:** 522,394 rows across 44 tables
- **Smoke test script pipes:** Plan's original `check()` function needed `bash -c` wrapper for piped commands
- **Column name case sensitivity:** SQLite `SubTotal` → Postgres `Subtotal` (case matters in quoted identifiers)
- **WorkOrderType has `Description` not `Name`:** Schema differs from documentation assumptions
- **Shared memory:** Docker default 64MB shm insufficient for large dbt queries; increased to 256MB
- **dbt schema prefixing:** dbt creates schemas as `public_staging`, `public_warehouse`, `public_semantic` (profile schema + model schema)

---

## Blockers

- Step 0.2 (critical bug fixes) deferred — Dropbox token revocation + SQL injection fixes should be applied before any production deployment

## Pre-Production Hardening (after all functionality verified)

- [ ] Create `splashworks` system user on VPS, move file ownership
- [ ] Add to `docker` group, run Docker Compose as non-root
- [ ] Run cloudflared as non-root (systemd `User=` directive)
- [ ] Move cron to non-root user's crontab
- [ ] Ensure FastAPI/frontend containers run as non-root internally
- [ ] Review `.env` permissions and secrets management

---

## Session Log

| Date | Session | Work Done |
|------|---------|-----------|
| 2026-03-07 | Design | Codebase review, brainstorming, design doc approved |
| 2026-03-07 | Phase 0 implementation | Docker Compose, ETL package, real data load (712K rows), dbt scaffold, smoke tests — all passing |
| 2026-03-08 | VPS deployment | Docker + Postgres on VPS, rclone OneDrive sync (76MB synced, cron set), Cloudflare tunnel live (3 subdomains) |
| 2026-03-09 | Phase 1 Batch A | ETL on VPS (712K rows), 18 staging + 12 warehouse + 8 semantic models + 2 snapshots, dbt build 41/41 pass |
