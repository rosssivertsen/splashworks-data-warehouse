{{ config(materialized='table') }}

-- One row per (customer, service location, recurring work order type).
-- Use case: "what recurring services are due/overdue per location?"
-- Excludes one-time work order types (Recurs = false) — by name, this is the recurring checklist.

with assignments as (
    select
        _company_name,
        company_id,
        location_work_order_type_id,
        service_location_id,
        work_order_type_id,
        last_done_date,
        previous_last_done_date,
        labor_cost as location_labor_cost,
        price as location_price
    from {{ ref('stg_location_work_order_type') }}
),

work_order_types as (
    -- Pull recurring config from raw (Recurs / RecurMonths / RecurType / RecurValue
    -- aren't projected through stg_work_order_type today — kept separate to limit blast radius).
    select
        _company_name,
        cast("id" as text) as work_order_type_id,
        "Description" as work_type,
        cast("Recurs" as integer) as recurs,
        cast("RecurMonths" as integer) as recur_months,
        "RecurType" as recur_type,
        cast("RecurValue" as integer) as recur_value,
        cast("DefaultMinutes" as integer) as default_minutes,
        cast("DefaultLaborCost" as double precision) as default_labor_cost,
        cast("DefaultPrice" as double precision) as default_price
    from {{ union_companies('WorkOrderType') }}
),

locations as (
    select
        _company_name,
        service_location_id,
        customer_id,
        address,
        city,
        state,
        zip
    from {{ ref('dim_service_location') }}
),

customers as (
    select
        _company_name,
        customer_id,
        clean_customer_name,
        is_inactive,
        deleted
    from {{ ref('dim_customer') }}
    where is_inactive = 0 and deleted = 0
),

joined as (
    select
        c._company_name,
        c.customer_id,
        c.clean_customer_name as customer_name,
        l.service_location_id,
        l.address,
        l.city,
        l.state,
        l.zip,
        wot.work_order_type_id,
        wot.work_type,
        wot.recurs,
        wot.recur_months,
        wot.recur_type,
        wot.recur_value,
        wot.default_minutes,
        a.last_done_date,
        a.previous_last_done_date,
        coalesce(a.location_price, wot.default_price) as price,
        coalesce(a.location_labor_cost, wot.default_labor_cost) as labor_cost
    from customers c
    join locations l
      on c.customer_id = l.customer_id
     and c._company_name = l._company_name
    join assignments a
      on l.service_location_id = a.service_location_id
     and l._company_name = a._company_name
    join work_order_types wot
      on a.work_order_type_id = wot.work_order_type_id
     and a._company_name = wot._company_name
    where wot.recurs = 1  -- exclude one-time work order types
)

-- =========================================================================
-- TODO (Ross): Wrap `joined` in one more CTE that adds two derived columns.
--             This is the *only* business-logic step left.
--
-- 1. next_due_date  (DATE or NULL)
--    Default that handles the monthly case:
--      case when recur_months > 0 and last_done_date is not null
--           then (last_done_date::date + (recur_months || ' months')::interval)::date
--           else null
--      end
--    Open question: do RecurType / RecurValue ever encode non-month patterns
--    (weekly, yearly) that the formula needs to handle? If yes, expand the CASE.
--    If RecurType is always 'Months' in Skimmer's output, the default is fine.
--
-- 2. status  (TEXT)
--    Suggested buckets — adjust thresholds to match how the team thinks:
--      'OVERDUE'    — next_due_date < CURRENT_DATE
--      'DUE_SOON'   — next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 14
--      'OK'         — next_due_date > CURRENT_DATE + 14
--      'NEVER_DONE' — last_done_date IS NULL  (assigned but never executed)
--    Open question: is "due_soon" 14 days, 30 days, or split into more buckets?
--                   And does NEVER_DONE deserve its own status, or roll into OVERDUE?
--
-- Replace the placeholder select below with the final select once decided.
-- =========================================================================

select
    *,
    null::date as next_due_date,    -- TODO: replace
    'TODO'::text as status          -- TODO: replace
from joined
