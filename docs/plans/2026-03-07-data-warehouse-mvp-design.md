# Splashworks Data Warehouse MVP — Design Document

**Author:** Ross Sivertsen + Claude Opus 4.6
**Date:** 2026-03-07
**Status:** APPROVED
**Branch:** `feature/warehouse-etl` (to be created from `development`)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Data Model](#3-data-model)
4. [ETL Pipeline & dbt Project](#4-etl-pipeline--dbt-project)
5. [API Server & Frontend Evolution](#5-api-server--frontend-evolution)
6. [Infrastructure](#6-infrastructure)
7. [Testing Strategy](#7-testing-strategy)
8. [Phased Implementation Roadmap](#8-phased-implementation-roadmap)
9. [Project Workflow & Advisory Council](#9-project-workflow--advisory-council)
10. [Future State Data Model](#10-future-state-data-model)
11. [Appendix: Decisions Log](#11-appendix-decisions-log)

---

## 1. Executive Summary

This project transforms the Splashworks Pool Service BI Visualizer from a client-side SQLite query tool into a full data warehouse platform with:

- **Automated nightly ETL** from Skimmer SQLite dumps into PostgreSQL
- **Star schema warehouse** modeled in dbt, aligned with existing production Power BI queries
- **Enhanced AI query layer** with server-side semantic context and query guardrails
- **Standard BI dashboards** via Metabase
- **Agentic AI roadmap** from enhanced NL-to-SQL (crawl) through proactive analytics (walk) to interactive agents with RAG and forecasting (run)

### Guiding Principles

1. **Build the data + knowledge foundation once, deploy agents on top many times.** The warehouse and semantic layer are the shared platform; AI agents are consumers.
2. **Don't paint into a corner.** Every technology choice has a clear upgrade path.
3. **Crawl, walk, run.** Start with an enhanced version of what exists, layer intelligence over time.
4. **Rigorous self-testing at every step.** Nothing advances until validation checklists pass.

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Warehouse | PostgreSQL 16 + pgvector | Universal, collaborator-friendly, pgvector for future RAG |
| Transforms | dbt-postgres | Warehouse-portable, version-controlled, built-in testing |
| BI Layer | Metabase (self-hosted) | Free, connects to Postgres, clean dashboards |
| AI Backend | FastAPI (Python) | Same language as ETL/dbt, async, typed |
| Frontend | React (evolved from current app) | Preserve domain knowledge, shed in-browser SQLite |
| Infrastructure | Single Hostinger KVM-2 VPS, Docker Compose | Already paid for 2 years, 8GB RAM, 100GB disk |
| Networking | Cloudflare Tunnels + Access | No open ports, auto-SSL, email-based auth for demos |
| Primary data source | Skimmer nightly SQLite dumps via OneDrive | Robust, full dataset, API deferred for incremental use |
| Domain | splshwrks.com (DNS via Cloudflare) | Already configured |

---

## 2. System Architecture

```
+---------------------------------------------------------------+
|                    SOURCE SYSTEMS LAYER                         |
|  +----------------+  +----------------+  +-----------+         |
|  | Skimmer        |  | QuickBooks     |  | Future:   |         |
|  | (nightly       |  | Online         |  | Zoho CRM  |         |
|  |  SQLite dumps) |  | (Phase 2)      |  | Xima CC   |         |
|  +-------+--------+  +----------------+  | GPS/Fleet |         |
+----------|-----------+-------------------+-----------+---------+
           |  OneDrive sync via rclone (cron)
           v
+---------------------------------------------------------------+
|     HOSTINGER KVM-2 (srv1317522.hstgr.cloud, 76.13.29.44)     |
|     Docker Compose - all services on one box                    |
|                                                                 |
|  +- INGESTION & STAGING ------------------------------------+  |
|  |  Python ETL (cron, nightly)                               |  |
|  |  - rclone syncs .db.gz from OneDrive                      |  |
|  |  - Decompress, read SQLite tables                         |  |
|  |  - COPY to raw_skimmer schema (date-stamped)              |  |
|  |  - Checksum comparison for skip optimization              |  |
|  |  - Data quality checks + alerts                           |  |
|  +---------------------------+-------------------------------+  |
|                              v                                  |
|  +- DATA WAREHOUSE ------------------------------------------+  |
|  |  PostgreSQL 16 + pgvector                                  |  |
|  |                                                             |  |
|  |  raw_skimmer.*    (landing zone, date-partitioned)         |  |
|  |  staging.*        (cleaned, deduped by dbt)                |  |
|  |  warehouse.*      (star schema: dims + facts)              |  |
|  |  semantic.*       (materialized metrics, KPIs)             |  |
|  |  vectors.*        (pgvector embeddings, future)            |  |
|  +---------------------------+-------------------------------+  |
|                              v                                  |
|  +- TRANSFORM (dbt) -----------------------------------------+  |
|  |  raw -> staging -> warehouse -> semantic                    |  |
|  |  Runs after ETL via cron                                    |  |
|  |  Dimensions: customer, service_location, tech, chemical,    |  |
|  |              company, date                                  |  |
|  |  Facts: labor, dosage, work_order, work_order_dosage,       |  |
|  |         invoice, dosage_gallons                             |  |
|  +---------------------------+-------------------------------+  |
|                              v                                  |
|  +- APPLICATION LAYER ---------------------------------------+  |
|  |                                                             |  |
|  |  FastAPI          <- React SPA queries here                 |  |
|  |  - NL->SQL (AI proxy + semantic layer)                      |  |
|  |  - Query execution with guardrails                          |  |
|  |  - Auth (Cloudflare Access JWTs)                            |  |
|  |  - Dashboard CRUD                                           |  |
|  |  - Future: agent endpoints                                  |  |
|  |                                                             |  |
|  |  Metabase         <- Standard BI dashboards                 |  |
|  |  - Tier 1: Daily Pulse                                      |  |
|  |  - Tier 2: Weekly Performance                               |  |
|  |  - Tier 3: Monthly Health                                   |  |
|  |                                                             |  |
|  |  React SPA        <- AI query + agent interface             |  |
|  |  - No more in-browser SQLite                                |  |
|  |  - All queries via /api                                     |  |
|  |                                                             |  |
|  |  cloudflared      <- Tunnels to Cloudflare edge             |  |
|  |  - app.splshwrks.com  -> React SPA                          |  |
|  |  - api.splshwrks.com  -> FastAPI                            |  |
|  |  - bi.splshwrks.com   -> Metabase                           |  |
|  +-------------------------------------------------------------+  |
+-----------------------------------------------------------------+
```

### Service Map

| Subdomain | Service | Port | Access |
|-----------|---------|------|--------|
| `app.splshwrks.com` | React SPA (AI query layer) | 3001 | Cloudflare Access (team + demo) |
| `api.splshwrks.com` | FastAPI (warehouse queries, AI proxy) | 8080 | Cloudflare Access / service tokens |
| `bi.splshwrks.com` | Metabase (BI dashboards) | 3000 | Metabase auth + Cloudflare Access |

All ports bind to 127.0.0.1 — no direct internet exposure. Cloudflare Tunnels provide the only ingress path.

---

## 3. Data Model

### 3.1 Production-Aligned Star Schema (Implementation Target)

Translated directly from the validated SQL-Semantic-Queries used by the production Power BI dashboard.

#### Dimension Tables

| dbt Model | Source Query | Key Columns | Notes |
|-----------|-------------|-------------|-------|
| `dim_customer` | `DimCustomerDetails_v2` | customer_id, name, billing_address, city, state, zip, is_active, company_id | SCD Type 2 (valid_from, valid_to, is_current) |
| `dim_service_location` | `DimServiceLocation` | location_id, customer_id, city, state, zip | Add pool_count, total_gallons from Pool join |
| `dim_tech` | `DimTechDetails_v2` | tech_id, name, role_type, is_active, company_id | SCD Type 2 for role/active changes |
| `dim_company` | Derived from CompanyId | company_id, company_name | Static: AQPS (e265c9...) and JOMO (95d37a...) |
| `dim_date` | Generated | date_key, day, week, month, quarter, year, season | Standard date spine |
| `dim_chemical` | EntryDescription table | chemical_id, description, entry_type, unit_of_measure, category | Categorized by ReadingType/DosageType |

#### Fact Tables

| dbt Model | Source Query | Grain | Key Measures |
|-----------|-------------|-------|--------------|
| `fact_labor` | `FactLabor_v2` | Per service stop | minutes_at_stop, rate, labor_cost, service_status |
| `fact_dosage` | `FactDosage_v2` | Per dosage per stop | entry_value, dosage_cost, dosage_price |
| `fact_work_order` | `FactWorkOrder_v2` | Per work order | labor_cost, price, service_status |
| `fact_work_order_dosage` | `FactWorkOrderDosage` | Per work order dosage | dosage_cost, dosage_price |
| `fact_invoice` | `02.CustomerInvoiceDetails` | Per invoice line item | quantity, rate, line_total, sub_total |
| `fact_dosage_gallons` | `DosageGallons` | Per dosage with pool context | pool_gallons, dosage_value, cost, price |

#### Semantic Materialized Views

| dbt Model | Source Query | Purpose |
|-----------|-------------|---------|
| `semantic.service_completion` | `Mapping_ServiceDate_v2` | Service date status by tech |
| `semantic.completed_vs_not` | `Mapping_CompletedVsNotCompletedStops` | Completion with dosage context |
| `semantic.tech_monthly_volume` | `MappingServiceDatePerMontPerTech` | Stops per month per tech |
| `semantic.utilization_rate` | `UtilizationRate` | RouteStop + WorkOrder union |
| `semantic.customer_tags` | `InvoiceCustomerTag` | Customer tagging (Russell's vs AQPS) |
| `semantic.labor_recon` | `AQPSLaborQARecon` | Labor cost reconciliation |
| `semantic.invoice_summary` | `QBO_JOMO_Invoice` | Invoice totals by customer/month |
| `semantic.service_invoices` | `ServiceDate_Invoices` | Service completion with invoice context |

#### Key Business Logic (preserved from production queries)

**Service completion detection:**
```sql
-- Sentinel value: '2010-01-01 12:00:00' means NOT completed
CASE
  WHEN StartTime != '2010-01-01 12:00:00'
   AND CompleteTime != '2010-01-01 12:00:00'
  THEN 1 ELSE 0
END AS service_status
```

**Dosage cost/price calculation:**
```sql
-- From FactDosage_v2
DosageCost = ServiceStopEntryValue * EntryDescription.Cost
DosagePrice = ServiceStopEntryValue * EntryDescription.Price
```

**Customer name cleaning:**
```sql
REPLACE(REPLACE(FirstName || ' ' || LastName, CHAR(10), ''), CHAR(13), '')
```

### 3.2 Postgres Schema Layout

```
raw_skimmer              -- Nightly SQLite dump, date-partitioned
  customer_20260307      -- All 30 Skimmer tables x nightly load
  service_stop_20260307
  ...

staging                  -- dbt: cleaned, typed, deduped
  stg_customer
  stg_service_stop
  ...

warehouse                -- dbt: star schema
  dim_customer (SCD2)
  dim_service_location
  dim_tech (SCD2)
  dim_company
  dim_date
  dim_chemical
  fact_labor
  fact_dosage
  fact_work_order
  fact_work_order_dosage
  fact_invoice
  fact_dosage_gallons

semantic                 -- dbt: materialized KPIs & report views
  service_completion
  completed_vs_not
  tech_monthly_volume
  utilization_rate
  customer_tags
  labor_recon
  invoice_summary
  service_invoices

vectors                  -- pgvector: embeddings (future)
```

### 3.3 Nightly Load Flow

```
Night N (e.g., 2026-03-07):
  SQLite dump -> raw_skimmer.customer_20260307
                 raw_skimmer.service_stop_20260307
                 ... (all 30 tables, date-stamped)

  dbt snapshot (SCD2):
    Compare stg_customer (from today's raw) vs yesterday's snapshot
    -> New customers:     INSERT with valid_from = today
    -> Changed customers: Close old row (valid_to = today), INSERT new
    -> Deleted customers: Close old row (valid_to = today)
    -> Unchanged:         No action

  Facts are append-only:
    New service stops from today's extract -> INSERT into fact_labor, etc.
    Deduplication by primary key prevents double-counting
```

---

## 4. ETL Pipeline & dbt Project

### 4.1 Nightly ETL Flow

```
OneDrive (Skimmer deposits nightly)
  e265c9dee47c47c6a73f689b0df467ca.db.gz  (AQPS)
  95d37a64d1794a1caef111e801db5477.db.gz  (JOMO)
      |
      |  rclone sync (cron, 2:00 AM ET)
      v
VPS: /data/extracts/
  AQPS.db.gz
  JOMO.db.gz
      |
      |  Python ETL (cron, 2:30 AM ET)
      v
ETL Steps:
  1. Decompress .db.gz -> .db
  2. For each db (AQPS, JOMO):
     a. Open SQLite, read all 30 tables
     b. COPY to raw_skimmer.{table}_{date} in Postgres
     c. Checksum comparison with previous load (skip unchanged)
  3. Log metadata (tables, row counts, duration)
  4. Trigger dbt run
  5. Cleanup decompressed .db files
```

### 4.2 ETL Script Structure

```
etl/
  __init__.py
  config.py               -- DB connections, file paths, company mappings
  extract.py              -- Decompress + read SQLite tables
  load.py                 -- COPY to Postgres raw schema
  checksums.py            -- Table-level checksums for skip optimization
  metadata.py             -- Load logging (run_id, timestamps, row counts)
  main.py                 -- Orchestrator: extract -> load -> trigger dbt
```

### 4.3 Company ID Mapping

| Company | CompanyId (UUID) | Friendly Name |
|---------|-----------------|---------------|
| AQPS | `e265c9dee47c47c6a73f689b0df467ca` | A Quality Pool Service of Central Florida, Inc. |
| JOMO | `95d37a64d1794a1caef111e801db5477` | Jomo Pool Service |

### 4.4 dbt Project Structure

```
dbt/
  dbt_project.yml
  profiles.yml                    (Postgres connection, gitignored)
  packages.yml                    (dbt-utils, dbt-date-spine)

  macros/
    service_completion.sql        -- Sentinel-value logic as reusable macro
    dosage_cost.sql               -- Cost/price calculation
    clean_customer_name.sql       -- REPLACE(REPLACE(...)) logic

  models/
    staging/                      -- 1:1 with raw tables, light cleaning
      _staging.yml                -- Source definitions + tests
      stg_customer.sql
      stg_service_location.sql
      stg_service_stop.sql
      stg_route_stop.sql
      stg_service_stop_entry.sql
      stg_entry_description.sql
      stg_account.sql
      stg_pool.sql
      stg_work_order.sql
      stg_invoice.sql
      stg_invoice_item.sql
      stg_invoice_location.sql
      stg_product.sql
      stg_customer_tag.sql
      stg_tag.sql

    warehouse/                    -- Star schema
      _warehouse.yml              -- Column docs + tests
      dim_customer.sql            -- SCD2, from DimCustomerDetails_v2
      dim_service_location.sql
      dim_tech.sql                -- SCD2, from DimTechDetails_v2
      dim_company.sql
      dim_date.sql                -- Generated date spine
      dim_chemical.sql
      fact_labor.sql              -- From FactLabor_v2
      fact_dosage.sql             -- From FactDosage_v2
      fact_work_order.sql         -- From FactWorkOrder_v2
      fact_work_order_dosage.sql
      fact_invoice.sql            -- From 02.CustomerInvoiceDetails
      fact_dosage_gallons.sql

    semantic/                     -- Materialized KPIs & report views
      _semantic.yml
      service_completion.sql
      completed_vs_not.sql
      tech_monthly_volume.sql
      utilization_rate.sql
      customer_tags.sql
      labor_recon.sql
      invoice_summary.sql
      service_invoices.sql

  seeds/
    company_lookup.csv            -- CompanyId -> friendly names

  tests/
    assert_no_orphan_service_stops.sql
    assert_positive_dosage_cost.sql
    assert_completion_status_valid.sql

  snapshots/
    snap_customer.sql             -- SCD2 snapshot for dim_customer
    snap_tech.sql                 -- SCD2 snapshot for dim_tech
```

### 4.5 Future Source Integration Pattern

```
etl/
  sources/
    skimmer.py            -- SQLite dump -> raw_skimmer (Phase 1)
    quickbooks.py         -- QBO API -> raw_quickbooks (Phase 2)
    zoho_crm.py           -- Zoho API -> raw_zoho (Phase 3)
    xima.py               -- Contact center -> raw_xima (Phase 3)

dbt/models/
  staging/
    skimmer/              -- stg_customer, stg_service_stop, ...
    quickbooks/           -- stg_qbo_invoice, stg_qbo_payment, ...
    zoho/                 -- stg_contact, stg_deal, ...
  warehouse/              -- Shared dims + facts across all sources
  semantic/               -- KPIs that join across sources
```

Each new source gets its own raw schema and staging folder but feeds into the shared warehouse dimensions and facts.

### 4.6 Cron Schedule (VPS)

```cron
# Sync nightly extracts from OneDrive (2:00 AM ET)
0 2 * * * splashworks /opt/splashworks/scripts/sync-extracts.sh

# Run ETL: SQLite -> Postgres raw schema (2:30 AM ET)
30 2 * * * splashworks /opt/splashworks/scripts/run-etl.sh

# Run dbt transforms (3:00 AM ET)
0 3 * * * splashworks cd /opt/splashworks/dbt && dbt run --profiles-dir .

# Run dbt tests (3:15 AM ET)
15 3 * * * splashworks cd /opt/splashworks/dbt && dbt test --profiles-dir .
```

---

## 5. API Server & Frontend Evolution

### 5.1 FastAPI Backend

```
api/
  main.py                    -- FastAPI app, CORS, lifespan
  config.py                  -- Settings (DB URL, AI keys, domain)
  auth.py                    -- Cloudflare Access JWT validation

  routers/
    query.py                 -- POST /query (NL->SQL->results)
    schema.py                -- GET /schema (tables, columns, relationships)
    dashboards.py            -- CRUD for saved dashboards
    health.py                -- GET /health (DB connection, last ETL run)

  services/
    ai_service.py            -- Multi-provider AI (OpenAI, Anthropic)
    semantic_layer.py        -- YAML loader + context builder
    query_executor.py        -- Execute SQL against warehouse, format results
    schema_metadata.py       -- FK relationships, join paths

  models/
    requests.py              -- Pydantic models for API inputs
    responses.py             -- Pydantic models for API outputs
```

### 5.2 Key API Endpoints

```
POST /api/query
  Body: { "question": "How many active customers does AQPS have?" }
  Response: { "sql": "SELECT ...", "results": [...], "columns": [...], "explanation": "..." }

  Pipeline:
  1. Semantic layer builds context (YAML + schema metadata)
  2. AI provider generates SQL
  3. Validation gate (SELECT-only, no injection)
  4. Optimization gate (EXPLAIN pre-check, row limit, timeout)
  5. Execute against warehouse schema
  6. Return results as JSON

GET  /api/schema                -- All tables, relationships, business terms
GET  /api/schema/{table}        -- Columns, sample data, row count
GET  /api/dashboards            -- List saved dashboards
POST /api/dashboards            -- Create dashboard
PUT  /api/dashboards/{id}       -- Update dashboard
DELETE /api/dashboards/{id}     -- Delete dashboard
GET  /api/health                -- DB status, last ETL run, row counts
```

### 5.3 Query Guardrails Pipeline

```
User question
  -> Semantic layer context building
  -> AI generates SQL
  -> Validation gate
       - SELECT-only (reject DML/DDL)
       - No multi-statement (no semicolons outside quotes)
       - No prohibited keywords (DROP, ALTER, INSERT, UPDATE, DELETE)
  -> Optimization gate (Phase 1: basic, Phase 2: advanced)
       Phase 1 (MVP):
       - Row limit: wrap in SELECT * FROM (...) LIMIT 10000
       - Statement timeout: SET statement_timeout = '10s'
       - EXPLAIN pre-check: reject queries above cost threshold
       Phase 2:
       - AST-based JOIN validation (catch cartesian products)
       - Index hint injection for known-indexed columns
       - AI second-pass rewrite for expensive queries
  -> Execution with timeout
  -> Results returned
```

### 5.4 React Frontend Changes

#### Removed (moves to backend or becomes unnecessary)

| Component | Reason |
|-----------|--------|
| `useDatabase.js` (sql.js, IndexedDB, uploads) | Database lives in Postgres |
| `DatabaseUploader.jsx` | ETL handles ingestion |
| `DropboxDatabaseLoader.jsx` | ETL pulls from OneDrive |
| `DatabaseList.jsx` | No upload history needed |
| `databaseStorage.js` (IndexedDB) | No client-side DB storage |
| `OnboardingScreen.jsx` | Replaced by Cloudflare Access |
| Settings tab (API key inputs) | Keys are server-side |
| `sql.js` dependency | Gone entirely |
| `netlify/functions/ai-query.cjs` | Replaced by FastAPI |

#### Kept and evolved

| Component | Change |
|-----------|--------|
| `AIAssistant.jsx` | Calls POST /api/query instead of in-browser exec |
| `AIQueryInterface.jsx` | Same — API calls, remove duplicate schema generation |
| `DashboardView.jsx` | Calls API, dashboard CRUD via /api/dashboards |
| `ChartRenderer.jsx` | No change (echarts-for-react) |
| `InsightsPanel.jsx` | Calls API for AI-generated insights |
| `DatabaseExplorer.jsx` | Uses GET /api/schema + POST /api/query |
| `DataExplorer.jsx` | Uses API with server-side pagination |
| `QueryResults.jsx` | No change (renders tabular results) |

#### New additions

| Component | Purpose |
|-----------|---------|
| `ApiClient.ts` | Typed fetch wrapper for all /api/* calls |
| `AuthProvider.tsx` | Cloudflare Access JWT handling |
| `ConnectionStatus.tsx` | Warehouse health (last ETL, row counts) |
| Error boundaries | Around chart rendering and AI response parsing |

### 5.5 Simplified Component Tree

```
App.tsx
  AuthProvider                -- Cloudflare Access
  ConnectionStatus            -- Warehouse health indicator
  Navigation tabs
  |
  +-- Database Explorer tab
  |     DatabaseExplorer      -- GET /api/schema + POST /api/query
  +-- Data Explorer tab
  |     DataExplorer          -- GET /api/schema/{table} with pagination
  +-- AI Query tab
  |     AIQueryInterface      -- POST /api/query (simplified)
  +-- AI Assistant tab
  |     AIAssistant           -- POST /api/query with intent routing
  +-- Dashboard tab
  |     DashboardView         -- /api/dashboards CRUD + ChartRenderer
  +-- Insights tab
  |     InsightsPanel         -- POST /api/query for insight generation
  |
  QueryResults                -- Shared result display
```

---

## 6. Infrastructure

### 6.1 VPS Specification

| Spec | Value |
|------|-------|
| Provider | Hostinger |
| Plan | KVM-2 |
| VM ID | 1317522 |
| CPU | 2 cores |
| RAM | 8 GB |
| Disk | 100 GB |
| OS | Ubuntu 24.04 LTS |
| IP | 76.13.29.44 |
| Hostname | srv1317522.hstgr.cloud |
| Prepaid | 2 years |

### 6.2 Docker Compose Stack

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    volumes:
      - pg_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: splashworks
      POSTGRES_USER: splashworks
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "127.0.0.1:5432:5432"
    restart: unless-stopped

  api:
    build: ./api
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgresql://splashworks:${DB_PASSWORD}@postgres:5432/splashworks
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      AI_PROVIDER: ${AI_PROVIDER:-anthropic}
    volumes:
      - ./dbt:/app/dbt
      - ./docs:/app/docs
    ports:
      - "127.0.0.1:8080:8080"
    restart: unless-stopped

  frontend:
    build: ./frontend
    depends_on: [api]
    ports:
      - "127.0.0.1:3001:80"
    restart: unless-stopped

  metabase:
    image: metabase/metabase:latest
    depends_on: [postgres]
    environment:
      MB_DB_TYPE: postgres
      MB_DB_HOST: postgres
      MB_DB_PORT: 5432
      MB_DB_DBNAME: metabase
      MB_DB_USER: splashworks
      MB_DB_PASS: ${DB_PASSWORD}
    volumes:
      - metabase_data:/metabase-data
    ports:
      - "127.0.0.1:3000:3000"
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel run
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on: [api, frontend, metabase]
    restart: unless-stopped

  etl:
    build: ./etl
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgresql://splashworks:${DB_PASSWORD}@postgres:5432/splashworks
    volumes:
      - ./data/extracts:/data/extracts
      - ./dbt:/app/dbt
    restart: unless-stopped

volumes:
  pg_data:
  metabase_data:
```

### 6.3 Cloudflare Tunnel Configuration

```yaml
tunnel: splashworks-warehouse
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: app.splshwrks.com
    service: http://frontend:80
  - hostname: api.splshwrks.com
    service: http://api:8080
  - hostname: bi.splshwrks.com
    service: http://metabase:3000
  - service: http_status:404
```

### 6.4 Cloudflare Access Policies

| App | Policy | Who gets in |
|-----|--------|-------------|
| `app.splshwrks.com` | One-time PIN via email | Team + approved demo emails |
| `api.splshwrks.com` | Service token (frontend), email PIN (team) | Frontend app + team |
| `bi.splshwrks.com` | One-time PIN via email | Team + stakeholder demos |

### 6.5 VPS Directory Layout

```
/opt/splashworks/
  docker-compose.yml
  .env                          # DB_PASSWORD, API keys, tunnel token (gitignored)
  api/
    Dockerfile
    main.py
    ...
  frontend/
    Dockerfile                  # Multi-stage: npm build -> nginx
    src/
    ...
  etl/
    Dockerfile
    scripts/
      sync-extracts.sh          # rclone OneDrive -> /data/extracts
      run-etl.py                # SQLite -> Postgres raw schema
    crontab                     # ETL schedule
  dbt/
    dbt_project.yml
    models/
    ...
  docs/
    skimmer-semantic-layer.yaml
    DATA_DICTIONARY.md
    ...
  data/
    extracts/                   # Nightly .db.gz files land here
```

### 6.6 Deployment

```bash
# Production deploy (VPS):
ssh splashworks@76.13.29.44
cd /opt/splashworks
git pull origin feature/warehouse-etl
docker compose up -d --build

# Local dev (any machine):
git clone <repo>
cp .env.example .env
docker compose up -d
# API at localhost:8080, Frontend at localhost:3001, Metabase at localhost:3000
```

### 6.7 Monitoring (Lightweight)

| What | How |
|------|-----|
| ETL success/failure | Cron logs + email alert on failure |
| dbt test failures | dbt logs + email alert |
| Postgres health | GET /api/health endpoint |
| Disk usage | Cron script, alert at 80% |
| Container health | Docker restart policy + `docker compose ps` |

---

## 7. Testing Strategy

### 7.1 Testing by Layer

| Layer | Test Type | What It Validates | When |
|-------|-----------|-------------------|------|
| VPS/Infra | Smoke tests | Containers healthy, ports responding, tunnel resolving | After every `docker compose up` |
| ETL | Integration tests | SQLite -> Postgres row counts, data types, no truncation | After every ETL run |
| ETL | Regression tests | Known extract -> assert exact expected output | Before deploying ETL changes |
| dbt | Built-in tests | PK uniqueness, not-null, referential integrity, accepted values | After every `dbt run` |
| dbt | Row count reconciliation | Staging counts match source SQLite counts | After every transform |
| dbt | Business logic validation | Known inputs -> known outputs (match Power BI numbers) | On model changes |
| API | Unit tests (pytest) | Endpoint responses, auth rejection, SQL validation | On code changes |
| API | Integration tests | Full flow: question -> AI -> SQL -> Postgres -> results | Before deploying API |
| Guardrails | Adversarial tests | DROP TABLE rejected, cartesian products caught, huge results limited | On guardrail changes |
| Frontend | Vitest unit tests | API client, auth provider, component rendering | On code changes |
| Frontend | E2E smoke | Load page, submit query, see results (Playwright) | Before deploying frontend |
| End-to-End | Pipeline validation | Fresh dump -> ETL -> dbt -> API -> frontend -> correct answer | Weekly + after infra changes |

### 7.2 Validation Checklist Pattern

Every deliverable includes a validation checklist. Example:

```
Phase 0, Step 3: "Postgres running"

  [ ] docker compose ps shows postgres container "healthy"
  [ ] psql connects from api container: SELECT 1 returns 1
  [ ] Schemas created: \dn lists raw_skimmer, staging, warehouse, semantic
  [ ] pgvector available: CREATE EXTENSION IF NOT EXISTS vector succeeds
  [ ] Disk usage baseline recorded
  [ ] Connection from Metabase container verified

Phase 1, Step 2: "First ETL run"

  [ ] AQPS.db: 30 tables loaded, row counts match sqlite3 output
  [ ] JOMO.db: 30 tables loaded, row counts match
  [ ] No data type truncation: spot-check UUID, date, text columns
  [ ] CompanyId correctly distinguishes AQPS vs JOMO records
  [ ] Load metadata logged: timestamp, tables, row counts, duration
  [ ] Second run with same file: checksum detects no changes, skips
  [ ] Run with corrupted file: fails gracefully, logs error, no data corruption
```

### 7.3 Reconciliation Against Power BI

The production Power BI dashboard (`WORKING_Sales Report.pbix`) serves as ground truth. After Phase 1 warehouse models are built:

- Export 5-10 key metrics from Power BI (e.g., total dosage cost for AQPS in January, active customer count, tech utilization %)
- Run equivalent queries against the warehouse
- Assert exact match (or document and explain any differences)

---

## 8. Phased Implementation Roadmap

### Phase 0: Foundation (Week 1-2)

| Step | Deliverable | Validation |
|------|-------------|------------|
| 0.1 | Create `feature/warehouse-etl` branch | Branch exists, development preserved |
| 0.2 | Fix critical bugs (Dropbox token, SQL injection) | Token revoked, fixes on both branches |
| 0.3 | VPS setup: Docker + Docker Compose | `docker compose version` succeeds |
| 0.4 | Postgres container running | psql connects, schemas created |
| 0.5 | rclone configured for OneDrive | `rclone ls onedrive:` shows Skimmer files |
| 0.6 | Cloudflare tunnel live | Subdomains resolve, Access policies set |
| 0.7 | dbt project scaffolded | `dbt debug` passes |

**Demo:** psql query against raw Skimmer data in Postgres on the VPS.

### Phase 1: Crawl (Week 3-6)

| Step | Deliverable | Validation |
|------|-------------|------------|
| 1.1 | ETL automated (rclone + Python on cron) | Nightly load completes, logs written |
| 1.2 | dbt staging models (all 30 tables) | `dbt run` succeeds, row counts match source |
| 1.3 | dbt warehouse models (6 dims, 6 facts) | Star schema populated, dbt tests pass |
| 1.4 | dbt semantic models (materialized KPIs) | Views queryable, reconcile vs Power BI |
| 1.5 | dbt snapshots (SCD2 on customer, tech) | History accumulating after 2+ nightly loads |
| 1.6 | FastAPI backend live | /api/query, /api/schema, /api/health responding |
| 1.7 | Semantic layer on backend | AI prompts include YAML context |
| 1.8 | Query guardrails | SELECT-only, timeout, row limit, EXPLAIN check |
| 1.9 | React frontend updated | Calls API, no more sql.js |
| 1.10 | Metabase connected | Basic dashboards on semantic views |
| 1.11 | Cloudflare Access | Email-based auth working for all subdomains |

**Demo:** Stakeholder opens app.splshwrks.com, authenticates, asks a question, gets correct answer. Opens bi.splshwrks.com and sees dashboards.

### Phase 2: Walk (Week 7-12)

| Step | Deliverable |
|------|-------------|
| 2.1 | Metabase dashboard tiers (Daily Pulse, Weekly Performance, Monthly Health) |
| 2.2 | QuickBooks Online integration (ETL + staging models) |
| 2.3 | Cross-source warehouse joins (Skimmer + QBO) |
| 2.4 | Expanded semantic layer (all business terms from SQL-Semantic-Queries) |
| 2.5 | Dashboard CRUD API (save/load/share) |
| 2.6 | Proactive anomaly detection (scheduled, daily after dbt run) |
| 2.7 | Alert notifications (email digest) |
| 2.8 | Query optimization Phase 2 (AST validation, index recommendations) |
| 2.9 | Error boundaries in React |

**Demo:** Morning email with KPI digest + anomaly flags. AI answers contextual "why" questions.

### Phase 3: Run (Week 13-20)

| Step | Deliverable |
|------|-------------|
| 3.1 | Interactive agent with tools (query, chart, forecast, compare) |
| 3.2 | RAG pipeline (pgvector embeddings of notes, work orders, descriptions) |
| 3.3 | Forecasting models (revenue projection, churn prediction, seasonal patterns) |
| 3.4 | CRM integration (Zoho) |
| 3.5 | Conversation memory (session persistence) |
| 3.6 | Shareable report generation (PDF/HTML from conversations) |
| 3.7 | Collaborator onboarding (docker compose local dev documented + tested) |

**Demo:** "Project AQPS revenue for Q3 based on growth rate and seasonal patterns" -> forecast with chart and assumptions.

### Phase 4: Scale (Week 21+)

| Step | Deliverable |
|------|-------------|
| 4.1 | Xima Contact Center integration |
| 4.2 | GPS/Fleet integration |
| 4.3 | Customer-facing agent (context-aware service status) |
| 4.4 | Phone transcript analysis (RAG over call transcripts) |
| 4.5 | Multi-tenant evaluation |
| 4.6 | Infrastructure scaling (managed DB, dedicated vector DB, etc.) |

### Intentional Omissions

| Omitted | Reason | Adopt When |
|---------|--------|------------|
| Airbyte | Overkill for 2 sources | 5+ sources |
| Airflow/Dagster | Cron is sufficient | Complex pipeline dependencies |
| Kubernetes | Docker Compose works | Multi-node scaling needed |
| Power BI | Metabase covers it | Enterprise compliance or >50 users |
| Snowflake/BigQuery | Postgres handles the volume | Analytical patterns outgrow Postgres |
| CI/CD pipeline | `git pull && docker compose up` | Team grows beyond 2 |

---

## 9. Project Workflow & Advisory Council

### 9.1 Ongoing Project Workflow

This is a long-running project worked on iteratively. The workflow supports Ross working on other projects and returning to this one.

**Persistent state:**
- This design document (`docs/plans/2026-03-07-data-warehouse-mvp-design.md`) is the roadmap
- `docs/plans/PROGRESS.md` tracks current status, completed steps, next steps, and blockers
- Claude's memory files persist across sessions for context continuity

**Resuming work:**
- Say "pick up the warehouse project" or "continue at Phase 1, Step 4"
- Claude reads PROGRESS.md and memory files to restore context
- No re-explanation needed

**Parallel agent execution:**
- Infrastructure tasks (Docker configs, dbt scaffolding, ETL scripts) run in parallel worktrees
- Testing and validation run as background agents while implementation continues
- Code review agents audit after each phase milestone

### 9.2 Multi-Model Advisory Council

Claude is the sole implementer — the only model that touches code, runs commands, or modifies files. Other models serve as advisory reviewers at key decision points.

| Role | Model | Scope | Trigger |
|------|-------|-------|---------|
| Implementer | Claude (Opus) | Writes code, runs commands, deploys | All implementation work |
| Architecture reviewer | Codex / Gemini | Reviews design decisions, dbt structure, API design | Phase transitions, major design choices |
| SQL validator | Codex / Gemini | Cross-checks dbt SQL against production queries | dbt model creation, business logic translation |
| Test reviewer | Codex / Gemini | Reviews test coverage, identifies missed edge cases | After test suites are written |

**How it works:**
- At decision points (e.g., "Is this dbt model correctly translating FactDosage_v2?"), Claude sends the code to an advisory model for review
- Advisors return opinions and concerns — they never modify files
- Claude evaluates the feedback and decides whether to act on it
- Disagreements are flagged to Ross for final decision

### 9.3 Self-Testing Protocol

Every implementation step follows this pattern:

```
1. Implement the deliverable
2. Run automated tests (dbt test, pytest, vitest)
3. Run the validation checklist for that step
4. If any check fails: diagnose, fix, re-run from step 2
5. If advisory council review is warranted: send for review
6. Update PROGRESS.md with results
7. Only then: move to next step
```

---

## 10. Future State Data Model

This section preserves the original proposed data model for reference when additional sources (QuickBooks, CRM, GPS) are integrated and the schema expands beyond the current Skimmer-only model.

### Future Dimension Tables

| Dimension | Sources | Purpose |
|-----------|---------|---------|
| `dim_customer` | Skimmer + QBO + Zoho CRM | Unified customer: service data + financials + CRM lifecycle. Joined by CustomerCode/QboCustomerId. |
| `dim_service_location` | Skimmer | Enriched with pool_count, total_gallons, GPS coordinates (Phase 4) |
| `dim_tech` | Skimmer + GPS | Technician with route/fleet data |
| `dim_chemical` | Skimmer | Chemical readings and dosages, categorized |
| `dim_company` | All sources | Multi-company filtering |
| `dim_date` | Generated | Standard date spine |
| `dim_product` | Skimmer (PartCategory, PartMake, PartModel) + QBO (Items) | Equipment and product catalog |
| `dim_vehicle` | GPS/Fleet (Phase 4) | Fleet vehicles |
| `dim_contact` | Zoho CRM (Phase 3) | CRM contacts and leads |

### Future Fact Tables

| Fact | Sources | Grain | Key Measures |
|------|---------|-------|--------------|
| `fact_route_stop` | Skimmer | Per service stop | Duration, readings, dosages, tasks, labor cost |
| `fact_chemical_reading` | Skimmer | Per reading per stop | Reading value, in-range flag |
| `fact_chemical_dosage` | Skimmer | Per dosage per stop | Amount, unit, cost, price |
| `fact_work_order` | Skimmer | Per work order | Labor cost, price, completion |
| `fact_invoice` | Skimmer + QBO | Per invoice line | Amount, payment status, days to payment |
| `fact_payment` | QBO | Per payment | Amount, method, date |
| `fact_fleet_trip` | GPS (Phase 4) | Per trip | Miles, idle time, fuel estimate |
| `fact_call` | Xima (Phase 4) | Per call | Duration, sentiment, resolution |
| `fact_crm_activity` | Zoho (Phase 3) | Per CRM activity | Type, outcome, pipeline stage |

### Future Semantic Views

| View | Sources | KPI |
|------|---------|-----|
| `semantic.revenue_per_tech` | fact_route_stop + fact_invoice | Revenue / technician / period |
| `semantic.days_to_invoice` | fact_route_stop + fact_invoice | Avg days between service and invoice |
| `semantic.direct_labor_ratio` | fact_route_stop + QBO payroll | Labor cost / revenue |
| `semantic.net_unit_velocity` | dim_customer (SCD2) | Customer adds - losses per period |
| `semantic.go_back_rate` | fact_route_stop | Unscheduled returns / total stops |
| `semantic.chemical_variance` | fact_chemical_dosage + dim_chemical | Actual vs expected chemical usage |
| `semantic.repair_capture_rate` | fact_work_order + fact_route_stop | Repairs from routine visits / total repairs |
| `semantic.gross_margin_per_stop` | fact_route_stop + fact_chemical_dosage + QBO | (Revenue - COGS) / stop |
| `semantic.fleet_idle_pct` | fact_fleet_trip | Idle time / total engine time |
| `semantic.revenue_per_mile` | fact_route_stop + fact_fleet_trip | Revenue / miles driven |
| `semantic.labor_utilization` | fact_route_stop + QBO payroll | Billable hours / available hours |
| `semantic.effective_hourly_rate` | fact_route_stop + QBO payroll | Revenue / labor hours |

These 12 KPIs match the evaluation brief's specification and require cross-source joins that become available as each source is integrated.

---

## 11. Appendix: Decisions Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|
| 2026-03-07 | PostgreSQL over DuckDB | Universal, concurrent access, pgvector, collaborator-friendly | DuckDB (faster analytics but no network server), Hybrid (too complex for 1-person team) |
| 2026-03-07 | Single VPS over managed services | Already paid for, simpler ops, Docker Compose ties everything together | Supabase (free tier but adds external dependency), Netlify + managed DB (more accounts to manage) |
| 2026-03-07 | Cloudflare Tunnels over Caddy | No open ports, auto-SSL, Cloudflare Access for auth, DNS already in Cloudflare | Caddy (simpler but requires open ports and cert management) |
| 2026-03-07 | FastAPI over keeping Netlify Functions | Single Python backend for ETL + API + AI, eliminates serverless complexity | Keep Netlify (splits stack across two platforms) |
| 2026-03-07 | dbt over raw SQL transforms | Version-controlled, testable, warehouse-portable, snapshot support | Raw SQL scripts (simpler but no testing framework) |
| 2026-03-07 | Metabase over building dashboards in React | Free, purpose-built for BI, connects to Postgres directly | React dashboards (already exist but less capable for standard BI) |
| 2026-03-07 | Nightly SQLite dumps over Skimmer API as primary source | Full dataset, robust, already working. API deferred for incremental reads/writes. | API-first (slower ingestion, limited to API rate limits) |
| 2026-03-07 | Translate existing SQL-Semantic-Queries into dbt | Preserves validated business logic, reconciles against Power BI | Design new schema from scratch (risks logic divergence) |
| 2026-03-07 | Multi-model advisory council | Cross-check critical decisions without giving other models code access | Single-model (no second opinion on complex dbt translations) |
