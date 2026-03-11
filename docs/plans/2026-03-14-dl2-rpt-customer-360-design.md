# DL-2: rpt_customer_360 — Design Spec

**Date:** 2026-03-14
**Status:** Approved
**Backlog ID:** DL-2
**Effort:** M (half day)

## Goal

Single denormalized row per customer combining identity, service stats, financials, profitability, and lifetime value — optimized for AI queries ("tell me everything about customer X") and Metabase dashboards.

## Architecture

- **Schema:** `public_semantic`
- **Materialization:** Table
- **Grain:** One row per customer per company
- **File:** `dbt/models/semantic/rpt_customer_360.sql`
- **Dependencies:** dim_customer, dim_service_location, dim_pool, fact_service_stop, fact_invoice, fact_payment, semantic_profit

## Columns

| Column | Source | Type | Description |
|--------|--------|------|-------------|
| `_company_name` | dim_customer | text | AQPS or JOMO |
| `customer_id` | dim_customer | text | PK (with _company_name) |
| `clean_customer_name` | dim_customer | text | Display name |
| `billing_city` | dim_customer | text | Billing city |
| `billing_state` | dim_customer | text | Billing state |
| `billing_zip` | dim_customer | text | Billing zip |
| `is_inactive` | dim_customer | integer | 0=active, 1=inactive |
| `deleted` | dim_customer | integer | 0=active, 1=soft-deleted |
| `created_at` | dim_customer | text | Customer creation timestamp |
| `updated_at` | dim_customer | text | Last update (cancellation date if inactive) |
| `location_count` | dim_service_location | integer | Number of service locations |
| `pool_count` | dim_pool | integer | Number of pools across all locations |
| `total_stops` | fact_service_stop | integer | All service stops (completed + incomplete) |
| `completed_stops` | fact_service_stop | integer | Completed service stops only |
| `first_service_date` | fact_service_stop | text | Earliest service date |
| `last_service_date` | fact_service_stop | text | Most recent service date |
| `avg_minutes_per_stop` | fact_service_stop | double precision | Average time per completed stop |
| `total_invoiced` | fact_invoice | double precision | Sum of invoice line totals |
| `invoice_count` | fact_invoice | integer | Distinct invoices |
| `total_payments` | fact_payment | double precision | Sum of payment amounts |
| `payment_count` | fact_payment | integer | Number of payments |
| `last_payment_date` | fact_payment | text | Most recent payment |
| `total_revenue` | semantic_profit | double precision | Sum of service_rate across all months |
| `total_cost` | semantic_profit | double precision | Sum of total_cost (labor + dosage) |
| `total_profit` | semantic_profit | double precision | Sum of profit (revenue - cost) |
| `avg_monthly_profit` | semantic_profit | double precision | total_profit / months with data |
| `tenure_months` | calculated | integer | Months from created_at to now (or cancellation) |
| `lifetime_value` | calculated | double precision | = total_profit |
| `avg_monthly_value` | calculated | double precision | lifetime_value / tenure_months |

## SQL Strategy

CTE-based approach with dim_customer as the base and LEFT JOINs to aggregated subqueries:

1. **`customer_base`** — all customers from dim_customer (active + inactive)
2. **`locations`** — COUNT of service locations per customer
3. **`pools`** — COUNT of pools per customer
4. **`service_stats`** — aggregated fact_service_stop: total/completed stops, first/last date, avg minutes
5. **`invoice_stats`** — aggregated fact_invoice: total invoiced, invoice count
6. **`payment_stats`** — aggregated fact_payment: total payments, count, last date
7. **`profit_stats`** — aggregated semantic_profit: revenue, cost, profit, avg monthly profit
8. **Final SELECT** — join all CTEs on customer_id + _company_name, calculate tenure and LTV

### Tenure Calculation

```sql
GREATEST(1,
  DATE_PART('year', AGE(
    COALESCE(
      CASE WHEN c.is_inactive = 1 OR c.deleted = 1 THEN c.updated_at::date END,
      CURRENT_DATE
    ),
    c.created_at::date
  )) * 12 +
  DATE_PART('month', AGE(
    COALESCE(
      CASE WHEN c.is_inactive = 1 OR c.deleted = 1 THEN c.updated_at::date END,
      CURRENT_DATE
    ),
    c.created_at::date
  ))
)
```

`GREATEST(1, ...)` prevents division by zero for brand-new customers.

### Join Pattern

All joins include `_company_name` to prevent cross-company matching:

```sql
LEFT JOIN locations l ON c.customer_id = l.customer_id AND c._company_name = l._company_name
```

## System Prompt Updates

After the dbt model is built:

1. Add `rpt_customer_360` to the semantic layer YAML (`docs/skimmer-semantic-layer.yaml`)
2. Update `schema_context.py` so the AI system prompt includes the new table
3. Add a verified query example for "tell me about customer X"

## Testing

- dbt model compiles and runs without errors
- Row count matches dim_customer (one row per customer per company)
- Spot-check: LTV > 0 for active customers with service history
- AI query test: "tell me everything about [specific customer]" returns meaningful results

## Out of Scope

- Location-level detail (use dim_service_location directly or future rpt_customer_locations)
- Predictive LTV (requires churn probability modeling)
- Chemical reading summaries (DL-3 rpt_service_history covers per-visit detail)
