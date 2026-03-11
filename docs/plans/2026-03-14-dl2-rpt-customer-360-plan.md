# DL-2: rpt_customer_360 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a denormalized one-row-per-customer report model combining identity, service stats, financials, profitability, and lifetime value.

**Architecture:** Single dbt SQL model in the semantic layer (`public_semantic.rpt_customer_360`), using CTE-based aggregation from existing warehouse dims/facts. System prompt and semantic layer YAML updated so the AI routes customer profile questions to this table.

**Tech Stack:** dbt (SQL), Python (FastAPI system prompt), YAML (semantic layer)

**Spec:** `docs/plans/2026-03-14-dl2-rpt-customer-360-design.md`

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Create | `dbt/models/semantic/rpt_customer_360.sql` | The dbt model — CTE-based denormalized customer report |
| Modify | `docs/skimmer-semantic-layer.yaml` | Add table entry + verified query for customer 360 |
| Modify | `docs/plans/PROGRESS.md` | Mark DL-2 as DONE |
| Modify | `docs/plans/BACKLOG.md` | Mark DL-2 as completed |

---

## Chunk 1: dbt Model + Semantic Layer

### Task 1: Create rpt_customer_360 dbt model

**Files:**
- Create: `dbt/models/semantic/rpt_customer_360.sql`

**Context:**
- Existing semantic models live in `dbt/models/semantic/` and use `{{ config(materialized='table') }}`
- All joins must include `_company_name` to prevent cross-company matching
- Date columns in fact tables are TEXT — use string comparisons, not date functions
- `semantic_profit` filters `is_inactive = 0` and uses INNER JOIN to `monthly_stops`, so it only has rows for customers with completed service stops
- `fact_invoice` filters `status = 'Sent'` — use the same filter here
- `dim_service_location` filters `deleted = 0`
- The model should include ALL customers (active + inactive) so LTV works for cancelled customers too

**Dependencies (dbt refs):**
- `dim_customer` — customer identity, lifecycle status
- `dim_service_location` — location count (already filtered deleted=0)
- `dim_pool` — pool count
- `fact_service_stop` — service visit stats
- `fact_invoice` — invoice stats (use `line_total` for totals, filter `invoice_status = 'Sent'`)
- `fact_payment` — payment stats
- `semantic_profit` — profitability (NOTE: only has active customers with stops)

- [ ] **Step 1: Write the dbt model**

Create `dbt/models/semantic/rpt_customer_360.sql`:

```sql
{{ config(materialized='table') }}

with customer_base as (
    select
        _company_name,
        customer_id,
        clean_customer_name,
        billing_city,
        billing_state,
        billing_zip,
        is_inactive,
        deleted,
        created_at,
        updated_at
    from {{ ref('dim_customer') }}
),

locations as (
    select
        customer_id,
        _company_name,
        count(*) as location_count
    from {{ ref('dim_service_location') }}
    group by customer_id, _company_name
),

pools as (
    select
        customer_id,
        _company_name,
        count(*) as pool_count
    from {{ ref('dim_pool') }}
    group by customer_id, _company_name
),

service_stats as (
    select
        customer_id,
        _company_name,
        count(*) as total_stops,
        count(case when service_status = 1 then 1 end) as completed_stops,
        min(service_date) as first_service_date,
        max(service_date) as last_service_date,
        round(avg(case when service_status = 1 then minutes_at_stop end)::numeric, 1) as avg_minutes_per_stop
    from {{ ref('fact_service_stop') }}
    group by customer_id, _company_name
),

invoice_stats as (
    select
        customer_id,
        _company_name,
        coalesce(sum(line_total), 0) as total_invoiced,
        count(distinct invoice_id) as invoice_count
    from {{ ref('fact_invoice') }}
    group by customer_id, _company_name
),

payment_stats as (
    select
        customer_id,
        _company_name,
        coalesce(sum(amount), 0) as total_payments,
        count(*) as payment_count,
        max(payment_date) as last_payment_date
    from {{ ref('fact_payment') }}
    group by customer_id, _company_name
),

profit_stats as (
    select
        customer_id,
        _company_name,
        coalesce(sum(service_rate), 0) as total_revenue,
        coalesce(sum(total_cost), 0) as total_cost,
        coalesce(sum(profit), 0) as total_profit,
        case
            when count(service_month) > 0
            then round((sum(profit) / count(service_month))::numeric, 2)
            else 0
        end as avg_monthly_profit
    from {{ ref('semantic_profit') }}
    group by customer_id, _company_name
)

select
    c._company_name,
    c.customer_id,
    c.clean_customer_name,
    c.billing_city,
    c.billing_state,
    c.billing_zip,
    c.is_inactive,
    c.deleted,
    c.created_at,
    c.updated_at,

    -- portfolio
    coalesce(l.location_count, 0) as location_count,
    coalesce(p.pool_count, 0) as pool_count,

    -- service stats
    coalesce(ss.total_stops, 0) as total_stops,
    coalesce(ss.completed_stops, 0) as completed_stops,
    ss.first_service_date,
    ss.last_service_date,
    coalesce(ss.avg_minutes_per_stop, 0) as avg_minutes_per_stop,

    -- invoicing
    coalesce(inv.total_invoiced, 0) as total_invoiced,
    coalesce(inv.invoice_count, 0) as invoice_count,

    -- payments
    coalesce(pay.total_payments, 0) as total_payments,
    coalesce(pay.payment_count, 0) as payment_count,
    pay.last_payment_date,

    -- profitability
    coalesce(pr.total_revenue, 0) as total_revenue,
    coalesce(pr.total_cost, 0) as total_cost,
    coalesce(pr.total_profit, 0) as total_profit,
    coalesce(pr.avg_monthly_profit, 0) as avg_monthly_profit,

    -- lifetime value
    greatest(1,
        (date_part('year', age(
            coalesce(
                case when c.is_inactive = 1 or c.deleted = 1 then c.updated_at::date end,
                current_date
            ),
            c.created_at::date
        )) * 12 +
        date_part('month', age(
            coalesce(
                case when c.is_inactive = 1 or c.deleted = 1 then c.updated_at::date end,
                current_date
            ),
            c.created_at::date
        )))::int
    ) as tenure_months,

    coalesce(pr.total_profit, 0) as lifetime_value,

    round((coalesce(pr.total_profit, 0) /
        greatest(1,
            (date_part('year', age(
                coalesce(
                    case when c.is_inactive = 1 or c.deleted = 1 then c.updated_at::date end,
                    current_date
                ),
                c.created_at::date
            )) * 12 +
            date_part('month', age(
                coalesce(
                    case when c.is_inactive = 1 or c.deleted = 1 then c.updated_at::date end,
                    current_date
                ),
                c.created_at::date
            )))
        ))::numeric, 2
    ) as avg_monthly_value

from customer_base c
left join locations l
    on c.customer_id = l.customer_id and c._company_name = l._company_name
left join pools p
    on c.customer_id = p.customer_id and c._company_name = p._company_name
left join service_stats ss
    on c.customer_id = ss.customer_id and c._company_name = ss._company_name
left join invoice_stats inv
    on c.customer_id = inv.customer_id and c._company_name = inv._company_name
left join payment_stats pay
    on c.customer_id = pay.customer_id and c._company_name = pay._company_name
left join profit_stats pr
    on c.customer_id = pr.customer_id and c._company_name = pr._company_name
```

- [ ] **Step 2: Compile the model to verify SQL is valid**

Run: `cd dbt && dbt compile --select rpt_customer_360`
Expected: Compiled SQL output, no errors.

- [ ] **Step 3: Run the model**

Run: `cd dbt && dbt run --select rpt_customer_360`
Expected: SUCCESS, creates `public_semantic.rpt_customer_360` table.

- [ ] **Step 4: Validate row count matches dim_customer**

Run against Postgres:
```sql
SELECT
    (SELECT count(*) FROM public_semantic.rpt_customer_360) AS rpt_rows,
    (SELECT count(*) FROM public_warehouse.dim_customer) AS dim_rows;
```
Expected: Both counts are equal (one row per customer per company).

- [ ] **Step 5: Spot-check data quality**

Run against Postgres:
```sql
-- Active customers with service history should have LTV > 0
SELECT _company_name, clean_customer_name, tenure_months, lifetime_value, avg_monthly_value
FROM public_semantic.rpt_customer_360
WHERE is_inactive = 0 AND deleted = 0 AND total_stops > 0
ORDER BY lifetime_value DESC
LIMIT 5;

-- Verify tenure_months is always >= 1
SELECT count(*) AS bad_tenure FROM public_semantic.rpt_customer_360 WHERE tenure_months < 1;
```
Expected: Top customers show positive LTV. Zero rows with bad tenure.

- [ ] **Step 6: Commit**

```bash
git add dbt/models/semantic/rpt_customer_360.sql
git commit -m "feat(DL-2): add rpt_customer_360 denormalized customer report"
```

---

### Task 2: Update semantic layer YAML

**Files:**
- Modify: `docs/skimmer-semantic-layer.yaml`

**Context:**
- New table entries go under `tables:` section (see existing entries like `semantic_profit` at line ~225)
- Add after the `semantic_profit` entry
- Also add a verified query example under `verified_queries:` section

- [ ] **Step 1: Add table entry to semantic layer YAML**

Add under `tables:` section (after `semantic_profit`):

```yaml
  rpt_customer_360:
    schema: public_semantic
    description: "Denormalized customer profile — one row per customer with service stats, financials, profitability, and lifetime value. Use for 'tell me about customer X' questions."
    key_columns: [customer_id, _company_name, clean_customer_name, is_inactive, deleted, location_count, pool_count, total_stops, completed_stops, total_invoiced, total_payments, total_profit, lifetime_value, avg_monthly_value, tenure_months]
    grain: "one row per customer per company"
    note: "Includes ALL customers (active + inactive). Filter is_inactive = 0 AND deleted = 0 for active only."
```

- [ ] **Step 2: Add a verified query example**

Add under `verified_queries:` section:

```yaml
  - question: "Tell me everything about customer [name]"
    sql: |
      SELECT clean_customer_name, _company_name, billing_city, billing_state,
             is_inactive, deleted, created_at, updated_at,
             location_count, pool_count, total_stops, completed_stops,
             first_service_date, last_service_date, avg_minutes_per_stop,
             total_invoiced, invoice_count, total_payments, payment_count, last_payment_date,
             total_revenue, total_cost, total_profit, avg_monthly_profit,
             tenure_months, lifetime_value, avg_monthly_value
      FROM public_semantic.rpt_customer_360
      WHERE clean_customer_name ILIKE '%[name]%'
        AND is_inactive = 0 AND deleted = 0
    notes: "Replace [name] with the customer name. ILIKE for case-insensitive partial match."
```

- [ ] **Step 3: Commit**

```bash
git add docs/skimmer-semantic-layer.yaml
git commit -m "feat(DL-2): add rpt_customer_360 to semantic layer YAML"
```

---

### Task 3: Update progress and backlog docs

**Files:**
- Modify: `docs/plans/PROGRESS.md`
- Modify: `docs/plans/BACKLOG.md`

- [ ] **Step 1: Update PROGRESS.md**

In the "Current Status" section, update:
- `**Next:**` line to remove DL-2 (keep DL-3)

Add a new section after "Interstitial: AI Query Intelligence":

```markdown
## Data Layer Reports

| Step | Deliverable | Status |
|------|-------------|--------|
| DL-2 | rpt_customer_360 — denormalized customer + service stats + payments + LTV | DONE |
```

- [ ] **Step 2: Update BACKLOG.md**

Strike through DL-2 in the "Data Layer — Warehouse Models" table and add to the "Completed" section:

```markdown
| ~~DL-2~~ | ~~`rpt_customer_360` — denormalized customer + locations + service stats + payments~~ | ~~dbt model~~ | ~~M~~ | ~~DONE 2026-03-14~~ |
```

Add to Completed section:
```markdown
| ~~DL-2~~ | rpt_customer_360 — denormalized customer profile with LTV | 2026-03-14 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/plans/PROGRESS.md docs/plans/BACKLOG.md
git commit -m "docs: mark DL-2 complete in progress tracker and backlog"
```
