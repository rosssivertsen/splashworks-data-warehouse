# Semantic Layer Enrichment — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Author:** Ross Sivertsen + Claude Opus 4.6
**Date:** 2026-03-10
**Status:** APPROVED
**Branch:** `feature/warehouse-etl`
**Parent:** Phase 1 interstitial batch (between Batch C and Phase 2)

---

## 1. Goal

Enrich the semantic layer with Skimmer business terms and source-system traceability, then build 4 high-impact dbt models that unblock the most common practitioner queries. This is an interstitial batch — not a full phase — focused on making the AI assistant useful for day-to-day operational questions.

**Success criteria:** The AI can answer questions about pools/gallons, service visit duration, skipped stops, payments, and customer profitability without hitting "Query execution error."

---

## 2. Context: Why This Batch Exists

Phase 1 Batch C deployed a clean-room React frontend with 4 views (AI Query, Database Explorer, Data View, Dashboard). The frontend works, but the warehouse only covers ~46% of Skimmer's data model. Common questions fail:

- "Show me customers with pools > 10000 gallons" → **fails** (no `dim_pool`)
- "Average minutes per stop in January" → **fails** (no `fact_service_stop`)
- "Which customers are most profitable?" → **fails** (no profit model)
- "Show me payments received this month" → **fails** (no `fact_payment`)

The semantic layer YAML references the old client-side SQLite schema (raw table names), not the warehouse schema. The AI generates SQL against tables that don't exist in the warehouse layer.

---

## 3. Deliverable 1: Semantic Layer YAML Rewrite

### 3.1 Current State

- 183 lines, references raw table names (`Customer`, `ServiceStopEntry`)
- 1 business term (chlorine_usage)
- 1 verified query (pool size averages — targets raw tables)
- LSI calculation documented but not operationalized
- No Skimmer help doc URLs

### 3.2 Target State

Complete rewrite targeting warehouse schema with:

**Structure:**
```yaml
warehouse_schema:     # Maps layers to Postgres schemas
business_terms:       # 15-20 terms with SQL patterns + Skimmer doc URLs
tables:              # Warehouse table descriptions with key columns
relationships:       # Join paths in warehouse schema
metrics:             # Calculated measures (profit, compliance, aging)
verified_queries:    # 8-10 queries tested against live warehouse
data_gaps:           # Explicitly documents what's NOT yet available
lsi_calculation:     # Keep existing (reference only)
```

**New business terms (from Skimmer help docs research):**

| Term | Description | Skimmer Doc |
|------|-------------|-------------|
| `rate_type` | How a customer is billed: FlatMonthlyRateIncludingChemicals, FlatMonthlyRatePlusChemicals, PerStopIncludingChemicals, PerStopPlusChemicals, None | /article/199-how-to-charge-for-chemical-dosages |
| `profit` | Service Rate - (Labor Cost + Dosage Cost). Matches Skimmer's Profit Report. | /article/299-profit-report |
| `service_stop` | A single visit to a pool by a technician. Grain of operational reporting. | /article/80-view-customer-service-history-web |
| `minutes_at_stop` | Duration of a service visit (15-90 min range, ~27 min average) | /article/119-how-time-tracking-works-app |
| `service_status` | 1 = completed, 0 = skipped/incomplete | /article/160-skipped-stops-skip-tracking-reasons-and-email-alerts |
| `skipped_stop` | Route stop not completed. Tracked with optional reasons and email alerts. | /article/160-skipped-stops-skip-tracking-reasons-and-email-alerts |
| `payment_method` | How customer paid: Card, Check, Credit, Other, Bank, Cash | /article/151-skimmer-billing-how-to-manage-payments |
| `ar_aging` | Accounts receivable aging: Current, 30-day, 60-day, 90-day+ overdue buckets | /article/157-skimmer-billing-report-ar-aging-summary |
| `pool` | Body of water at a service location. Has gallons, filter baseline PSI, name (Pool/Spa/etc.) | /article/56-add-edit-or-delete-a-body-of-water-web |
| `installed_item` | Parts/chemicals marked installed during service. **Not yet in warehouse.** | /article/301-installed-items-report |
| `labor_cost_type` | How tech labor is costed: PerStop, PerMonth, None | /article/302-labor-report |
| `can_include_with_service` | Boolean flag on chemicals — determines if dosage cost is bundled or separately charged | /article/199-how-to-charge-for-chemical-dosages |
| `chemical_dosage` | Chemical administered during service with volume, cost, price, and profit | /article/300-chemical-dosages-report |
| `customer_statement` | Sequence of invoices, payments, credits showing payment history vs outstanding balance | /article/176-skimmer-billing-report-customer-statement |
| `equipment` | Pool equipment (pumps, filters, salt systems) tracked by Category/Make/Model. **Not yet in warehouse.** | /article/59-add-and-delete-equipment-web |

**Skimmer report mapping (source-system traceability):**

| Skimmer Report | Warehouse Query | Doc URL |
|----------------|----------------|---------|
| Profit Report | `semantic_profit` | /article/299-profit-report |
| Chemical Dosages | `fact_dosage` | /article/300-chemical-dosages-report |
| Labor Report | `fact_labor` + `fact_service_stop` | /article/302-labor-report |
| Installed Items | **Not yet available** | /article/301-installed-items-report |
| AR Aging Summary | `fact_payment` + `fact_invoice` | /article/157-skimmer-billing-report-ar-aging-summary |
| Invoice Detail | `fact_invoice` | /article/312-billing-report-invoice-details |
| Service History | `fact_service_stop` | /article/80-view-customer-service-history-web |

**Data gaps section** — explicitly documents what's NOT in the warehouse:
- Equipment/Parts (5 raw tables not staged)
- Route optimization (RouteMove, RouteSkip not in nightly extract)
- Product categories
- Tax configuration
- LSI calculation (documented, not operationalized)

---

## 4. Deliverable 2: dbt Models

### 4a. `dim_pool` (warehouse dimension)

**Purpose:** Pool/body of water dimension. Unblocks gallons, pool type, and filter pressure queries.

**Source:** `stg_pool` joined to `stg_service_location` for customer_id.

| Column | Type | Source |
|--------|------|--------|
| `_company_name` | text | stg_pool |
| `company_id` | text | stg_pool |
| `pool_id` | text (PK) | stg_pool |
| `service_location_id` | text (FK) | stg_pool |
| `customer_id` | text (FK) | stg_service_location (via location join) |
| `pool_name` | text | stg_pool (body of water type) |
| `gallons` | double | stg_pool |
| `baseline_filter_pressure` | double | stg_pool |
| `notes` | text | stg_pool |

**Filter:** `WHERE deleted = 0`

### 4b. `fact_service_stop` (warehouse fact)

**Purpose:** Core operational grain — one row per visit per pool. Answers duration, frequency, and completion questions.

**Source:** `stg_route_stop` LEFT JOIN `stg_service_stop` (skipped stops have no service_stop record).

| Column | Type | Source |
|--------|------|--------|
| `_company_name` | text | stg_route_stop |
| `company_id` | text | stg_route_stop |
| `route_stop_id` | text (PK) | stg_route_stop |
| `service_stop_id` | text (nullable) | stg_service_stop |
| `service_location_id` | text (FK) | stg_route_stop |
| `customer_id` | text (FK) | dim_service_location (via location) |
| `pool_id` | text (FK, nullable) | stg_service_stop |
| `tech_id` | text (FK) | stg_route_stop.account_id |
| `service_date` | text | stg_route_stop |
| `start_time` | text | stg_route_stop |
| `complete_time` | text | stg_route_stop |
| `minutes_at_stop` | double | stg_route_stop |
| `service_status` | integer | stg_route_stop (1=completed, 0=skipped) |
| `notes` | text | stg_service_stop (nullable) |
| `notes_to_customer` | text | stg_service_stop (nullable) |

**Filter:** `WHERE stg_route_stop.deleted = 0`

### 4c. `fact_payment` (warehouse fact)

**Purpose:** Payment tracking. Enables AR aging and cash flow analysis.

**Source:** `stg_payment` joined to `stg_invoice` for customer_id.

| Column | Type | Source |
|--------|------|--------|
| `_company_name` | text | stg_payment |
| `company_id` | text | stg_payment |
| `payment_id` | text (PK) | stg_payment |
| `invoice_id` | text (FK) | stg_payment |
| `customer_id` | text (FK) | stg_invoice (via invoice join) |
| `amount` | double | stg_payment |
| `payment_date` | text | stg_payment |
| `payment_method` | text | stg_payment (Card/Check/Credit/Other/Bank/Cash) |

**Filter:** `WHERE deleted = 0`

### 4d. `semantic_profit` (semantic model)

**Purpose:** Matches Skimmer's Profit Report. Per-customer, per-month profitability.

**Formula:** `service_rate - (labor_cost + dosage_cost) = profit`

**Source:** Joins `dim_customer`, `dim_service_location` (for rate), `fact_labor` (aggregated), `fact_dosage` (aggregated).

| Column | Type | Source |
|--------|------|--------|
| `_company_name` | text | dim_customer |
| `customer_id` | text (FK) | dim_customer |
| `customer_name` | text | dim_customer.clean_customer_name |
| `service_month` | text | fact_labor.service_month / fact_dosage.service_month |
| `rate_type` | text | stg_service_location.rate_type |
| `service_rate` | double | stg_service_location.rate |
| `labor_cost` | double | SUM(fact_labor costs) |
| `dosage_cost` | double | SUM(fact_dosage.dosage_cost) |
| `total_cost` | double | labor_cost + dosage_cost |
| `profit` | double | service_rate - total_cost |
| `stop_count` | integer | COUNT of completed service stops |

**Materialized as:** table (not view) — aggregation is expensive.

---

## 5. Testing Strategy

### dbt model tests
- `dim_pool`: row count > 0, no null pool_ids, gallons > 0 where not null, both companies present
- `fact_service_stop`: row count > 0, service_status in (0,1), minutes_at_stop >= 0, both companies present
- `fact_payment`: row count > 0, amount > 0, payment_method in known set, both companies present
- `semantic_profit`: both companies present, profit = service_rate - total_cost

### E2E tests (extend existing suite)
- Raw SQL: "Customers with pools > 10000 gallons" via `dim_pool` join
- Raw SQL: "Average minutes at a stop in January" via `fact_service_stop`
- Raw SQL: "Profit by company" via `semantic_profit`
- NL query: Re-test the pools question that originally failed

### No frontend changes
The frontend already renders whatever SQL the API returns. The improvement is that the AI generates better SQL because the schema context and semantic layer are richer.

---

## 6. Deployment

Same manual workflow as previous batches:
1. `dbt run` on VPS to build new models
2. `docker compose up -d --build` to rebuild API container (picks up new YAML)
3. Run E2E tests against live API
4. Verify the pools question works through `app.splshwrks.com`

---

## 7. What's Next (documented for future batch)

**UI refinements batch** (after this semantic enrichment ships):
- Starter prompts (6-8 clickable example questions that work against enriched warehouse)
- Dashboard cards with chart types (bar, line, pie, area via ECharts or similar)
- Dashboard save/restore (localStorage persistence)
- Dashboard export (PDF, possibly PPTX)
- Starter/sample dashboards

**Warehouse expansion** (Phase 2+):
- Equipment/Parts lifecycle (5 raw tables)
- Route management optimization
- LSI calculation operationalization
- Product catalog expansion
- Tax configuration

---

## 8. Decisions Log

| Date | Decision | Choice | Rationale | Alternatives Considered |
|------|----------|--------|-----------|------------------------|
| 2026-03-10 | Enrichment scope | YAML + 4 high-impact dbt models (Option B) | Unblocks most common queries without full warehouse expansion. Ship and validate before tackling equipment/routes. | YAML-only (too limited — AI still can't answer pool/stop/payment questions), Full expansion (too much scope for interstitial batch) |
| 2026-03-10 | Profit formula | Match Skimmer exactly: rate - labor - dosage | Provides baseline frame of reference that reconciles with Skimmer's built-in Profit Report. | Extended formula with overhead/drive costs (YAGNI — no data for those costs yet) |
| 2026-03-10 | Skipped stops | Use service_status from stg_route_stop (0=skipped, 1=completed) | RouteSkip/SkippedStopReason tables may not be in nightly extract. service_status flag answers the core question. | Build dedicated skipped_stops model (can't verify source data exists) |
| 2026-03-10 | fact_service_stop grain | One row per route_stop (visit) | This is the operational grain — answers duration, frequency, and completion questions. LEFT JOIN to service_stop captures skipped visits. | One row per service_stop only (misses skipped stops which have no service_stop record) |
| 2026-03-10 | Source-system traceability | Add Skimmer help doc URLs to YAML business terms | Foundational to the knowledge-layer moat. Maps warehouse concepts back to Skimmer's UI/documentation. Future batches will surface these as hyperlinks in the Database Explorer. | Skip URLs (loses the strategic context), Full hyperlink UI (premature — YAML documentation is the prerequisite) |
