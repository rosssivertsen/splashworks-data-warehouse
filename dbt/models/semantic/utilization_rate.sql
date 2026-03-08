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
