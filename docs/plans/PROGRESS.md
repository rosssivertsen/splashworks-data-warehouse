# Splashworks Data Warehouse MVP — Progress Tracker

**Design Doc:** [2026-03-07-data-warehouse-mvp-design.md](./2026-03-07-data-warehouse-mvp-design.md)
**Branch:** `feature/warehouse-etl`
**Last Updated:** 2026-03-07

---

## Current Status

**Phase:** 0 — Foundation
**Status:** COMPLETE (local development)
**Next:** Phase 0 remaining items (VPS deployment, rclone, Cloudflare tunnel) then Phase 1

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
| 0.8 | VPS setup: Docker on VPS | PENDING | srv1317522.hstgr.cloud |
| 0.9 | rclone configured for OneDrive | PENDING | |
| 0.10 | Cloudflare tunnel live | PENDING | splshwrks.com |

## Phase 1: Crawl (Week 3-6)

| Step | Deliverable | Status |
|------|-------------|--------|
| 1.1 | ETL automated on VPS (cron) | PENDING |
| 1.2 | dbt staging models (all tables) | PENDING |
| 1.3 | dbt warehouse models (dims + facts) | PENDING |
| 1.4 | dbt semantic models (materialized KPIs) | PENDING |
| 1.5 | dbt snapshots (SCD2 on customer, tech) | PENDING |
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

---

## Blockers

- Step 0.2 (critical bug fixes) deferred — Dropbox token revocation + SQL injection fixes should be applied before any production deployment

---

## Session Log

| Date | Session | Work Done |
|------|---------|-----------|
| 2026-03-07 | Design | Codebase review, brainstorming, design doc approved |
| 2026-03-07 | Phase 0 implementation | Docker Compose, ETL package, real data load (712K rows), dbt scaffold, smoke tests — all passing |
