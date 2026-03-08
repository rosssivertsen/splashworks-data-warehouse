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
