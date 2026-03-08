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
