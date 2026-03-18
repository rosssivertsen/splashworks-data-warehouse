# Splashworks Data Warehouse MVP — Progress Tracker

**Design Doc:** [2026-03-07-data-warehouse-mvp-design.md](./2026-03-07-data-warehouse-mvp-design.md)
**Branch:** `feature/warehouse-etl`
**Backlog:** [BACKLOG.md](./BACKLOG.md)
**Last Updated:** 2026-03-18

---

## Current Status

**Phase:** Phase 1 + Semantic Enrichment + UI Refinements + AI Query Intelligence + IN-4 COMPLETE. All deployed.
**Status:** 6 Docker services, Cloudflare Access, 73 frontend + 66 API unit + 16 E2E tests.
**Streams:** Data Layer (DL), AI Query (AQ), Enterprise Info Architecture (EIA), Dashboard (DA), Infrastructure (IN)
**Next:** DL-5 (rpt_profitability), ETL-4 (equipment tables), EIA-1/EIA-2 (agent-ready docs)
**Live:** app.splshwrks.com (frontend), api.splshwrks.com (API), bi.splshwrks.com (Metabase)

---

## Phase 0: Foundation

| Step | Deliverable | Status | Notes |
|------|-------------|--------|-------|
| 0.1 | Create branch, commit design doc | DONE | Branch `feature/warehouse-etl` created |
| 0.2 | Fix critical bugs (Dropbox token, SQL injection) | PENDING | Deferred — see BACKLOG.md LF-1 |
| 0.3 | Docker Compose + Postgres (local) | DONE | pgvector/pgvector:pg16, all schemas created |
| 0.4 | Python ETL package | DONE | 6 extract tests passing, real data validated |
| 0.5 | ETL real data test | DONE | 712,267 rows loaded (44 tables x 2 companies), checksum skip verified |
| 0.6 | dbt project scaffolded | DONE | debug passes, company_lookup seed loaded |
| 0.7 | Smoke test script | DONE | 7/7 checks passing |
| 0.8 | VPS setup: Docker on VPS | DONE | Docker 29.3.0, Postgres 16+pgvector healthy, all schemas created |
| 0.9 | rclone configured for OneDrive | DONE | Both extracts synced (76MB), nightly cron 1AM UTC |
| 0.10 | Cloudflare tunnel live | DONE | 3 subdomains routed, systemd service |

## Phase 1: Crawl

| Step | Deliverable | Status |
|------|-------------|--------|
| 1.1 | ETL on VPS + current views | DONE |
| 1.2 | dbt staging models (18 tables) | DONE |
| 1.3 | dbt warehouse models (6 dims + 6 facts) | DONE |
| 1.4 | dbt semantic models (8 materialized) | DONE |
| 1.5 | dbt snapshots (SCD2 on customer, tech) | DONE |
| 1.6 | FastAPI backend | DONE |
| 1.7 | Semantic layer on backend | DONE |
| 1.8 | Query guardrails | DONE |
| 1.9a | New API endpoints | DONE |
| 1.9b | Clean-room React frontend | DONE |
| 1.9c | Nginx container | DONE |
| 1.9d | E2E tests | DONE |
| 1.10 | Metabase connected | DONE |
| 1.11 | Cloudflare Access | DONE |

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

## Interstitial: UI Refinements

| Step | Deliverable | Status |
|------|-------------|--------|
| UI.1 | GET /api/prompts endpoint (starter questions from YAML) | DONE |
| UI.2 | ApiClient + TypeScript types (PromptsResponse, Dashboard, ChartType) | DONE |
| UI.3 | StarterPrompts component (clickable pills, 3 tests) | DONE |
| UI.4 | Wire StarterPrompts into QueryView (shown before first query) | DONE |
| UI.5 | useDashboards hook (named CRUD + localStorage, 9 tests) | DONE |
| UI.6 | ChartCard component (ECharts + type switching + column mapping, 5 tests) | DONE |
| UI.7 | DashboardView rewrite (named dashboards, sample dashboard, screenshot) | DONE |
| UI.8 | Add to Dashboard from QueryView and DataView (lifted hook to App) | DONE |
| UI.9 | Frontend test updates (65/65 passing) | DONE |
| UI.10 | E2E test for /api/prompts endpoint | DONE |
| UI.11 | Build + deploy to VPS | DONE |

## Interstitial: AI Query Intelligence (AQ-4/5/6/DL-1)

| Step | Deliverable | Status |
|------|-------------|--------|
| AQ-5 | Few-shot examples — 13 verified queries in system prompt | DONE |
| AQ-6 | ETL cron automation — nightly-pipeline.sh (sync → ETL → dbt → health) | DONE |
| DL-1 | dim_service_location — address column, updated system prompt | DONE |
| AQ-7a | SQL repair layer v1 (GROUP BY + type cast auto-fix) | DONE |
| DL-8 | Route assignment semantics (stg_route_assignment + system prompt) | DONE |
| DL-9 | Customer lifecycle semantics (cancelled/new customer terms) | DONE |
| AQ-4.1 | Industry metrics YAML (20 metrics: 12 answerable, 8 unanswerable) | DONE |
| AQ-4.2 | Query rewriter service (Haiku preprocessing + confidence classification) | DONE |
| AQ-4.3 | Response model + ai_service + schema_context updates | DONE |
| AQ-4.4 | Rewriter wired into query pipeline + improved error messages | DONE |
| AQ-4.5 | ConfidenceBadge component (green Verified / yellow Best effort) | DONE |
| AQ-4.6 | UnansweredPanel component (blue info panel with partial-answer hints) | DONE |
| AQ-4.7 | QueryView wiring + ApiClient structured error handling | DONE |
| AQ-4.8 | Deploy + verify on VPS (all 3 confidence paths confirmed working) | DONE |

## Interstitial: Authentication + BI Tools

| Step | Deliverable | Status |
|------|-------------|--------|
| AUTH.1 | Cloudflare Access application (app + api + bi subdomains) | DONE |
| AUTH.2 | Login methods: GitHub OAuth + Google OAuth + email OTP | DONE |
| AUTH.3 | Policy: allow specific email addresses only | DONE |
| BI.1 | Metabase CE Docker container | DONE |
| BI.2 | Metabase connected to Postgres warehouse | DONE |
| BI.3 | Staging schema fallback for AI queries | DONE |
| BI.4 | Anti-hallucination system prompt rules | DONE |

## Data Layer Reports

| Step | Deliverable | Status |
|------|-------------|--------|
| DL-2 | rpt_customer_360 — denormalized customer + service stats + payments + LTV | DONE |
| DL-3 | rpt_service_history — denormalized service visits with names + addresses (69,186 rows) | DONE |
| DL-4 | rpt_payment_summary — denormalized payments with customer names + invoice details (12,247 rows) | DONE |

## Data Layer — New Fact Tables (2026-03-18)

| Step | Deliverable | Status |
|------|-------------|--------|
| DL-10 | fact_invoice_item — line-item grain, product mix analysis, all invoice statuses (16,517 rows) | DONE |
| DL-11 | fact_route_skip — unified day-of + pre-planned skips with reasons (806 rows) | DONE |
| DL-12 | fact_route_move — schedule changes with move_type classification (3,510 rows) | DONE |
| — | stg_route_skip, stg_skipped_stop_reason, stg_route_move staging models | DONE |
| — | stg_route_stop enhanced — added is_skipped, skipped_stop_reason_id, route_assignment_id, route_move_id | DONE |
| — | _sources.yml — added RouteSkip, RouteMove, SkippedStopReason (both companies) | DONE |

## ETL — Historical Accumulation (2026-03-18)

| Step | Deliverable | Status |
|------|-------------|--------|
| ETL-1 | All 10 fact tables switched to `incremental` materialization with unique dedup keys | DONE |
| — | Fixed missing `_company_name` on cross-table joins in 6 fact tables (pre-existing bug) | DONE |
| — | Added `service_stop_entry_id` to fact_dosage, fact_dosage_gallons, fact_work_order_dosage | DONE |

## Infrastructure

| Step | Deliverable | Status |
|------|-------------|--------|
| IN-4 | query_audit_log — Postgres audit trail for all /api/query and /api/query/raw requests | DONE |

## Enterprise Information Architecture (v1.0 — 2026-03-14)

| Step | Deliverable | Status |
|------|-------------|--------|
| EIA-0.1 | Design spec + implementation plan | DONE |
| EIA-0.2 | System landscape diagram (Mermaid, versioned) | DONE |
| EIA-0.3 | Glossary entities: Customer, Contact, Service Location, Pool | DONE |
| EIA-0.4 | Naming conventions standard | DONE |
| EIA-0.5 | QBO Accounting + Payments API references | DONE |
| EIA-0.6 | Enterprise CLAUDE.md (context isolation) | DONE |
| EIA-0.7 | Root CLAUDE.md pointer | DONE |

---

## Key Findings

- **ETL loads ALL 44 tables** — RouteSkip, RouteMove, SkippedStopReason were already in raw Postgres
- **`dbt run --full-refresh` on facts destroys accumulated history** — nightly cron uses plain `dbt run` (safe)
- **44 tables per database** (not 30 as documented — 14 additional tables in nightly extracts)
- **712K total rows:** AQPS 189,873 + JOMO 522,394 across 44 tables each
- **Column name case sensitivity:** SQLite `SubTotal` → Postgres `Subtotal`
- **Shared memory:** Docker default 64MB shm insufficient for dbt; increased to 256MB
- **dbt schema prefixing:** `public_staging`, `public_warehouse`, `public_semantic`
- **Docker Compose restart vs up:** `restart` does NOT re-read `.env` — use `up -d`
- **Date columns are TEXT:** No DATE_TRUNC/CURRENT_DATE — use ISO string comparisons
- **AI hallucination:** Must tell AI "only reference tables in the Available Tables list"
- **Cloudflare tunnel:** Locally configured (not dashboard-managed); edit `/etc/cloudflared/config.yml`
