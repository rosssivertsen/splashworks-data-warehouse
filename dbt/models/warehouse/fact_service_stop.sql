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
