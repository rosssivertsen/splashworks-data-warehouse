# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**Name:** Splashworks Data Warehouse
**Repo:** `rosssivertsen/splashworks-data-warehouse`
**Purpose:** AI-powered natural language → SQL query tool over a Postgres data warehouse built from nightly Skimmer database extracts
**Stack:** React + TypeScript (Vite, Tailwind CSS), FastAPI (Python), Postgres 16 + pgvector, dbt, Docker Compose, Cloudflare Tunnels
**Hosting:** Hostinger VPS (76.13.29.44), Ubuntu 24.04

## Commands

```bash
# Frontend (local dev)
npm run dev:vite     # Vite dev server
npm run build        # TypeScript check + production build
npm run test         # Run Vitest test suite (65 frontend tests)
npm run lint         # ESLint

# API (local dev)
cd api && python -m uvicorn main:app --reload --port 8080

# Docker (production)
docker compose up -d                    # Start all services
docker compose -f docker-compose.staging.yml up -d  # Start staging services

# dbt (on VPS)
cd dbt && dbt run                       # Run all models
cd dbt && dbt run --select staging      # Run staging models only

# ETL
./cli/load-extract.sh                   # Load nightly extract from OneDrive (local)
etl/scripts/nightly-pipeline.sh         # Full pipeline: sync → ETL → dbt → health (VPS cron)
```

## Architecture

- **Frontend:** React + TypeScript SPA (`src/`), served via Nginx in Docker
- **API:** FastAPI (`api/`) — AI-powered SQL generation, query execution against Postgres
- **AI Layer:** Claude Sonnet for SQL generation (`api/services/ai_service.py`)
- **Database:** Postgres 16 with pgvector (`infrastructure/postgres/`)
- **ETL:** Python pipeline (`etl/`) — SQLite → Postgres, checksum-based change detection
- **Transformation:** dbt (`dbt/`) — staging → warehouse → semantic layers
- **Deployment:** Docker Compose on VPS, Cloudflare Tunnels for HTTPS
- **Auth:** Cloudflare Access (GitHub OAuth + Google OAuth + email OTP)

## Live Endpoints

| URL | Service |
|-----|---------|
| `app.splshwrks.com` | React frontend |
| `api.splshwrks.com` | FastAPI backend |
| `bi.splshwrks.com` | Metabase BI |

## Data Sources

Nightly extract from Skimmer (pool service management SaaS), trailing 6-month period. Two company entities:

| Database | Company | CompanyId |
|----------|---------|-----------|
| `AQPS.db` | A Quality Pool Service of Central Florida, Inc. | `e265c9dee47c47c6a73f689b0df467ca` |
| `JOMO.db` | Jomo Pool Service | `95d37a64d1794a1caef111e801db5477` |

## Key Documentation

| File | Purpose |
|------|---------|
| `docs/skimmer-semantic-layer.yaml` | Business terms, SQL patterns, join paths, verified queries |
| `docs/DATA_DICTIONARY.md` | Full field-level documentation for all 30 tables |
| `docs/ERD.md` + `.svg/.png` | Entity relationship diagrams |
| `docs/plans/BACKLOG.md` | Prioritized backlog |
| `docs/plans/PROGRESS.md` | Implementation progress tracker |

## Database Schema — Key Tables

**dbt layers:** `public_staging` → `public_warehouse` → `public_semantic`

**Warehouse dimensions:**
- `dim_customer` — lifecycle columns: `created_at`, `updated_at`, `is_inactive`, `deleted`
- `dim_service_location` — `address`, `city`, `state`, `zip`, `rate`, `labor_cost`
- `dim_pool` — body of water, gallons
- `dim_tech`, `dim_date`, `dim_route_assignment`

**Warehouse facts:**
- `fact_service_stop` — per-visit records with chemical readings
- `fact_invoice`, `fact_payment`

**Semantic models:**
- `semantic_profit` — rate - labor_cost - dosage_cost

**Key constraints:**
- **Active customer filter:** `is_inactive = 0 AND deleted = 0` (BOTH required)
- **Cancelled customer:** `is_inactive = 1 OR deleted = 1`, use `updated_at` as cancellation date
- **Date columns are TEXT** in fact tables — use string comparisons, NOT date functions
- **dim_date.date_key is DATE** — cast fact dates when joining: `fss.service_date::date = d.date_key`
- **Join facts to dims on BOTH ID AND `_company_name`**

**Key join path (customer → chemical history):**
```sql
dim_customer c
  JOIN dim_service_location sl ON c.customer_id = sl.customer_id AND c._company_name = sl._company_name
  JOIN dim_pool p ON sl.service_location_id = p.service_location_id AND sl._company_name = p._company_name
  JOIN fact_service_stop fss ON p.pool_id = fss.pool_id AND p._company_name = fss._company_name
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/query` | AI-powered natural language → SQL |
| POST | `/api/query/raw` | Execute raw SQL |
| GET | `/api/health` | Health check |
| GET | `/api/schema` | Schema info |
| GET | `/api/schema/dictionary` | Data dictionary |
| GET | `/api/prompts` | Starter prompt suggestions |

## Ad Hoc Query Workflow

For quick, interactive queries against nightly Skimmer extracts using Claude Code locally.

### Nightly extract source

Extracts sync via OneDrive to:
```
/Users/rosssivertsen/Library/CloudStorage/OneDrive-Splashworks/Skimmer User's files - Splashworks/Skimmer Nightly Extract/
```

### Loading and querying locally

```bash
./cli/load-extract.sh           # Load from OneDrive (default)
./cli/load-extract.sh status    # Show currently loaded databases
```

Ask Claude Code directly — it will use `sqlite3` against the databases in `data/`.

### Cross-database queries

```sql
sqlite3 data/AQPS.db "ATTACH 'data/JOMO.db' AS jomo; SELECT 'AQPS' AS company, COUNT(*) FROM Customer WHERE IsInactive=0 AND Deleted=0 UNION ALL SELECT 'JOMO', COUNT(*) FROM jomo.Customer WHERE IsInactive=0 AND Deleted=0;"
```

## VPS Operations

```bash
ssh root@76.13.29.44              # SSH (key: ~/.ssh/id_ed25519, has passphrase)
# Repo at /opt/splashworks/
docker compose ps                  # Check service status
docker compose logs -f api         # Tail API logs
docker compose restart api         # Restart a service (reads existing env)
docker compose up -d               # Recreate services (re-reads .env)
```

## Related Project

**CRM → Skimmer POC** (`../CRMtoSkimmer/crm-to-skimmer-poc`) — Zoho CRM ↔ Skimmer bi-directional sync. Uses the same Skimmer schema.
