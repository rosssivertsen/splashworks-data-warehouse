# Phase 1 Batch A: Data Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Get raw Skimmer data flowing through ETL on VPS into a fully modeled dbt star schema (staging → warehouse → semantic) with SCD2 snapshots.

**Architecture:** ETL loads raw date-stamped tables, then creates stable "current" views. dbt staging models union AQPS + JOMO sources using a macro, clean/type data. Warehouse layer is a star schema (6 dims, 6 facts). Semantic layer materializes 8 KPI views from production SQL queries. SCD2 snapshots track customer and tech changes over time.

**Tech Stack:** Python ETL (psycopg2), dbt-postgres, PostgreSQL 16, SSH to VPS (76.13.29.44)

**Key Pattern — Raw Table Naming:**
ETL creates tables named `raw_skimmer."AQPS_Customer_20260308"`. dbt needs stable names. Solution: ETL creates `CREATE OR REPLACE VIEW raw_skimmer."AQPS_Customer" AS SELECT * FROM raw_skimmer."AQPS_Customer_20260308"` after each load. Staging models use a `union_companies()` macro.

---

## Task 1: Run ETL on VPS + Add Current Views

**Files:**
- Modify: `etl/load.py` (add `create_current_view` function)
- Modify: `etl/main.py` (call view creation after loading)

**Step 1: Add current-view function to `etl/load.py`**

```python
def create_current_view(conn, table_name: str, extract_date: date, company_name: str = "") -> str:
    """Create/replace a view without date suffix pointing to the latest load."""
    prefix = f"{company_name}_" if company_name else ""
    dated_table = f"{prefix}{table_name}_{extract_date.strftime('%Y%m%d')}"
    view_name = f"{prefix}{table_name}"
    view_sql = f'CREATE OR REPLACE VIEW {RAW_SCHEMA}."{view_name}" AS SELECT * FROM {RAW_SCHEMA}."{dated_table}"'
    with conn.cursor() as cur:
        cur.execute(view_sql)
    conn.commit()
    return f'{RAW_SCHEMA}."{view_name}"'
```

**Step 2: Call it in `etl/main.py` after successful table load**

After line `company_summary["rows"] += loaded` add:
```python
                    # Create/update current view (stable name for dbt)
                    create_current_view(conn, table_name, extract_date, company_name)
```

And add the import at top:
```python
from etl.load import create_raw_table, create_current_view, drop_raw_table, get_connection, load_rows_copy
```

**Step 3: Run ETL on VPS**

```bash
ssh root@76.13.29.44 'bash -s' << 'SCRIPT'
cd /opt/splashworks
git pull origin feature/warehouse-etl

# Install Python dependencies
apt-get install -y -qq python3-pip python3-venv
cd etl
python3 -m venv .venv
source .venv/bin/activate
pip install -q psycopg2-binary

# Run ETL
DB_PASSWORD=$(grep DB_PASSWORD /opt/splashworks/.env | cut -d= -f2)
DATABASE_URL="postgresql://splashworks:${DB_PASSWORD}@localhost:5432/splashworks" \
  python -m etl.main /opt/splashworks/data/extracts
SCRIPT
```

**Step 4: Verify raw tables + views exist**

```bash
ssh root@76.13.29.44 'docker compose -f /opt/splashworks/docker-compose.yml exec -T postgres psql -U splashworks -d splashworks -c "
  SELECT table_type, table_name
  FROM information_schema.tables
  WHERE table_schema = '\''raw_skimmer'\''
  ORDER BY table_type, table_name
  LIMIT 30;
"'
```

Expected: BASE TABLEs with date suffixes + VIEWs without date suffixes.

**Step 5: Verify row counts**

```bash
ssh root@76.13.29.44 'docker compose -f /opt/splashworks/docker-compose.yml exec -T postgres psql -U splashworks -d splashworks -c "
  SELECT company_name, COUNT(*) as tables_loaded, SUM(row_count) as total_rows
  FROM public.etl_load_log
  WHERE status = '\''completed'\''
  GROUP BY company_name;
"'
```

Expected: AQPS ~189K rows, JOMO ~522K rows (may vary slightly from local due to newer extract).

**Step 6: Commit**

```bash
git add etl/load.py etl/main.py
git commit -m "feat: ETL creates current views for stable dbt source names"
```

---

## Task 2: dbt Source Macro + Updated Sources

**Files:**
- Create: `dbt/macros/union_companies.sql`
- Modify: `dbt/models/staging/_sources.yml`

**Step 1: Create the union macro**

`dbt/macros/union_companies.sql`:
```sql
{# Union a raw table across all companies.
   Usage: {{ union_companies('Customer') }}
   Returns: SELECT *, 'AQPS' as _company FROM raw_skimmer."AQPS_Customer" UNION ALL ...
#}

{% macro union_companies(table_name) %}
    SELECT *, 'AQPS' AS _company_name
    FROM {{ source('raw_skimmer', 'AQPS_' ~ table_name) }}

    UNION ALL

    SELECT *, 'JOMO' AS _company_name
    FROM {{ source('raw_skimmer', 'JOMO_' ~ table_name) }}
{% endmacro %}
```

**Step 2: Update `_sources.yml` to list company-prefixed views**

Replace the existing sources file with company-prefixed source names. The ETL creates views like `AQPS_Customer`, `JOMO_Customer` etc.

List the 18 key tables x 2 companies = 36 source entries. Use a YAML anchor pattern for DRY:

```yaml
version: 2

sources:
  - name: raw_skimmer
    schema: raw_skimmer
    description: "Raw Skimmer nightly SQLite extracts loaded by ETL. Views point to latest date-stamped table."
    tables:
      # --- AQPS ---
      - name: AQPS_Customer
      - name: AQPS_ServiceLocation
      - name: AQPS_Pool
      - name: AQPS_Account
      - name: AQPS_ServiceStop
      - name: AQPS_ServiceStopEntry
      - name: AQPS_EntryDescription
      - name: AQPS_RouteStop
      - name: AQPS_RouteAssignment
      - name: AQPS_WorkOrder
      - name: AQPS_WorkOrderType
      - name: AQPS_Invoice
      - name: AQPS_InvoiceItem
      - name: AQPS_InvoiceLocation
      - name: AQPS_Product
      - name: AQPS_Payment
      - name: AQPS_CustomerTag
      - name: AQPS_Tag
      # --- JOMO ---
      - name: JOMO_Customer
      - name: JOMO_ServiceLocation
      - name: JOMO_Pool
      - name: JOMO_Account
      - name: JOMO_ServiceStop
      - name: JOMO_ServiceStopEntry
      - name: JOMO_EntryDescription
      - name: JOMO_RouteStop
      - name: JOMO_RouteAssignment
      - name: JOMO_WorkOrder
      - name: JOMO_WorkOrderType
      - name: JOMO_Invoice
      - name: JOMO_InvoiceItem
      - name: JOMO_InvoiceLocation
      - name: JOMO_Product
      - name: JOMO_Payment
      - name: JOMO_CustomerTag
      - name: JOMO_Tag
```

**Step 3: Commit**

```bash
git add dbt/macros/union_companies.sql dbt/models/staging/_sources.yml
git commit -m "feat: add union_companies macro and company-prefixed dbt sources"
```

---

## Task 3: dbt Staging Models

**Files:**
- Create 18 staging model files in `dbt/models/staging/`

Each staging model: unions AQPS+JOMO via macro, renames to snake_case, casts types, filters `deleted = 0`. Materialized as VIEWs (per dbt_project.yml config).

**Step 1: Create all 18 staging models**

File naming: `dbt/models/staging/stg_customer.sql`, etc.

Key models (create all 18):

`stg_customer.sql`:
```sql
with source as (
    {{ union_companies('Customer') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as customer_id,
        "FirstName" as first_name,
        "LastName" as last_name,
        "CompanyName" as company_name,
        cast("DisplayAsCompany" as integer) as display_as_company,
        case
            when cast("DisplayAsCompany" as integer) = 1 then "CompanyName"
            else "FirstName" || ' ' || "LastName"
        end as clean_customer_name,
        "BillingAddress" as billing_address,
        "BillingCity" as billing_city,
        "BillingState" as billing_state,
        "BillingZip" as billing_zip,
        cast("QboCustomerId" as text) as qbo_customer_id,
        cast("IsInactive" as integer) as is_inactive,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_service_location.sql`:
```sql
with source as (
    {{ union_companies('ServiceLocation') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as service_location_id,
        cast("CustomerId" as text) as customer_id,
        "Address" as address,
        "City" as city,
        "State" as state,
        "Zip" as zip,
        "Notes" as notes,
        cast("Rate" as double precision) as rate,
        "RateType" as rate_type,
        cast("LaborCost" as double precision) as labor_cost,
        "LaborCostType" as labor_cost_type,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_pool.sql`:
```sql
with source as (
    {{ union_companies('Pool') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as pool_id,
        cast("ServiceLocationId" as text) as service_location_id,
        "Name" as pool_name,
        cast("Gallons" as double precision) as gallons,
        cast("BaselineFilterPressure" as double precision) as baseline_filter_pressure,
        "Notes" as notes,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_account.sql`:
```sql
with source as (
    {{ union_companies('Account') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as account_id,
        "FirstName" as first_name,
        "LastName" as last_name,
        "FirstName" || ' ' || "LastName" as full_name,
        "RoleType" as role_type,
        cast("IsActive" as integer) as is_active,
        cast("CanManageRoutes" as integer) as can_manage_routes,
        cast("CanManageAdminPanel" as integer) as can_manage_admin_panel,
        cast("CanManageSettings" as integer) as can_manage_settings,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_service_stop.sql`:
```sql
with source as (
    {{ union_companies('ServiceStop') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as service_stop_id,
        cast("RouteStopId" as text) as route_stop_id,
        cast("PoolId" as text) as pool_id,
        "ServiceDate" as service_date,
        "Notes" as notes,
        "NotesToCustomer" as notes_to_customer,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_service_stop_entry.sql`:
```sql
with source as (
    {{ union_companies('ServiceStopEntry') }}
),

renamed as (
    select
        _company_name,
        cast("id" as text) as service_stop_entry_id,
        cast("ServiceStopId" as text) as service_stop_id,
        cast("PoolId" as text) as pool_id,
        cast("WorkOrderId" as text) as work_order_id,
        cast("EntryDescriptionId" as text) as entry_description_id,
        "ServiceDate" as service_date,
        "EntryType" as entry_type,
        cast("Value" as double precision) as entry_value,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_entry_description.sql`:
```sql
with source as (
    {{ union_companies('EntryDescription') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as entry_description_id,
        "Description" as description,
        "EntryType" as entry_type,
        "UnitOfMeasure" as unit_of_measure,
        "ReadingType" as reading_type,
        "DosageType" as dosage_type,
        cast("Cost" as double precision) as cost,
        cast("Price" as double precision) as price,
        cast("CanIncludeWithService" as integer) as can_include_with_service,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_route_stop.sql`:
```sql
with source as (
    {{ union_companies('RouteStop') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as route_stop_id,
        cast("ServiceLocationId" as text) as service_location_id,
        cast("AccountId" as text) as account_id,
        "ServiceDate" as service_date,
        "StartTime" as start_time,
        "CompleteTime" as complete_time,
        cast("MinutesAtStop" as double precision) as minutes_at_stop,
        {{ service_status('"StartTime"', '"CompleteTime"') }} as service_status,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_route_assignment.sql`:
```sql
with source as (
    {{ union_companies('RouteAssignment') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as route_assignment_id,
        cast("ServiceLocationId" as text) as service_location_id,
        cast("AccountId" as text) as account_id,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_work_order.sql`:
```sql
with source as (
    {{ union_companies('WorkOrder') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as work_order_id,
        cast("WorkOrderTypeId" as text) as work_order_type_id,
        cast("ServiceLocationId" as text) as service_location_id,
        cast("AccountId" as text) as account_id,
        "ServiceDate" as service_date,
        "StartTime" as start_time,
        "CompleteTime" as complete_time,
        {{ service_status('"StartTime"', '"CompleteTime"') }} as service_status,
        "WorkNeeded" as work_needed,
        "WorkPerformed" as work_performed,
        "Notes" as notes,
        cast("LaborCost" as double precision) as labor_cost,
        cast("Price" as double precision) as price,
        cast("EstimatedMinutes" as double precision) as estimated_minutes,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_work_order_type.sql`:
```sql
with source as (
    {{ union_companies('WorkOrderType') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as work_order_type_id,
        "Name" as name,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_invoice.sql`:
```sql
with source as (
    {{ union_companies('Invoice') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as invoice_id,
        cast("CustomerId" as text) as customer_id,
        "InvoiceNumber" as invoice_number,
        "InvoiceDate" as invoice_date,
        "DueDate" as due_date,
        "Status" as status,
        "PaymentStatus" as payment_status,
        cast("Total" as double precision) as total,
        cast("SubTotal" as double precision) as sub_total,
        cast("TaxAmount" as double precision) as tax_amount,
        cast("PaidAmount" as double precision) as paid_amount,
        cast("AmountDue" as double precision) as amount_due,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_invoice_item.sql`:
```sql
with source as (
    {{ union_companies('InvoiceItem') }}
),

renamed as (
    select
        _company_name,
        cast("id" as text) as invoice_item_id,
        cast("InvoiceLocationId" as text) as invoice_location_id,
        cast("ProductId" as text) as product_id,
        "Item" as item,
        "Description" as description,
        cast("Quantity" as double precision) as quantity,
        cast("Rate" as double precision) as rate,
        cast("Amount" as double precision) as amount,
        cast("Subtotal" as double precision) as subtotal,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_invoice_location.sql`:
```sql
with source as (
    {{ union_companies('InvoiceLocation') }}
),

renamed as (
    select
        _company_name,
        cast("id" as text) as invoice_location_id,
        cast("InvoiceId" as text) as invoice_id,
        cast("ServiceLocationId" as text) as service_location_id,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_product.sql`:
```sql
with source as (
    {{ union_companies('Product') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as product_id,
        "Name" as name,
        cast("QboItemId" as text) as qbo_item_id,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_payment.sql`:
```sql
with source as (
    {{ union_companies('Payment') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as payment_id,
        cast("InvoiceId" as text) as invoice_id,
        cast("Amount" as double precision) as amount,
        "PaymentDate" as payment_date,
        "PaymentMethod" as payment_method,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_customer_tag.sql`:
```sql
with source as (
    {{ union_companies('CustomerTag') }}
),

renamed as (
    select
        _company_name,
        cast("id" as text) as customer_tag_id,
        cast("CustomerId" as text) as customer_id,
        cast("TagId" as text) as tag_id,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

`stg_tag.sql`:
```sql
with source as (
    {{ union_companies('Tag') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as tag_id,
        "Name" as name,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
```

**Step 2: Run dbt to verify staging builds**

```bash
cd dbt
DBT_HOST=localhost DBT_PASSWORD=$(grep DB_PASSWORD ../.env | cut -d= -f2) dbt run --select staging
```

Expected: 18 models created as views in staging schema.

**Step 3: Verify row counts match ETL**

```bash
docker compose exec -T postgres psql -U splashworks -d splashworks -c "
  SELECT 'stg_customer' as model, count(*) FROM staging.stg_customer
  UNION ALL SELECT 'stg_service_stop', count(*) FROM staging.stg_service_stop
  UNION ALL SELECT 'stg_route_stop', count(*) FROM staging.stg_route_stop;
"
```

**Step 4: Commit**

```bash
git add dbt/models/staging/
git commit -m "feat: add 18 dbt staging models with company union"
```

---

## Task 4: dbt Warehouse Models (Dimensions + Facts)

**Files:**
- Create 12 model files in `dbt/models/warehouse/`
- Create: `dbt/models/warehouse/_warehouse.yml` (schema tests)

**Dimensions** (6):

`dbt/models/warehouse/dim_customer.sql`:
```sql
select
    company_id,
    _company_name,
    customer_id,
    first_name,
    last_name,
    clean_customer_name,
    company_name,
    display_as_company,
    billing_city,
    billing_state,
    billing_zip,
    qbo_customer_id,
    is_inactive
from {{ ref('stg_customer') }}
```

`dbt/models/warehouse/dim_service_location.sql`:
```sql
select
    sl.company_id,
    sl._company_name,
    sl.service_location_id,
    sl.customer_id,
    sl.city,
    sl.state,
    sl.zip,
    sl.rate,
    sl.rate_type,
    sl.labor_cost,
    sl.labor_cost_type
from {{ ref('stg_service_location') }} sl
```

`dbt/models/warehouse/dim_tech.sql`:
```sql
select
    company_id,
    _company_name,
    account_id as tech_id,
    first_name,
    last_name,
    full_name,
    role_type,
    is_active,
    can_manage_routes,
    can_manage_admin_panel,
    can_manage_settings
from {{ ref('stg_account') }}
```

`dbt/models/warehouse/dim_company.sql`:
```sql
select
    company_id,
    company_name,
    company_full_name
from {{ ref('company_lookup') }}
```

`dbt/models/warehouse/dim_date.sql`:
```sql
{{ config(materialized='table') }}

with date_spine as (
    {{ dbt_utils.date_spine(
        datepart="day",
        start_date="cast('2024-01-01' as date)",
        end_date="cast('2027-12-31' as date)"
    ) }}
),

dates as (
    select
        cast(date_day as date) as date_key,
        extract(dow from date_day) as day_of_week,
        extract(day from date_day) as day_of_month,
        extract(week from date_day) as week_of_year,
        extract(month from date_day) as month_num,
        to_char(date_day, 'Month') as month_name,
        extract(quarter from date_day) as quarter,
        extract(year from date_day) as year,
        to_char(date_day, 'YYYY-MM') as year_month,
        case
            when extract(month from date_day) in (3,4,5) then 'Spring'
            when extract(month from date_day) in (6,7,8) then 'Summer'
            when extract(month from date_day) in (9,10,11) then 'Fall'
            else 'Winter'
        end as season
    from date_spine
)

select * from dates
```

`dbt/models/warehouse/dim_chemical.sql`:
```sql
select distinct
    company_id,
    _company_name,
    entry_description_id as chemical_id,
    description,
    entry_type,
    unit_of_measure,
    reading_type,
    dosage_type,
    cost,
    price,
    can_include_with_service
from {{ ref('stg_entry_description') }}
```

**Facts** (6):

`dbt/models/warehouse/fact_labor.sql` — from FactLabor_v2:
```sql
select
    ss.company_id,
    ss._company_name,
    ss.service_stop_id,
    rs.route_stop_id,
    rs.service_date,
    substr(rs.service_date, 1, 7) as service_month,
    rs.account_id as tech_id,
    rs.minutes_at_stop,
    rs.service_status,
    sl.customer_id,
    sl.service_location_id,
    sl.rate,
    sl.rate_type,
    sl.labor_cost,
    sl.labor_cost_type
from {{ ref('stg_service_stop') }} ss
left join {{ ref('stg_route_stop') }} rs
    on ss.route_stop_id = rs.route_stop_id
    and ss.service_date = rs.service_date
left join {{ ref('stg_service_location') }} sl
    on rs.service_location_id = sl.service_location_id
```

`dbt/models/warehouse/fact_dosage.sql` — from FactDosage_v2:
```sql
select
    ss.company_id,
    ss._company_name,
    ss.service_stop_id,
    rs.route_stop_id,
    rs.service_date,
    substr(rs.service_date, 1, 7) as service_month,
    rs.account_id as tech_id,
    sl.service_location_id,
    sl.customer_id,
    sse.entry_type,
    sse.entry_value,
    ed.description as entry_description,
    ed.unit_of_measure,
    ed.reading_type,
    ed.dosage_type,
    ed.cost as unit_cost,
    ed.price as unit_price,
    ed.can_include_with_service,
    coalesce(sse.entry_value, 0) * coalesce(ed.cost, 0) as dosage_cost,
    coalesce(sse.entry_value, 0) * coalesce(ed.price, 0) as dosage_price
from {{ ref('stg_service_stop') }} ss
left join {{ ref('stg_route_stop') }} rs
    on ss.route_stop_id = rs.route_stop_id
left join {{ ref('stg_service_location') }} sl
    on rs.service_location_id = sl.service_location_id
left join {{ ref('stg_service_stop_entry') }} sse
    on ss.service_stop_id = sse.service_stop_id
    and ss.pool_id = sse.pool_id
    and ss.service_date = sse.service_date
    and sse.entry_type = 'Dosage'
left join {{ ref('stg_entry_description') }} ed
    on sse.entry_description_id = ed.entry_description_id
```

`dbt/models/warehouse/fact_work_order.sql` — from FactWorkOrder_v2:
```sql
select
    wo.company_id,
    wo._company_name,
    wo.work_order_id,
    wo.work_order_type_id,
    wo.service_location_id,
    wo.account_id as tech_id,
    wo.service_date,
    substr(wo.service_date, 1, 7) as service_month,
    wo.start_time,
    wo.complete_time,
    wo.service_status,
    wo.labor_cost,
    wo.price,
    sl.customer_id
from {{ ref('stg_work_order') }} wo
left join {{ ref('stg_service_location') }} sl
    on wo.service_location_id = sl.service_location_id
```

`dbt/models/warehouse/fact_work_order_dosage.sql` — from FactWorkOrderDosage:
```sql
select
    wo.company_id,
    wo._company_name,
    wo.work_order_id,
    wo.work_order_type_id,
    wo.service_location_id,
    wo.account_id as tech_id,
    wo.service_date,
    substr(wo.service_date, 1, 7) as service_month,
    wo.start_time,
    wo.complete_time,
    wo.service_status,
    sl.customer_id,
    sse.entry_type,
    sse.entry_value,
    ed.description as entry_description,
    ed.unit_of_measure,
    ed.dosage_type,
    ed.cost as unit_cost,
    ed.price as unit_price,
    coalesce(sse.entry_value, 0) * coalesce(ed.cost, 0) as dosage_cost,
    coalesce(sse.entry_value, 0) * coalesce(ed.price, 0) as dosage_price
from {{ ref('stg_work_order') }} wo
left join {{ ref('stg_service_location') }} sl
    on wo.service_location_id = sl.service_location_id
left join {{ ref('stg_service_stop_entry') }} sse
    on wo.work_order_id = sse.work_order_id
    and wo.service_date = sse.service_date
    and sse.entry_type = 'Dosage'
left join {{ ref('stg_entry_description') }} ed
    on sse.entry_description_id = ed.entry_description_id
```

`dbt/models/warehouse/fact_invoice.sql` — from 02.CustomerInvoiceDetails:
```sql
select
    c.company_id,
    c._company_name,
    c.customer_id,
    c.clean_customer_name,
    i.invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.status as invoice_status,
    i.payment_status,
    sl.service_location_id,
    sl.address as service_location_address,
    sl.city as service_location_city,
    sl.state as service_location_state,
    sl.zip as service_location_zip,
    sl.rate as service_location_rate,
    ii.item as invoice_item,
    ii.description as invoice_item_description,
    ii.quantity,
    ii.rate as item_rate,
    ii.amount as line_total,
    ii.subtotal,
    p.name as product_name,
    p.qbo_item_id as product_qbo_item_id
from {{ ref('stg_customer') }} c
left join {{ ref('stg_invoice') }} i
    on c.customer_id = i.customer_id
    and i.status = 'Sent'
left join {{ ref('stg_invoice_location') }} il
    on i.invoice_id = il.invoice_id
left join {{ ref('stg_service_location') }} sl
    on c.customer_id = sl.customer_id
    and il.service_location_id = sl.service_location_id
left join {{ ref('stg_invoice_item') }} ii
    on il.invoice_location_id = ii.invoice_location_id
left join {{ ref('stg_product') }} pr
    on ii.product_id = pr.product_id
-- Alias pr -> p for product name
cross join lateral (select pr.name, pr.qbo_item_id) as p(name, qbo_item_id)
where c.is_inactive = 0
```

NOTE: The cross join lateral above is Postgres-specific. If it causes issues, flatten to direct column references from `pr`.

`dbt/models/warehouse/fact_dosage_gallons.sql` — from DosageGallons:
```sql
select
    ss.company_id,
    ss._company_name,
    ss.pool_id,
    rs.route_stop_id,
    rs.service_location_id,
    rs.account_id as tech_id,
    rs.service_date,
    pl.pool_name,
    pl.gallons as pool_gallons,
    pl.baseline_filter_pressure,
    sse.entry_type,
    sse.entry_value,
    ed.unit_of_measure,
    ed.reading_type,
    ed.dosage_type,
    ed.cost,
    ed.price,
    ed.can_include_with_service
from {{ ref('stg_service_stop') }} ss
left join {{ ref('stg_route_stop') }} rs
    on ss.route_stop_id = rs.route_stop_id
left join {{ ref('stg_pool') }} pl
    on ss.pool_id = pl.pool_id
    and rs.service_location_id = pl.service_location_id
left join {{ ref('stg_service_stop_entry') }} sse
    on ss.service_stop_id = sse.service_stop_id
    and ss.pool_id = sse.pool_id
    and rs.service_date = sse.service_date
    and sse.entry_type = 'Dosage'
left join {{ ref('stg_entry_description') }} ed
    on sse.entry_description_id = ed.entry_description_id
```

**Step 2: Run warehouse models**

```bash
cd dbt
DBT_HOST=localhost DBT_PASSWORD=$(grep DB_PASSWORD ../.env | cut -d= -f2) dbt run --select warehouse
```

**Step 3: Spot-check key metrics**

```bash
docker compose exec -T postgres psql -U splashworks -d splashworks -c "
  SELECT _company_name, count(*) FROM warehouse.dim_customer GROUP BY 1;
"
```

**Step 4: Commit**

```bash
git add dbt/models/warehouse/
git commit -m "feat: add 12 dbt warehouse models (6 dims + 6 facts)"
```

---

## Task 5: dbt Semantic Models (8 Materialized Views)

**Files:**
- Create 8 model files in `dbt/models/semantic/`

Translated directly from the remaining SQL-Semantic-Queries. Materialized as tables (per dbt_project.yml).

`dbt/models/semantic/service_completion.sql` — from Mapping_ServiceDate_v2:
```sql
select
    rs.company_id,
    rs._company_name,
    rs.account_id,
    rs.service_date,
    substr(rs.service_date, 1, 7) as service_year_month,
    rs.service_status,
    rs.start_time,
    rs.complete_time,
    sl.customer_id
from {{ ref('stg_route_stop') }} rs
left join {{ ref('stg_service_location') }} sl
    on rs.service_location_id = sl.service_location_id
```

`dbt/models/semantic/completed_vs_not.sql` — from Mapping_CompletedVsNotCompletedStops:
```sql
select
    rs.company_id,
    rs._company_name,
    rs.account_id,
    rs.service_date,
    substr(rs.service_date, 1, 7) as service_month,
    sl.customer_id as service_location_customer_id,
    sl.city,
    sl.state,
    sl.zip,
    sl.rate,
    sl.rate_type,
    sl.labor_cost,
    sl.labor_cost_type,
    sse.entry_type,
    sse.entry_value,
    ed.description as entry_description,
    ed.unit_of_measure,
    ed.reading_type,
    ed.dosage_type,
    ed.cost,
    ed.price,
    coalesce(sse.entry_value, 0) * coalesce(ed.cost, 0) as dosage_cost,
    coalesce(sse.entry_value, 0) * coalesce(ed.price, 0) as dosage_price
from {{ ref('stg_route_stop') }} rs
left join {{ ref('stg_service_location') }} sl
    on rs.service_location_id = sl.service_location_id
left join (
    select route_stop_id, max(service_stop_id) as keep_id
    from {{ ref('stg_service_stop') }}
    group by route_stop_id
) latest_ss on rs.route_stop_id = latest_ss.route_stop_id
left join {{ ref('stg_service_stop') }} ss
    on latest_ss.keep_id = ss.service_stop_id
    and rs.service_date = ss.service_date
left join {{ ref('stg_service_stop_entry') }} sse
    on ss.service_stop_id = sse.service_stop_id
    and rs.service_date = sse.service_date
    and sse.entry_type = 'Dosage'
left join {{ ref('stg_entry_description') }} ed
    on sse.entry_description_id = ed.entry_description_id
    and ed.entry_type = 'Dosage'
```

`dbt/models/semantic/tech_monthly_volume.sql` — from MappingServiceDatePerMontPerTech:
```sql
select
    rs.company_id,
    rs._company_name,
    rs.account_id,
    rs.service_date,
    substr(rs.service_date, 1, 7) as service_year_month,
    rs.service_status,
    rs.start_time,
    rs.complete_time,
    sl.customer_id,
    sum(rs.service_status) over (
        partition by sl.customer_id, substr(rs.service_date, 1, 7)
    ) as total_count_per_month,
    count(*) over (
        partition by sl.customer_id, rs.account_id, substr(rs.service_date, 1, 7)
    ) as total_count_per_month_per_tech
from {{ ref('stg_route_stop') }} rs
left join {{ ref('stg_service_location') }} sl
    on rs.service_location_id = sl.service_location_id
```

`dbt/models/semantic/utilization_rate.sql` — from UtilizationRate:
```sql
select
    rs.company_id,
    rs._company_name,
    rs.service_location_id,
    rs.account_id,
    rs.service_date,
    substr(rs.service_date, 1, 7) as service_year_month,
    rs.start_time,
    rs.complete_time,
    rs.service_status as route_stop_status,
    rs.minutes_at_stop,
    null::integer as work_order_status,
    null::double precision as work_order_estimated_minutes,
    sl.customer_id
from {{ ref('stg_route_stop') }} rs
left join {{ ref('stg_service_location') }} sl
    on rs.service_location_id = sl.service_location_id

union all

select
    wo.company_id,
    wo._company_name,
    wo.service_location_id,
    wo.account_id,
    wo.service_date,
    substr(wo.service_date, 1, 7) as service_year_month,
    wo.start_time,
    wo.complete_time,
    null::integer as route_stop_status,
    null::double precision as minutes_at_stop,
    wo.service_status as work_order_status,
    wo.estimated_minutes as work_order_estimated_minutes,
    sl.customer_id
from {{ ref('stg_work_order') }} wo
left join {{ ref('stg_service_location') }} sl
    on wo.service_location_id = sl.service_location_id
```

`dbt/models/semantic/customer_tags.sql` — from InvoiceCustomerTag:
```sql
select
    c.company_id,
    c._company_name,
    c.customer_id,
    c.clean_customer_name,
    t.name as tag_name,
    case
        when max(case when t.name like '%Russells%' then 1 else 0 end) over (
            partition by c.clean_customer_name
        ) = 1
        then 'Russell''s'
        else 'A Quality Pool Service'
    end as clean_tag_name
from {{ ref('stg_customer') }} c
left join {{ ref('stg_customer_tag') }} ct
    on c.customer_id = ct.customer_id
left join {{ ref('stg_tag') }} t
    on ct.tag_id = t.tag_id
```

`dbt/models/semantic/labor_recon.sql` — from AQPSLaborQARecon:
```sql
with base as (
    select
        rs.company_id,
        rs._company_name,
        rs.service_location_id,
        cast(substr(rs.service_date, 6, 2) as integer) as service_date_month_num,
        cast(substr(rs.service_date, 1, 4) as integer) as service_date_year,
        substr(rs.service_date, 1, 7) as service_year_month,
        sl.customer_id,
        rs.service_status,
        c.clean_customer_name,
        sl.address,
        sl.rate,
        sl.rate_type,
        sl.labor_cost,
        sl.labor_cost_type,
        coalesce(sse.entry_value, 0) * coalesce(ed.cost, 0) as dosage_cost,
        coalesce(sse.entry_value, 0) * coalesce(ed.price, 0) as dosage_price
    from {{ ref('stg_route_stop') }} rs
    left join {{ ref('stg_service_location') }} sl
        on rs.service_location_id = sl.service_location_id
    left join {{ ref('stg_customer') }} c
        on sl.customer_id = c.customer_id
    left join {{ ref('stg_service_stop') }} ss
        on rs.route_stop_id = ss.route_stop_id
        and rs.service_date = ss.service_date
    left join {{ ref('stg_service_stop_entry') }} sse
        on ss.service_stop_id = sse.service_stop_id
        and ss.pool_id = sse.pool_id
        and ss.service_date = sse.service_date
        and sse.entry_type = 'Dosage'
    left join {{ ref('stg_entry_description') }} ed
        on sse.entry_description_id = ed.entry_description_id
)

select
    company_id,
    _company_name,
    customer_id,
    service_date_month_num,
    service_date_year,
    service_status,
    clean_customer_name,
    address,
    rate,
    rate_type,
    labor_cost,
    labor_cost_type,
    dosage_cost,
    dosage_price,
    sum(service_status) over (
        partition by service_location_id, service_year_month
    ) as total_count_per_month
from base
where service_status = 1
```

`dbt/models/semantic/invoice_summary.sql` — from QBO_JOMO_Invoice:
```sql
select
    i.company_id,
    i._company_name,
    i.customer_id,
    cast(substr(i.invoice_date, 6, 2) as integer) as invoice_month_num,
    cast(substr(i.invoice_date, 1, 4) as integer) as invoice_year,
    sum(i.total) as invoice_total,
    i.status as invoice_status,
    i.payment_status,
    sum(i.paid_amount) as invoice_paid_amount,
    c.clean_customer_name
from {{ ref('stg_invoice') }} i
left join {{ ref('stg_customer') }} c
    on i.customer_id = c.customer_id
where i.status = 'Sent'
group by
    i.company_id,
    i._company_name,
    i.customer_id,
    i.invoice_number,
    i.invoice_date,
    i.status,
    i.payment_status,
    c.clean_customer_name
```

`dbt/models/semantic/service_invoices.sql` — from ServiceDate_Invoices:
```sql
with base as (
    select
        rs.company_id,
        rs._company_name,
        rs.service_location_id,
        cast(substr(rs.service_date, 6, 2) as integer) as service_date_month_num,
        cast(substr(rs.service_date, 1, 4) as integer) as service_date_year,
        substr(rs.service_date, 1, 7) as service_year_month,
        sl.customer_id,
        rs.service_status,
        c.clean_customer_name
    from {{ ref('stg_route_stop') }} rs
    left join {{ ref('stg_service_location') }} sl
        on rs.service_location_id = sl.service_location_id
    left join {{ ref('stg_customer') }} c
        on sl.customer_id = c.customer_id
)

select
    company_id,
    _company_name,
    customer_id,
    service_date_month_num,
    service_date_year,
    service_status,
    clean_customer_name,
    sum(service_status) over (
        partition by service_location_id, service_year_month
    ) as total_count_per_month
from base
where service_status = 1
```

**Step 2: Run semantic models**

```bash
cd dbt
DBT_HOST=localhost DBT_PASSWORD=$(grep DB_PASSWORD ../.env | cut -d= -f2) dbt run --select semantic
```

**Step 3: Commit**

```bash
git add dbt/models/semantic/
git commit -m "feat: add 8 dbt semantic models from production SQL queries"
```

---

## Task 6: dbt Snapshots (SCD2)

**Files:**
- Create: `dbt/snapshots/snap_customer.sql`
- Create: `dbt/snapshots/snap_tech.sql`

`dbt/snapshots/snap_customer.sql`:
```sql
{% snapshot snap_customer %}
{{
    config(
        target_schema='warehouse',
        unique_key='customer_id || _company_name',
        strategy='check',
        check_cols=['clean_customer_name', 'billing_city', 'billing_state', 'billing_zip', 'is_inactive', 'qbo_customer_id'],
    )
}}

select * from {{ ref('stg_customer') }}

{% endsnapshot %}
```

`dbt/snapshots/snap_tech.sql`:
```sql
{% snapshot snap_tech %}
{{
    config(
        target_schema='warehouse',
        unique_key='account_id || _company_name',
        strategy='check',
        check_cols=['full_name', 'role_type', 'is_active', 'can_manage_routes', 'can_manage_admin_panel'],
    )
}}

select * from {{ ref('stg_account') }}

{% endsnapshot %}
```

**Step 2: Run snapshots**

```bash
cd dbt
DBT_HOST=localhost DBT_PASSWORD=$(grep DB_PASSWORD ../.env | cut -d= -f2) dbt snapshot
```

**Step 3: Verify snapshot columns**

```bash
docker compose exec -T postgres psql -U splashworks -d splashworks -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'warehouse' AND table_name = 'snap_customer'
  ORDER BY ordinal_position;
"
```

Expected: original columns + `dbt_scd_id`, `dbt_updated_at`, `dbt_valid_from`, `dbt_valid_to`.

**Step 4: Commit**

```bash
git add dbt/snapshots/
git commit -m "feat: add SCD2 snapshots for customer and tech dimensions"
```

---

## Task 7: Full Validation + Deploy to VPS

**Step 1: Run full dbt pipeline locally**

```bash
cd dbt
DBT_HOST=localhost DBT_PASSWORD=$(grep DB_PASSWORD ../.env | cut -d= -f2) dbt build
```

Expected: All models, seeds, and snapshots succeed.

**Step 2: Verify key counts**

```bash
docker compose exec -T postgres psql -U splashworks -d splashworks -c "
  SELECT 'staging.stg_customer' as layer, count(*) FROM staging.stg_customer
  UNION ALL SELECT 'warehouse.dim_customer', count(*) FROM warehouse.dim_customer
  UNION ALL SELECT 'warehouse.fact_labor', count(*) FROM warehouse.fact_labor
  UNION ALL SELECT 'warehouse.fact_dosage', count(*) FROM warehouse.fact_dosage
  UNION ALL SELECT 'semantic.utilization_rate', count(*) FROM semantic.utilization_rate
  UNION ALL SELECT 'warehouse.snap_customer', count(*) FROM warehouse.snap_customer
  ORDER BY 1;
"
```

**Step 3: Push to remote, deploy on VPS**

```bash
git push origin feature/warehouse-etl

# Deploy on VPS
ssh root@76.13.29.44 'bash -s' << 'SCRIPT'
cd /opt/splashworks
git pull origin feature/warehouse-etl

# Install dbt
pip install dbt-postgres 2>/dev/null || (apt-get install -y -qq python3-pip && pip install dbt-postgres)

# Run full dbt pipeline
cd dbt
DB_PASSWORD=$(grep DB_PASSWORD /opt/splashworks/.env | cut -d= -f2)
DBT_HOST=localhost DBT_PASSWORD=$DB_PASSWORD dbt deps
DBT_HOST=localhost DBT_PASSWORD=$DB_PASSWORD dbt seed
DBT_HOST=localhost DBT_PASSWORD=$DB_PASSWORD dbt build
SCRIPT
```

**Step 4: Final validation on VPS**

```bash
ssh root@76.13.29.44 'docker compose -f /opt/splashworks/docker-compose.yml exec -T postgres psql -U splashworks -d splashworks -c "
  SELECT schemaname, count(*) as tables
  FROM pg_tables
  WHERE schemaname IN ('\''staging'\'', '\''warehouse'\'', '\''semantic'\'')
  GROUP BY schemaname ORDER BY schemaname;
"'
```

Expected: staging (18 views), warehouse (~14 tables including snapshots), semantic (8 tables).

**Step 5: Update PROGRESS.md**

Mark steps 1.1-1.5 as DONE with notes.

---

## Validation Checklist — Batch A Complete

```
[ ] ETL ran on VPS, loaded both AQPS + JOMO to raw_skimmer
[ ] Current views exist (AQPS_Customer, JOMO_Customer, etc.)
[ ] 18 staging models build as views
[ ] Row counts match between raw and staging
[ ] 6 dimension tables populated
[ ] 6 fact tables populated
[ ] dim_date has 2024-2027 date spine
[ ] 8 semantic models materialized
[ ] SCD2 snapshots created (snap_customer, snap_tech)
[ ] dbt build succeeds end-to-end (no errors)
[ ] All deployed and running on VPS
[ ] PROGRESS.md updated
[ ] All committed and pushed
```
