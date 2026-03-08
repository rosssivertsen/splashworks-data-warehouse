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
