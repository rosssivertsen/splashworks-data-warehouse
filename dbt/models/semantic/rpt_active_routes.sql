{{ config(materialized='table') }}

-- rpt_active_routes — denormalized active route assignment report.
--
-- One row per active RouteAssignment, enriched with tech, customer,
-- service location, pool, and observational service-state columns.
--
-- Canonical filter is vendor-authoritative per Glenn Burnside
-- (Skimmer VP Engineering), 2026-04-22 email:
--   ra.end_date > CURRENT_TIMESTAMP::text
--   AND c.deleted = 0
--   AND sl.deleted = 0
-- stg_route_assignment already filters ra.deleted = 0 at the view level.
--
-- Do NOT add a service-history filter to identify "active" routes.
-- Per Laura Gergle: that incorrectly excludes new customers who have
-- been added to routes but haven't had their first visit yet.
--
-- The service-state columns (last_serviced, days_since_service,
-- service_state) are OBSERVATIONAL, not judgmental — they report what
-- the data shows, without labeling any route as "stale" or a
-- "re-routing candidate." The common case of NEVER_SERVICED is new
-- customers pending first service, not abandoned routes.

with route_base as (
    select
        ra._company_name,
        ra.route_assignment_id,
        ra.service_location_id,
        ra.account_id,
        ra.day_of_week,
        ra.frequency,
        ra.sequence,
        ra.start_date,
        ra.end_date
    from {{ ref('stg_route_assignment') }} ra
    -- stg view already filters deleted = 0
    where ra.end_date > (current_timestamp at time zone 'UTC')::text
),

with_tech as (
    select
        rb.*,
        t.full_name        as technician,
        t.first_name       as tech_first_name,
        t.last_name        as tech_last_name,
        t.role_type        as tech_role,
        t.is_active        as tech_is_active
    from route_base rb
    join {{ ref('dim_tech') }} t
      on t.tech_id = rb.account_id
     and t._company_name = rb._company_name
),

with_location as (
    -- stg_service_location is used (not dim) because dim_service_location
    -- drops the `deleted` column and Glenn's vendor-canonical filter
    -- requires sl.deleted = 0. All other needed columns (address, city,
    -- state, zip, rate, rate_type, labor_cost, labor_cost_type) are
    -- present in stg and pass through unchanged to dim.
    select
        wt.*,
        sl.customer_id,
        sl.address,
        sl.city,
        sl.state,
        sl.zip,
        sl.rate,
        sl.rate_type,
        sl.labor_cost,
        sl.labor_cost_type
    from with_tech wt
    join {{ ref('stg_service_location') }} sl
      on sl.service_location_id = wt.service_location_id
     and sl._company_name = wt._company_name
    where sl.deleted = 0
),

with_customer as (
    select
        wl.*,
        c.clean_customer_name  as customer,
        c.billing_city         as customer_billing_city,
        c.billing_state        as customer_billing_state,
        c.is_inactive          as customer_is_inactive,
        c.created_at           as customer_created_at
    from with_location wl
    join {{ ref('dim_customer') }} c
      on c.customer_id = wl.customer_id
     and c._company_name = wl._company_name
    where c.deleted = 0
),

pool_agg as (
    select
        _company_name,
        service_location_id,
        sum(coalesce(gallons, 0)) as total_gallons,
        string_agg(distinct pool_name, ' + ' order by pool_name) as bodies_of_water,
        count(*) as body_count
    from {{ ref('dim_pool') }}
    group by _company_name, service_location_id
),

service_history as (
    select
        _company_name,
        service_location_id,
        max(service_date::date) as last_service_date,
        count(*)                as total_service_stops
    from {{ ref('fact_service_stop') }}
    group by _company_name, service_location_id
),

final as (
    select
        wc._company_name                                                                    as company,
        wc.technician,
        wc.day_of_week                                                                       as day,
        wc.sequence                                                                           as stop_order,
        wc.frequency,
        wc.customer,
        wc.address,
        wc.city,
        wc.state,
        wc.zip,
        pa.bodies_of_water,
        pa.total_gallons,
        pa.body_count,
        wc.rate,
        wc.rate_type,
        wc.labor_cost,
        wc.labor_cost_type,
        sh.last_service_date                                                                  as last_serviced,
        sh.total_service_stops,
        case
          when sh.last_service_date is null then null
          else (current_date - sh.last_service_date)
        end                                                                                   as days_since_service,
        case
          when sh.last_service_date is null                                                 then 'awaiting_first_service'
          when sh.last_service_date >= current_date - interval '30 days'                    then 'recent_30d'
          when sh.last_service_date >= current_date - interval '90 days'                    then 'last_30_to_90d'
          else 'last_90d_plus'
        end                                                                                   as service_state,
        wc.start_date                                                                          as route_started,
        wc.end_date                                                                            as route_ends,
        case
          when wc.end_date::date = date '2080-01-01' then true
          else false
        end                                                                                   as is_open_ended,
        wc.route_assignment_id,
        wc.customer_id,
        wc.service_location_id,
        wc.account_id                                                                          as tech_id,
        wc.customer_created_at                                                                 as customer_created,
        current_timestamp                                                                      as _built_at
    from with_customer wc
    left join pool_agg pa
      on pa._company_name = wc._company_name
     and pa.service_location_id = wc.service_location_id
    left join service_history sh
      on sh._company_name = wc._company_name
     and sh.service_location_id = wc.service_location_id
)

select *
from final
order by
    company,
    technician,
    case day
      when 'Monday' then 1 when 'Tuesday' then 2 when 'Wednesday' then 3
      when 'Thursday' then 4 when 'Friday' then 5 when 'Saturday' then 6
      when 'Sunday' then 7
    end,
    coalesce(stop_order, 999),
    customer
