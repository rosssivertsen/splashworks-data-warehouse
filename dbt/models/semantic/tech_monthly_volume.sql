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
