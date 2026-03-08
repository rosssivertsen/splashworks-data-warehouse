# Semantic Layer Enrichment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrich the semantic layer with Skimmer business terms and build 4 high-impact dbt models so the AI can answer questions about pools, service visits, payments, and profitability.

**Architecture:** Complete rewrite of `docs/skimmer-semantic-layer.yaml` to target warehouse schema (not raw SQLite tables), then build 3 new warehouse models (`dim_pool`, `fact_service_stop`, `fact_payment`) and 1 semantic model (`semantic_profit`). Update the API's system prompt builder to consume new YAML sections. Extend E2E tests to validate the new models work through the full stack.

**Tech Stack:** dbt (SQL models, Jinja macros), PostgreSQL 16, FastAPI (Python), YAML, pytest

**Design Doc:** `docs/plans/2026-03-10-semantic-enrichment-design.md`

---

## Task 1: Rewrite Semantic Layer YAML

**Files:**
- Modify: `docs/skimmer-semantic-layer.yaml`

**Context:** The current YAML (183 lines) references raw SQLite table names (`Customer`, `ServiceStopEntry`) and only has 1 business term. The AI generates SQL against tables that don't exist in the warehouse. We need a complete rewrite targeting the `public_warehouse.*` and `public_semantic.*` schemas with 15+ business terms, Skimmer help doc URLs, warehouse table descriptions, join paths, metrics, verified queries, and explicit data gaps.

**Step 1: Rewrite the YAML**

Replace the entire contents of `docs/skimmer-semantic-layer.yaml` with the following. This is a complete rewrite — do not merge with existing content.

```yaml
# Splashworks Pool Service — Semantic Layer
# Target: PostgreSQL warehouse (dbt-managed schemas)
# Last updated: 2026-03-10

warehouse_schema:
  staging: public_staging
  warehouse: public_warehouse
  semantic: public_semantic

business_terms:
  active_customer:
    description: "Customer currently receiving pool service (is_inactive = 0 in dim_customer)"
    sql_pattern: "WHERE is_inactive = 0"
    tables: [dim_customer]
    skimmer_doc: "https://help.getskimmer.com/article/56-add-edit-or-delete-a-body-of-water-web"

  rate_type:
    description: "How a customer is billed. Values: FlatMonthlyRateIncludingChemicals, FlatMonthlyRatePlusChemicals, PerStopIncludingChemicals, PerStopPlusChemicals, None"
    sql_pattern: "dim_service_location.rate_type"
    tables: [dim_service_location]
    skimmer_doc: "https://help.getskimmer.com/article/199-how-to-charge-for-chemical-dosages"

  profit:
    description: "Service Rate minus Labor Cost minus Dosage Cost. Matches Skimmer's Profit Report."
    sql_pattern: "semantic_profit.profit = service_rate - total_cost"
    tables: [semantic_profit]
    skimmer_doc: "https://help.getskimmer.com/article/299-profit-report"

  service_stop:
    description: "A single visit to a pool by a technician. Grain of operational reporting. One row per route_stop (visit)."
    sql_pattern: "SELECT * FROM public_warehouse.fact_service_stop"
    tables: [fact_service_stop]
    skimmer_doc: "https://help.getskimmer.com/article/80-view-customer-service-history-web"

  minutes_at_stop:
    description: "Duration of a service visit in minutes (typical range 15-90, average ~27 min)"
    sql_pattern: "fact_service_stop.minutes_at_stop"
    tables: [fact_service_stop]
    skimmer_doc: "https://help.getskimmer.com/article/119-how-time-tracking-works-app"

  service_status:
    description: "Whether a service visit was completed (1) or skipped/incomplete (0). Derived from Skimmer's sentinel timestamp."
    sql_pattern: "fact_service_stop.service_status = 1 for completed, = 0 for skipped"
    tables: [fact_service_stop]
    synonyms: ["completed", "skipped", "visit status"]

  skipped_stop:
    description: "Route stop not completed. Tracked with optional reasons and email alerts. Filter: service_status = 0"
    sql_pattern: "WHERE fact_service_stop.service_status = 0"
    tables: [fact_service_stop]
    skimmer_doc: "https://help.getskimmer.com/article/160-skipped-stops-skip-tracking-reasons-and-email-alerts"

  payment_method:
    description: "How a customer paid. Values: Card, Check, Credit, Other, Bank, Cash"
    sql_pattern: "fact_payment.payment_method"
    tables: [fact_payment]
    skimmer_doc: "https://help.getskimmer.com/article/151-skimmer-billing-how-to-manage-payments"

  ar_aging:
    description: "Accounts receivable aging: Current, 30-day, 60-day, 90-day+ overdue buckets. Derive from invoice due_date vs current_date."
    sql_pattern: "Use fact_invoice.due_date and payment_status to calculate aging buckets"
    tables: [fact_invoice, fact_payment]
    skimmer_doc: "https://help.getskimmer.com/article/157-skimmer-billing-report-ar-aging-summary"

  pool:
    description: "Body of water at a service location. Has gallons, filter baseline PSI, name (Pool/Spa/Fountain/etc.)"
    sql_pattern: "SELECT * FROM public_warehouse.dim_pool"
    tables: [dim_pool]
    skimmer_doc: "https://help.getskimmer.com/article/56-add-edit-or-delete-a-body-of-water-web"

  labor_cost_type:
    description: "How tech labor is costed. Values: PerStop, PerMonth, None"
    sql_pattern: "dim_service_location.labor_cost_type"
    tables: [dim_service_location]
    skimmer_doc: "https://help.getskimmer.com/article/302-labor-report"

  can_include_with_service:
    description: "Boolean flag on chemicals — determines if dosage cost is bundled with service or separately charged"
    sql_pattern: "dim_chemical.can_include_with_service"
    tables: [dim_chemical]
    skimmer_doc: "https://help.getskimmer.com/article/199-how-to-charge-for-chemical-dosages"

  chemical_dosage:
    description: "Chemical administered during service with volume, cost, price, and profit"
    sql_pattern: "SELECT * FROM public_warehouse.fact_dosage"
    tables: [fact_dosage]
    skimmer_doc: "https://help.getskimmer.com/article/300-chemical-dosages-report"

  chlorine_usage:
    description: "Total amount of chlorine chemicals added to pools"
    sql_pattern: "WHERE fact_dosage.entry_description LIKE '%Chlorine%'"
    tables: [fact_dosage]
    synonyms: ["chlorine dosage", "chlorine added", "chlorine chemicals"]

  installed_item:
    description: "Parts/chemicals marked installed during service. NOT YET IN WAREHOUSE — raw data only."
    tables: []
    skimmer_doc: "https://help.getskimmer.com/article/301-installed-items-report"
    data_availability: "not_available"

  equipment:
    description: "Pool equipment (pumps, filters, salt systems) tracked by Category/Make/Model. NOT YET IN WAREHOUSE."
    tables: []
    skimmer_doc: "https://help.getskimmer.com/article/59-add-and-delete-equipment-web"
    data_availability: "not_available"

tables:
  dim_customer:
    schema: public_warehouse
    description: "Customer dimension — one row per customer per company"
    key_columns: [customer_id, _company_name, clean_customer_name, is_inactive, billing_city, billing_state]
    primary_key: customer_id
    active_filter: "is_inactive = 0"

  dim_service_location:
    schema: public_warehouse
    description: "Service location dimension — customer addresses with rate and labor cost configuration"
    key_columns: [service_location_id, customer_id, _company_name, city, state, zip, rate, rate_type, labor_cost, labor_cost_type]
    primary_key: service_location_id
    joins_to: dim_customer via customer_id

  dim_pool:
    schema: public_warehouse
    description: "Pool/body of water dimension — gallons, type, filter baseline pressure"
    key_columns: [pool_id, service_location_id, customer_id, _company_name, pool_name, gallons, baseline_filter_pressure]
    primary_key: pool_id
    joins_to: dim_service_location via service_location_id, dim_customer via customer_id

  dim_tech:
    schema: public_warehouse
    description: "Technician/account dimension — staff who service pools"
    key_columns: [tech_id, _company_name, full_name, role_type, is_active]
    primary_key: tech_id

  dim_chemical:
    schema: public_warehouse
    description: "Chemical/entry description dimension — readings and dosage types"
    key_columns: [chemical_id, _company_name, description, entry_type, unit_of_measure, dosage_type, cost, price]
    primary_key: chemical_id

  dim_date:
    schema: public_warehouse
    description: "Date dimension — 2024-2027 date spine with day/week/month/quarter/year/season"
    key_columns: [date_key, day_of_week, month_num, month_name, quarter, year, year_month, season]
    primary_key: date_key

  fact_dosage:
    schema: public_warehouse
    description: "Chemical dosage events per service stop — volume, cost, price"
    key_columns: [service_stop_id, route_stop_id, service_date, service_month, tech_id, customer_id, entry_description, dosage_cost, dosage_price]
    grain: "one row per dosage entry per service stop"

  fact_labor:
    schema: public_warehouse
    description: "Labor facts — time and cost per route stop"
    key_columns: [service_stop_id, route_stop_id, service_date, service_month, tech_id, customer_id, minutes_at_stop, service_status, rate, labor_cost]
    grain: "one row per service stop"

  fact_invoice:
    schema: public_warehouse
    description: "Invoice facts with customer, location, and line item detail"
    key_columns: [invoice_id, customer_id, _company_name, invoice_date, invoice_status, payment_status, line_total, product_name]
    grain: "one row per invoice line item"

  fact_service_stop:
    schema: public_warehouse
    description: "Core operational grain — one row per visit per pool. Answers duration, frequency, and completion questions."
    key_columns: [route_stop_id, service_stop_id, service_location_id, customer_id, pool_id, tech_id, service_date, minutes_at_stop, service_status, notes]
    grain: "one row per route stop (visit)"
    note: "LEFT JOIN to stg_service_stop — skipped stops have no service_stop record but still appear as rows"

  fact_payment:
    schema: public_warehouse
    description: "Payment records — amount, date, method per invoice"
    key_columns: [payment_id, invoice_id, customer_id, _company_name, amount, payment_date, payment_method]
    grain: "one row per payment"

  fact_work_order:
    schema: public_warehouse
    description: "Work order facts — ad hoc maintenance tasks"
    key_columns: [work_order_id, service_location_id, tech_id, service_date, service_status, labor_cost, price]
    grain: "one row per work order"

  semantic_profit:
    schema: public_semantic
    description: "Per-customer, per-month profitability. Matches Skimmer's Profit Report: profit = service_rate - labor_cost - dosage_cost"
    key_columns: [customer_id, _company_name, customer_name, service_month, rate_type, service_rate, labor_cost, dosage_cost, total_cost, profit, stop_count]
    grain: "one row per customer per month"

relationships:
  customer_to_location:
    description: "Customer to service locations (1:many)"
    join: "dim_customer.customer_id = dim_service_location.customer_id AND dim_customer._company_name = dim_service_location._company_name"

  location_to_pool:
    description: "Service location to pools/bodies of water (1:many)"
    join: "dim_service_location.service_location_id = dim_pool.service_location_id"

  customer_to_pool:
    description: "Customer to pools (through service location)"
    join: "dim_customer.customer_id = dim_pool.customer_id AND dim_customer._company_name = dim_pool._company_name"

  customer_to_service_stop:
    description: "Customer to service visits (1:many)"
    join: "dim_customer.customer_id = fact_service_stop.customer_id AND dim_customer._company_name = fact_service_stop._company_name"

  customer_to_dosage:
    description: "Customer to chemical dosages"
    join: "dim_customer.customer_id = fact_dosage.customer_id AND dim_customer._company_name = fact_dosage._company_name"

  customer_to_invoice:
    description: "Customer to invoices"
    join: "dim_customer.customer_id = fact_invoice.customer_id AND dim_customer._company_name = fact_invoice._company_name"

  customer_to_payment:
    description: "Customer to payments (through invoice)"
    join: "dim_customer.customer_id = fact_payment.customer_id AND dim_customer._company_name = fact_payment._company_name"

  customer_to_profit:
    description: "Customer to profitability summary"
    join: "dim_customer.customer_id = semantic_profit.customer_id AND dim_customer._company_name = semantic_profit._company_name"

  tech_to_service_stop:
    description: "Technician to service visits"
    join: "dim_tech.tech_id = fact_service_stop.tech_id AND dim_tech._company_name = fact_service_stop._company_name"

metrics:
  profit:
    description: "Per-customer monthly profit"
    formula: "service_rate - (labor_cost + dosage_cost)"
    table: semantic_profit
    skimmer_doc: "https://help.getskimmer.com/article/299-profit-report"

  avg_minutes_at_stop:
    description: "Average service visit duration in minutes"
    formula: "AVG(fact_service_stop.minutes_at_stop) WHERE service_status = 1"
    table: fact_service_stop

  completion_rate:
    description: "Percentage of scheduled stops that were completed"
    formula: "SUM(service_status) / COUNT(*) * 100"
    table: fact_service_stop

  skipped_stop_count:
    description: "Number of stops not completed"
    formula: "COUNT(*) WHERE service_status = 0"
    table: fact_service_stop

verified_queries:
  - question: "How many active customers does each company have?"
    sql: |
      SELECT _company_name, COUNT(*) AS active_customers
      FROM public_warehouse.dim_customer
      WHERE is_inactive = 0
      GROUP BY _company_name
      ORDER BY _company_name
    expected: "AQPS: 859, JOMO: 2402"

  - question: "What is the average pool size in gallons by company?"
    sql: |
      SELECT p._company_name, AVG(p.gallons) AS avg_gallons, COUNT(*) AS pool_count
      FROM public_warehouse.dim_pool p
      JOIN public_warehouse.dim_customer c
        ON p.customer_id = c.customer_id AND p._company_name = c._company_name
      WHERE c.is_inactive = 0 AND p.gallons IS NOT NULL
      GROUP BY p._company_name
    expected: "Pool gallons averages by company"

  - question: "Show me customers with pools larger than 10000 gallons"
    sql: |
      SELECT c.clean_customer_name, c._company_name, p.pool_name, p.gallons
      FROM public_warehouse.dim_pool p
      JOIN public_warehouse.dim_customer c
        ON p.customer_id = c.customer_id AND p._company_name = c._company_name
      WHERE p.gallons > 10000 AND c.is_inactive = 0
      ORDER BY p.gallons DESC
    expected: "Customers with large pools"

  - question: "What is the average time spent at a stop in January?"
    sql: |
      SELECT _company_name, AVG(minutes_at_stop) AS avg_minutes, COUNT(*) AS stop_count
      FROM public_warehouse.fact_service_stop
      WHERE service_status = 1
        AND service_date >= '2026-01-01' AND service_date < '2026-02-01'
      GROUP BY _company_name
    expected: "Average ~27 minutes per stop"

  - question: "How many skipped stops were there last month?"
    sql: |
      SELECT _company_name, COUNT(*) AS skipped_count
      FROM public_warehouse.fact_service_stop
      WHERE service_status = 0
        AND service_date >= '2026-02-01' AND service_date < '2026-03-01'
      GROUP BY _company_name
    expected: "Count of skipped stops by company"

  - question: "Show payments received this month by method"
    sql: |
      SELECT _company_name, payment_method, COUNT(*) AS payment_count, SUM(amount) AS total_amount
      FROM public_warehouse.fact_payment
      WHERE payment_date >= '2026-03-01' AND payment_date < '2026-04-01'
      GROUP BY _company_name, payment_method
      ORDER BY total_amount DESC
    expected: "Card is most common, then Check"

  - question: "Which customers are most profitable?"
    sql: |
      SELECT customer_name, _company_name, service_month, service_rate, total_cost, profit
      FROM public_semantic.semantic_profit
      ORDER BY profit DESC
      LIMIT 20
    expected: "Top 20 most profitable customers"

  - question: "What are the most common chemical readings?"
    sql: |
      SELECT entry_description, COUNT(*) AS reading_count
      FROM public_warehouse.fact_dosage
      GROUP BY entry_description
      ORDER BY reading_count DESC
      LIMIT 10
    expected: "Chemical types ranked by frequency"

data_gaps:
  - name: "Equipment/Parts"
    description: "5 raw tables (Equipment, EquipmentItem, etc.) not yet staged or modeled"
    impact: "Cannot answer questions about pool equipment lifecycle"

  - name: "Installed Items"
    description: "Parts/chemicals marked installed during service not in warehouse"
    impact: "Cannot generate Installed Items Report equivalent"
    skimmer_doc: "https://help.getskimmer.com/article/301-installed-items-report"

  - name: "Route Optimization"
    description: "RouteMove, RouteSkip tables may not be in nightly extract"
    impact: "Cannot analyze route efficiency or skip reasons"

  - name: "Product Categories"
    description: "Product table staged but not dimensionalized with categories"
    impact: "Limited product-level reporting"

  - name: "LSI Calculation"
    description: "Langelier Saturation Index formula documented but not operationalized as a model"
    impact: "Cannot calculate water balance index from readings"

lsi_calculation:
  formula: "pH + TempFactor + CalciumFactor + AlkalinityFactor - TDSFactor"
  status: "documented_only"
  reference: "https://www.orendatech.com/pool-dosing-calculator"
  note: "Requires pH, temperature, calcium hardness, total alkalinity, cyanuric acid, TDS readings"

skimmer_reports:
  - name: "Profit Report"
    warehouse_table: semantic_profit
    skimmer_doc: "https://help.getskimmer.com/article/299-profit-report"
  - name: "Chemical Dosages Report"
    warehouse_table: fact_dosage
    skimmer_doc: "https://help.getskimmer.com/article/300-chemical-dosages-report"
  - name: "Labor Report"
    warehouse_table: "fact_labor + fact_service_stop"
    skimmer_doc: "https://help.getskimmer.com/article/302-labor-report"
  - name: "AR Aging Summary"
    warehouse_table: "fact_payment + fact_invoice"
    skimmer_doc: "https://help.getskimmer.com/article/157-skimmer-billing-report-ar-aging-summary"
  - name: "Service History"
    warehouse_table: fact_service_stop
    skimmer_doc: "https://help.getskimmer.com/article/80-view-customer-service-history-web"
  - name: "Installed Items Report"
    warehouse_table: "NOT AVAILABLE"
    skimmer_doc: "https://help.getskimmer.com/article/301-installed-items-report"
  - name: "Invoice Detail"
    warehouse_table: fact_invoice
    skimmer_doc: "https://help.getskimmer.com/article/312-billing-report-invoice-details"
```

**Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('docs/skimmer-semantic-layer.yaml')); print('YAML valid')"`

Expected: `YAML valid`

**Step 3: Commit**

```bash
git add docs/skimmer-semantic-layer.yaml
git commit -m "feat: rewrite semantic layer YAML for warehouse schema

15 business terms with Skimmer help doc URLs, warehouse table
descriptions, join relationships, metrics, 8 verified queries,
explicit data gaps, and Skimmer report mapping."
```

---

## Task 2: Update System Prompt Builder

**Files:**
- Modify: `api/services/schema_context.py`
- Test: `api/tests/test_schema_context.py`

**Context:** The system prompt builder (`build_system_prompt()`) currently reads 3 YAML sections: `business_terms`, `relationships`, `verified_queries`. The new YAML adds `tables`, `metrics`, `data_gaps`, and `warehouse_schema` sections that should also be injected into the AI's system prompt to improve SQL generation quality.

**Step 1: Read the existing test file**

Read `api/tests/test_schema_context.py` to understand the current test structure before modifying.

**Step 2: Write a failing test for the new sections**

Add tests to `api/tests/test_schema_context.py` that verify the new YAML sections appear in the system prompt:

```python
def test_build_system_prompt_includes_table_descriptions(mock_schema):
    """Verify warehouse table descriptions from YAML appear in prompt."""
    prompt = build_system_prompt(mock_schema, layer="warehouse")
    assert "Table Descriptions" in prompt or "table_descriptions" in prompt.lower()


def test_build_system_prompt_includes_metrics(mock_schema):
    """Verify metrics section from YAML appears in prompt."""
    prompt = build_system_prompt(mock_schema, layer="warehouse")
    assert "Metrics" in prompt


def test_build_system_prompt_includes_data_gaps(mock_schema):
    """Verify data gaps section from YAML appears in prompt."""
    prompt = build_system_prompt(mock_schema, layer="warehouse")
    assert "NOT available" in prompt.lower() or "data gap" in prompt.lower()


def test_build_system_prompt_includes_verified_query_sql(mock_schema):
    """Verify verified queries include actual SQL examples, not just questions."""
    prompt = build_system_prompt(mock_schema, layer="warehouse")
    assert "SELECT" in prompt  # Verified queries should include SQL
```

**Step 3: Run tests to verify they fail**

Run: `cd api && python -m pytest tests/test_schema_context.py -v`

Expected: New tests FAIL (the prompt builder doesn't include these sections yet).

**Step 4: Update `build_system_prompt()` to include new sections**

In `api/services/schema_context.py`, update the `build_system_prompt()` function. After the existing `relationships` block (around line 82), add handling for `tables`, `metrics`, `verified_queries` (with SQL), and `data_gaps`:

```python
def build_system_prompt(schema: dict[str, dict[str, list[str]]], layer: str = "warehouse") -> str:
    """Build the system prompt for Claude with schema + semantic context."""
    lines = [
        "You are a SQL query generator for a pool service data warehouse (PostgreSQL).",
        "Generate ONLY a SELECT query. Do not include any explanation before or after the SQL.",
        "Wrap the SQL in ```sql and ``` markers.",
        "",
        f"You are querying the {'warehouse and semantic' if layer == 'warehouse' else 'staging'} layer.",
        "",
        "## Available Tables and Columns",
        "",
    ]

    for schema_name, tables in schema.items():
        for table_name, columns in tables.items():
            fq = f'{schema_name}.{table_name}'
            cols = ", ".join(columns)
            lines.append(f"- **{fq}**: {cols}")

    # Add semantic layer context (only for warehouse layer)
    sl = load_semantic_layer() if layer == "warehouse" else {}
    if sl:
        lines.append("")
        lines.append("## Business Context")
        lines.append("")

        if "business_terms" in sl:
            for term, info in sl["business_terms"].items():
                desc = info.get("description", "")
                lines.append(f"- **{term}**: {desc}")

        if "relationships" in sl:
            lines.append("")
            lines.append("## Key Relationships")
            lines.append("")
            for rel_name, info in sl["relationships"].items():
                desc = info.get("description", "")
                join = info.get("join", "")
                lines.append(f"- **{rel_name}**: {desc}")
                if join:
                    lines.append(f"  JOIN: `{join}`")

        if "tables" in sl:
            lines.append("")
            lines.append("## Table Descriptions")
            lines.append("")
            for tbl_name, info in sl["tables"].items():
                tbl_schema = info.get("schema", "public_warehouse")
                desc = info.get("description", "")
                grain = info.get("grain", "")
                lines.append(f"- **{tbl_schema}.{tbl_name}**: {desc}")
                if grain:
                    lines.append(f"  Grain: {grain}")

        if "metrics" in sl:
            lines.append("")
            lines.append("## Calculated Metrics")
            lines.append("")
            for metric_name, info in sl["metrics"].items():
                desc = info.get("description", "")
                formula = info.get("formula", "")
                lines.append(f"- **{metric_name}**: {desc}")
                if formula:
                    lines.append(f"  Formula: `{formula}`")

        if "verified_queries" in sl:
            lines.append("")
            lines.append("## Example Verified Queries")
            lines.append("")
            for vq in sl["verified_queries"]:
                q = vq.get("question", "")
                sql = vq.get("sql", "")
                lines.append(f"- Q: {q}")
                if sql:
                    lines.append(f"  ```sql\n  {sql.strip()}\n  ```")

        if "data_gaps" in sl:
            lines.append("")
            lines.append("## Data NOT Available in Warehouse")
            lines.append("")
            for gap in sl["data_gaps"]:
                name = gap.get("name", "")
                desc = gap.get("description", "")
                lines.append(f"- **{name}**: {desc}")

    lines.append("")
    lines.append("## Important Rules")
    lines.append("- Service completion sentinel: '2010-01-01 12:00:00' means NOT completed")
    lines.append("- Active customer filter: is_inactive = 0")
    lines.append("- _company_name column distinguishes companies: 'AQPS' or 'JOMO'")
    example_table = "public_warehouse.dim_customer" if layer == "warehouse" else "public_staging.stg_customer"
    lines.append(f"- Always qualify table names with schema (e.g., {example_table})")
    lines.append("- Use double quotes for column names only if they contain special characters")
    lines.append("- When joining facts to dimensions, match on BOTH the ID column AND _company_name")

    return "\n".join(lines)
```

**Step 5: Run tests to verify they pass**

Run: `cd api && python -m pytest tests/test_schema_context.py -v`

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add api/services/schema_context.py api/tests/test_schema_context.py
git commit -m "feat: system prompt builder consumes new YAML sections

Tables, metrics, verified queries (with SQL), data gaps, and join
clauses now feed the AI's system prompt for better SQL generation."
```

---

## Task 3: Build `dim_pool` dbt Model

**Files:**
- Create: `dbt/models/warehouse/dim_pool.sql`

**Context:** Pool dimension — unblocks gallons, pool type, and filter pressure queries. Source: `stg_pool` joined to `stg_service_location` for `customer_id`. The join is needed because `stg_pool` has `service_location_id` but not `customer_id` directly.

**Step 1: Create the model**

Create `dbt/models/warehouse/dim_pool.sql`:

```sql
select
    p.company_id,
    p._company_name,
    p.pool_id,
    p.service_location_id,
    sl.customer_id,
    p.pool_name,
    p.gallons,
    p.baseline_filter_pressure,
    p.notes
from {{ ref('stg_pool') }} p
left join {{ ref('stg_service_location') }} sl
    on p.service_location_id = sl.service_location_id
```

**Step 2: Test locally by running dbt**

Run from VPS (SSH): `cd /opt/splashworks/dbt && dbt run --select dim_pool`

Expected: `1 of 1 OK created table model public_warehouse.dim_pool`

If testing locally against local Postgres:
Run: `cd dbt && dbt run --select dim_pool`

**Step 3: Validate the model has data**

Run via psql or the API's `/api/query/raw` endpoint:
```sql
SELECT _company_name, COUNT(*) AS pool_count, AVG(gallons) AS avg_gallons
FROM public_warehouse.dim_pool
GROUP BY _company_name
```

Expected: Both AQPS and JOMO rows with pool_count > 0.

**Step 4: Commit**

```bash
git add dbt/models/warehouse/dim_pool.sql
git commit -m "feat: dim_pool warehouse model — pool/body of water dimension"
```

---

## Task 4: Build `fact_service_stop` dbt Model

**Files:**
- Create: `dbt/models/warehouse/fact_service_stop.sql`

**Context:** Core operational grain — one row per visit per pool. Answers duration, frequency, and completion questions. Uses `stg_route_stop` LEFT JOIN `stg_service_stop` because skipped stops (service_status = 0) have no service_stop record but should still appear as rows. Gets `customer_id` from `stg_service_location` via `service_location_id`.

**Step 1: Create the model**

Create `dbt/models/warehouse/fact_service_stop.sql`:

```sql
select
    rs._company_name,
    rs.company_id,
    rs.route_stop_id,
    ss.service_stop_id,
    rs.service_location_id,
    sl.customer_id,
    ss.pool_id,
    rs.account_id as tech_id,
    rs.service_date,
    substr(rs.service_date, 1, 7) as service_month,
    rs.start_time,
    rs.complete_time,
    rs.minutes_at_stop,
    rs.service_status,
    ss.notes,
    ss.notes_to_customer
from {{ ref('stg_route_stop') }} rs
left join {{ ref('stg_service_stop') }} ss
    on rs.route_stop_id = ss.route_stop_id
    and rs.service_date = ss.service_date
left join {{ ref('stg_service_location') }} sl
    on rs.service_location_id = sl.service_location_id
```

**Step 2: Test locally by running dbt**

Run: `cd dbt && dbt run --select fact_service_stop`

Expected: `1 of 1 OK created table model public_warehouse.fact_service_stop`

**Step 3: Validate the model**

```sql
SELECT _company_name,
       COUNT(*) AS total_stops,
       SUM(service_status) AS completed,
       COUNT(*) - SUM(service_status) AS skipped,
       AVG(minutes_at_stop) AS avg_minutes
FROM public_warehouse.fact_service_stop
GROUP BY _company_name
```

Expected: Both companies present. `avg_minutes` should be ~27. Skipped count > 0.

**Step 4: Commit**

```bash
git add dbt/models/warehouse/fact_service_stop.sql
git commit -m "feat: fact_service_stop warehouse model — service visit grain"
```

---

## Task 5: Build `fact_payment` dbt Model

**Files:**
- Create: `dbt/models/warehouse/fact_payment.sql`

**Context:** Payment tracking. Joins `stg_payment` to `stg_invoice` for `customer_id` (since payments reference invoices, not customers directly).

**Step 1: Create the model**

Create `dbt/models/warehouse/fact_payment.sql`:

```sql
select
    p._company_name,
    p.company_id,
    p.payment_id,
    p.invoice_id,
    i.customer_id,
    p.amount,
    p.payment_date,
    p.payment_method
from {{ ref('stg_payment') }} p
left join {{ ref('stg_invoice') }} i
    on p.invoice_id = i.invoice_id
```

**Step 2: Test locally by running dbt**

Run: `cd dbt && dbt run --select fact_payment`

Expected: `1 of 1 OK created table model public_warehouse.fact_payment`

**Step 3: Validate the model**

```sql
SELECT _company_name, payment_method, COUNT(*) AS cnt, SUM(amount) AS total
FROM public_warehouse.fact_payment
GROUP BY _company_name, payment_method
ORDER BY total DESC
```

Expected: Card is most common (~9681), then Check, Credit, Other, Bank, Cash.

**Step 4: Commit**

```bash
git add dbt/models/warehouse/fact_payment.sql
git commit -m "feat: fact_payment warehouse model — payment tracking"
```

---

## Task 6: Build `semantic_profit` dbt Model

**Files:**
- Create: `dbt/models/semantic/semantic_profit.sql`

**Context:** Per-customer, per-month profitability matching Skimmer's Profit Report. Formula: `service_rate - (labor_cost + dosage_cost) = profit`. Sources:
- `dim_customer` — customer name and company
- `dim_service_location` — service rate and rate type (one customer can have multiple locations)
- `fact_service_stop` — completed stop counts per month (service_status = 1)
- `fact_labor` — aggregated labor cost per customer/month
- `fact_dosage` — aggregated dosage cost per customer/month

The tricky part: a customer may have multiple service locations with different rates. We aggregate at the customer + month level, using the location-level rate from `dim_service_location`.

**Step 1: Create the model**

Create `dbt/models/semantic/semantic_profit.sql`:

```sql
{{ config(materialized='table') }}

with customer_locations as (
    select
        sl.customer_id,
        sl._company_name,
        sl.rate,
        sl.rate_type,
        sl.labor_cost as location_labor_cost,
        sl.labor_cost_type
    from {{ ref('dim_service_location') }} sl
),

monthly_stops as (
    select
        fs.customer_id,
        fs._company_name,
        fs.service_month,
        count(case when fs.service_status = 1 then 1 end) as stop_count
    from {{ ref('fact_service_stop') }} fs
    group by fs.customer_id, fs._company_name, fs.service_month
),

monthly_labor as (
    select
        fl.customer_id,
        fl._company_name,
        fl.service_month,
        sum(case
            when fl.labor_cost_type = 'PerStop' and fl.service_status = 1
            then coalesce(fl.labor_cost, 0)
            else 0
        end) as per_stop_labor_cost,
        max(case
            when fl.labor_cost_type = 'PerMonth'
            then coalesce(fl.labor_cost, 0)
            else 0
        end) as per_month_labor_cost
    from {{ ref('fact_labor') }} fl
    group by fl.customer_id, fl._company_name, fl.service_month
),

monthly_dosage as (
    select
        fd.customer_id,
        fd._company_name,
        fd.service_month,
        sum(coalesce(fd.dosage_cost, 0)) as dosage_cost
    from {{ ref('fact_dosage') }} fd
    group by fd.customer_id, fd._company_name, fd.service_month
),

customer_rate as (
    select
        customer_id,
        _company_name,
        sum(coalesce(rate, 0)) as service_rate,
        max(rate_type) as rate_type
    from customer_locations
    group by customer_id, _company_name
)

select
    c._company_name,
    c.customer_id,
    c.clean_customer_name as customer_name,
    ms.service_month,
    cr.rate_type,
    cr.service_rate,
    coalesce(ml.per_stop_labor_cost, 0) + coalesce(ml.per_month_labor_cost, 0) as labor_cost,
    coalesce(md.dosage_cost, 0) as dosage_cost,
    coalesce(ml.per_stop_labor_cost, 0) + coalesce(ml.per_month_labor_cost, 0) + coalesce(md.dosage_cost, 0) as total_cost,
    cr.service_rate - (coalesce(ml.per_stop_labor_cost, 0) + coalesce(ml.per_month_labor_cost, 0) + coalesce(md.dosage_cost, 0)) as profit,
    coalesce(ms.stop_count, 0) as stop_count
from {{ ref('dim_customer') }} c
inner join monthly_stops ms
    on c.customer_id = ms.customer_id
    and c._company_name = ms._company_name
left join customer_rate cr
    on c.customer_id = cr.customer_id
    and c._company_name = cr._company_name
left join monthly_labor ml
    on c.customer_id = ml.customer_id
    and c._company_name = ml._company_name
    and ms.service_month = ml.service_month
left join monthly_dosage md
    on c.customer_id = md.customer_id
    and c._company_name = md._company_name
    and ms.service_month = md.service_month
where c.is_inactive = 0
```

**Step 2: Test locally by running dbt**

Run: `cd dbt && dbt run --select semantic_profit`

Expected: `1 of 1 OK created table model public_semantic.semantic_profit`

**Step 3: Validate the model**

```sql
SELECT _company_name,
       COUNT(*) AS rows,
       AVG(profit) AS avg_profit,
       SUM(profit) AS total_profit
FROM public_semantic.semantic_profit
GROUP BY _company_name
```

Expected: Both companies present. Profit should be positive on average (service rate > costs for most customers).

Also validate the formula:
```sql
SELECT customer_name, service_month, service_rate, labor_cost, dosage_cost, total_cost, profit,
       service_rate - total_cost AS computed_profit
FROM public_semantic.semantic_profit
LIMIT 5
```

Expected: `profit` = `computed_profit` for every row.

**Step 4: Commit**

```bash
git add dbt/models/semantic/semantic_profit.sql
git commit -m "feat: semantic_profit model — customer profitability per month

Matches Skimmer's Profit Report: profit = service_rate - labor_cost - dosage_cost"
```

---

## Task 7: Run Full dbt Build and Validate

**Context:** After creating the 4 new models individually, run a full `dbt build` to ensure everything compiles together and no existing models are broken.

**Step 1: Run full dbt build**

Run: `cd dbt && dbt build`

Expected: All models pass (18 staging views + 15 warehouse tables + 9 semantic tables = 42+ models). No errors.

**Step 2: Validate new model row counts**

```sql
SELECT 'dim_pool' AS model, COUNT(*) AS rows FROM public_warehouse.dim_pool
UNION ALL
SELECT 'fact_service_stop', COUNT(*) FROM public_warehouse.fact_service_stop
UNION ALL
SELECT 'fact_payment', COUNT(*) FROM public_warehouse.fact_payment
UNION ALL
SELECT 'semantic_profit', COUNT(*) FROM public_semantic.semantic_profit
```

Expected: All 4 have rows > 0.

**Step 3: Commit (if any fixes were needed)**

Only commit if fixes were required during the full build.

---

## Task 8: Extend E2E Tests

**Files:**
- Create: `api/tests/e2e/test_enrichment.py`

**Context:** New E2E tests validating the 4 new models work through the full API stack. These tests exercise:
1. Raw SQL queries against the new warehouse tables
2. A natural language query that previously failed ("pools > 10000 gallons")
3. Profit model validation

All tests should skip gracefully if the live API is not available (same pattern as existing E2E tests).

**Step 1: Create the test file**

Create `api/tests/e2e/test_enrichment.py`:

```python
"""
E2E Enrichment Tests: Validate New Warehouse Models Through Full Stack

WHY THIS TEST EXISTS:
    The semantic enrichment batch added 4 new models:
    - dim_pool (gallons, pool type)
    - fact_service_stop (visit duration, completion)
    - fact_payment (payment tracking)
    - semantic_profit (customer profitability)

    These tests prove each model is queryable through the API and
    that the AI can now answer questions that previously failed.

SKIP BEHAVIOR:
    All tests skip gracefully if the live API is not reachable.
"""

import os

import pytest
import requests

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8080")


def requires_live_api() -> bool:
    """Return True if the API is reachable and healthy."""
    try:
        resp = requests.get(f"{BASE_URL}/api/health", timeout=5)
        return resp.status_code == 200
    except requests.ConnectionError:
        return False
    except Exception:
        return False


@pytest.mark.skipif(not requires_live_api(), reason="Live API not available")
class TestEnrichmentModels:
    """E2E tests validating semantic enrichment models through the API."""

    def test_dim_pool_has_data(self):
        """Verify dim_pool contains pool data for both companies."""
        sql = """
            SELECT _company_name, COUNT(*) AS pool_count
            FROM public_warehouse.dim_pool
            GROUP BY _company_name
            ORDER BY _company_name
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] >= 1, "dim_pool is empty"

    def test_dim_pool_gallons_query(self):
        """Query pools with gallons > 10000 — this previously failed."""
        sql = """
            SELECT c.clean_customer_name, p._company_name, p.pool_name, p.gallons
            FROM public_warehouse.dim_pool p
            JOIN public_warehouse.dim_customer c
                ON p.customer_id = c.customer_id AND p._company_name = c._company_name
            WHERE p.gallons > 10000 AND c.is_inactive = 0
            ORDER BY p.gallons DESC
            LIMIT 10
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] > 0, "No pools > 10000 gallons found"

    def test_fact_service_stop_has_data(self):
        """Verify fact_service_stop contains service visit data."""
        sql = """
            SELECT _company_name,
                   COUNT(*) AS total,
                   SUM(service_status) AS completed,
                   AVG(minutes_at_stop) AS avg_minutes
            FROM public_warehouse.fact_service_stop
            GROUP BY _company_name
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] >= 1, "fact_service_stop is empty"

    def test_fact_payment_has_data(self):
        """Verify fact_payment contains payment data with expected methods."""
        sql = """
            SELECT _company_name, payment_method, COUNT(*) AS cnt
            FROM public_warehouse.fact_payment
            GROUP BY _company_name, payment_method
            ORDER BY cnt DESC
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] >= 1, "fact_payment is empty"

        # Card should be the most common payment method
        method_col = body["columns"].index("payment_method")
        first_method = body["results"][0][method_col]
        assert first_method == "Card", (
            f"Expected Card as most common payment method, got {first_method}"
        )

    def test_semantic_profit_has_data(self):
        """Verify semantic_profit contains profitability data."""
        sql = """
            SELECT _company_name, COUNT(*) AS rows, AVG(profit) AS avg_profit
            FROM public_semantic.semantic_profit
            GROUP BY _company_name
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] >= 1, "semantic_profit is empty"

    def test_semantic_profit_formula(self):
        """Verify profit = service_rate - total_cost in semantic_profit."""
        sql = """
            SELECT customer_name, service_rate, total_cost, profit,
                   ABS(profit - (service_rate - total_cost)) AS formula_diff
            FROM public_semantic.semantic_profit
            WHERE service_rate > 0
            LIMIT 10
        """
        resp = requests.post(
            f"{BASE_URL}/api/query/raw", json={"sql": sql}, timeout=15
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] > 0

        # formula_diff should be 0 (or very close due to floating point)
        diff_col = body["columns"].index("formula_diff")
        for row in body["results"]:
            assert row[diff_col] < 0.01, (
                f"Profit formula mismatch: diff={row[diff_col]}"
            )

    def test_nl_pools_query(self):
        """Ask the AI about pools > 10000 gallons — this originally failed.

        WHY: This is the capstone — the exact question that prompted
        the semantic enrichment batch. If this works, the enrichment succeeded.
        """
        resp = requests.post(
            f"{BASE_URL}/api/query",
            json={
                "question": "Show me customers with pools larger than 10000 gallons",
                "layer": "warehouse",
            },
            timeout=30,
        )
        assert resp.status_code == 200

        body = resp.json()
        assert "sql" in body
        assert "SELECT" in body["sql"].upper()

        # The AI should reference dim_pool or the warehouse schema
        sql_upper = body["sql"].upper()
        uses_correct_schema = (
            "PUBLIC_WAREHOUSE" in sql_upper or "DIM_POOL" in sql_upper
        )
        assert uses_correct_schema, (
            f"Expected SQL to reference warehouse schema or dim_pool. SQL: {body['sql']}"
        )

        assert body["row_count"] > 0, (
            f"Expected results for pools > 10000 gallons. SQL: {body['sql']}"
        )
```

**Step 2: Run tests locally (they'll skip without live API)**

Run: `cd api && python -m pytest tests/e2e/test_enrichment.py -v`

Expected: All tests SKIPPED (no live API locally).

**Step 3: Commit**

```bash
git add api/tests/e2e/test_enrichment.py
git commit -m "test: E2E tests for semantic enrichment models

7 tests covering dim_pool, fact_service_stop, fact_payment,
semantic_profit, and NL query for pools > 10000 gallons."
```

---

## Task 9: Deploy to VPS and Run E2E Tests

**Context:** Deploy the updated code to VPS: pull latest code, run dbt to build new models, rebuild the API container (picks up new YAML), then run all E2E tests.

**Step 1: SSH to VPS and pull latest code**

```bash
ssh root@76.13.29.44
cd /opt/splashworks
git pull origin feature/warehouse-etl
```

**Step 2: Run dbt to build new models**

```bash
cd /opt/splashworks/dbt
dbt run --select dim_pool fact_service_stop fact_payment semantic_profit
```

Expected: 4 models created successfully.

**Step 3: Rebuild and restart the API container**

```bash
cd /opt/splashworks
docker compose up -d --build api
```

Expected: API container rebuilt with new YAML, starts healthy.

**Step 4: Verify health endpoint**

```bash
curl -s http://localhost:8080/api/health | python3 -m json.tool
```

Expected: `{"status": "healthy", "postgres": "connected", ...}`

**Step 5: Run all E2E tests**

```bash
cd /opt/splashworks
API_BASE_URL=http://localhost:8080 python3 -m pytest api/tests/e2e/ -v
```

Expected: All tests pass — existing smoke (4) + acid (4) + new enrichment (7) = 15 tests.

**Step 6: Test the pools question through the live app**

Open `https://app.splshwrks.com` in browser, ask: "Show me customers with pools larger than 10000 gallons"

Expected: Results returned (no longer "Query execution error").

**Step 7: Commit any VPS-specific fixes (if needed)**

Only commit if fixes were required during deployment.

---

## Task 10: Update Progress and Memory

**Files:**
- Modify: `docs/plans/PROGRESS.md`

**Context:** Update progress tracker with the completed semantic enrichment batch.

**Step 1: Update PROGRESS.md**

Add a new section after the Phase 1 table:

```markdown
## Interstitial: Semantic Enrichment (between Phase 1 and Phase 2)

| Step | Deliverable | Status |
|------|-------------|--------|
| SE.1 | Semantic layer YAML rewrite (15 business terms, 8 verified queries) | DONE |
| SE.2 | System prompt builder update (tables, metrics, data gaps, join clauses) | DONE |
| SE.3 | dim_pool warehouse model | DONE |
| SE.4 | fact_service_stop warehouse model | DONE |
| SE.5 | fact_payment warehouse model | DONE |
| SE.6 | semantic_profit semantic model | DONE |
| SE.7 | E2E enrichment tests (7 tests) | DONE |
| SE.8 | VPS deployment + validation | DONE |
```

Update the Current Status section at the top.

Update the Session Log with a new row.

**Step 2: Commit**

```bash
git add docs/plans/PROGRESS.md
git commit -m "docs: update progress — semantic enrichment batch complete"
```
