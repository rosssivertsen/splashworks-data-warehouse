# Splashworks Data Warehouse MVP — Progress Tracker

**Design Doc:** [2026-03-07-data-warehouse-mvp-design.md](./2026-03-07-data-warehouse-mvp-design.md)
**Branch:** `feature/warehouse-etl`
**Last Updated:** 2026-03-10 (Semantic enrichment batch complete)

---

## Current Status

**Phase:** Semantic enrichment COMPLETE. UI refinements batch next.
**Status:** Phase 1 + semantic enrichment deployed. 15/15 E2E tests passing.
**Next:** UI refinements batch (starter prompts, dashboard charts, save/restore, export)
**Live:** app.splshwrks.com (frontend), api.splshwrks.com (API)
**Design Doc:** [2026-03-10-semantic-enrichment-design.md](./2026-03-10-semantic-enrichment-design.md)

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
| 1.6 | FastAPI backend | DONE | POST /api/query + GET /api/health, 22 unit tests, Docker container on VPS |
| 1.7 | Semantic layer on backend | DONE | YAML-loaded business terms + relationships feed Claude's system prompt |
| 1.8 | Query guardrails | DONE | SELECT-only validation, 10s timeout, 10K row limit, 12 validator tests |
| 1.9a | New API endpoints | DONE | POST /api/query/raw, GET /api/schema, GET /api/schema/dictionary — 14 unit tests |
| 1.9b | Clean-room React frontend | DONE | 4 views (AI Query, Explorer, Data, Dashboard), 6 shared components, all TypeScript — 47 unit tests |
| 1.9c | Nginx container | DONE | Multi-stage Docker build, API proxy, static serving |
| 1.9d | E2E tests | DONE | Smoke (active customer count) + Acid (chemical drill-down) — 8 tests |
| 1.10 | Metabase connected | DEFERRED | Backlog — React dashboard validates data layer first |
| 1.11 | Cloudflare Access | DEFERRED | Backlog — no external users during MVP |

## Interstitial: Semantic Enrichment

| Step | Deliverable | Status |
|------|-------------|--------|
| SE.1 | Semantic layer YAML rewrite (16 business terms, 8 verified queries) | DONE |
| SE.2 | System prompt builder update (tables, metrics, data gaps, join clauses) | DONE |
| SE.3 | dim_pool warehouse model (7,049 rows) | DONE |
| SE.4 | fact_service_stop warehouse model (69,030 rows) | DONE |
| SE.5 | fact_payment warehouse model (12,135 rows) | DONE |
| SE.6 | semantic_profit semantic model (16,935 rows) | DONE |
| SE.7 | E2E enrichment tests (7 tests) | DONE |
| SE.8 | VPS deployment + validation (15/15 E2E passing) | DONE |

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
- **Docker Compose restart vs up:** `docker compose restart` does NOT re-read `.env` — must use `docker compose up -d` to refresh environment variables
- **Layer switching validation:** Warehouse and staging return identical active customer counts (AQPS: 859, JOMO: 2,402) — confirms dbt models are correct

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
| 2026-03-09 | Phase 1 Batch B | FastAPI backend: 2 endpoints, 22 unit tests + 4 integration tests, Docker container on VPS, Cloudflare tunnel live, layer switching validated |
| 2026-03-10 | Phase 1 Batch C | Clean-room React frontend: 3 new API endpoints (14 tests), 4 views + 6 components (47 tests), Nginx container, E2E tests (8 tests), frontend swap complete |
| 2026-03-10 | VPS Deploy | Batch C deployed: 3 Docker containers (postgres, api, frontend), 8/8 E2E tests passing, app.splshwrks.com live. Fixed: cross-platform Docker build, exception detail leakage, connection leaks, E2E test column names |
| 2026-03-10 | Semantic Research | Scraped Skimmer help docs (17 reports, 7 categories). Gap analysis: 46% warehouse coverage, critical gaps in pools, service stops, payments, profit. Design approved for interstitial semantic enrichment batch: YAML rewrite + 4 dbt models (dim_pool, fact_service_stop, fact_payment, semantic_profit) |
| 2026-03-10 | Semantic Enrichment | YAML rewrite (16 terms, 8 queries), system prompt update, 4 dbt models (dim_pool 7K, fact_service_stop 69K, fact_payment 12K, semantic_profit 17K), 7 E2E tests, deployed to VPS — 15/15 E2E passing. "Pools > 10000 gallons" query now works. |
