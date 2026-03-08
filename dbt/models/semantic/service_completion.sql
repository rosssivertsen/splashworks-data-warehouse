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
