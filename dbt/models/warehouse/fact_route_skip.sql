{{ config(
    materialized='incremental',
    unique_key=['skip_id', 'skip_type', '_company_name']
) }}

-- Combines two skip sources:
-- 1. RouteStop.IsSkipped = 1 (day-of skips with reasons: gate locked, weather, etc.)
-- 2. RouteSkip (pre-planned schedule skips: vacations, seasonal closures)

-- Day-of skips (tech couldn't service)
select
    rs._company_name,
    rs.route_stop_id as skip_id,
    'day_of' as skip_type,
    rs.route_assignment_id,
    rs.service_location_id,
    rs.account_id as tech_account_id,
    rs.service_date,
    ssr.reason as skip_reason,
    sl.customer_id,
    c.clean_customer_name as customer_name,
    sl.address as service_address,
    t.full_name as tech_name
from {{ ref('stg_route_stop') }} rs
left join {{ ref('stg_skipped_stop_reason') }} ssr
    on rs.skipped_stop_reason_id = ssr.skipped_stop_reason_id
    and rs._company_name = ssr._company_name
left join {{ ref('stg_service_location') }} sl
    on rs.service_location_id = sl.service_location_id
    and rs._company_name = sl._company_name
left join {{ ref('stg_customer') }} c
    on sl.customer_id = c.customer_id
    and sl._company_name = c._company_name
left join {{ ref('stg_account') }} t
    on rs.account_id = t.account_id
    and rs._company_name = t._company_name
where rs.is_skipped = 1

union all

-- Pre-planned skips (schedule-level)
select
    rsk._company_name,
    rsk.route_skip_id as skip_id,
    'pre_planned' as skip_type,
    rsk.route_assignment_id,
    ra.service_location_id,
    ra.account_id as tech_account_id,
    rsk.service_date,
    'Pre-planned skip' as skip_reason,
    sl.customer_id,
    c.clean_customer_name as customer_name,
    sl.address as service_address,
    t.full_name as tech_name
from {{ ref('stg_route_skip') }} rsk
left join {{ ref('stg_route_assignment') }} ra
    on rsk.route_assignment_id = ra.route_assignment_id
    and rsk._company_name = ra._company_name
left join {{ ref('stg_service_location') }} sl
    on ra.service_location_id = sl.service_location_id
    and ra._company_name = sl._company_name
left join {{ ref('stg_customer') }} c
    on sl.customer_id = c.customer_id
    and sl._company_name = c._company_name
left join {{ ref('stg_account') }} t
    on ra.account_id = t.account_id
    and ra._company_name = t._company_name
