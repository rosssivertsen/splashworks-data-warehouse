{{ config(
    materialized='incremental',
    unique_key=['service_stop_entry_id', '_company_name']
) }}

select
    ss.company_id,
    ss._company_name,
    sse.service_stop_entry_id,
    ss.service_stop_id,
    rs.route_stop_id,
    rs.service_date,
    substr(rs.service_date, 1, 7) as service_month,
    rs.account_id as tech_id,
    sl.service_location_id,
    sl.customer_id,
    sse.entry_type,
    sse.entry_value,
    ed.description as entry_description,
    ed.unit_of_measure,
    ed.reading_type,
    ed.dosage_type,
    ed.cost as unit_cost,
    ed.price as unit_price,
    ed.can_include_with_service,
    coalesce(sse.entry_value, 0) * coalesce(ed.cost, 0) as dosage_cost,
    coalesce(sse.entry_value, 0) * coalesce(ed.price, 0) as dosage_price
from {{ ref('stg_service_stop') }} ss
left join {{ ref('stg_route_stop') }} rs
    on ss.route_stop_id = rs.route_stop_id
    and ss._company_name = rs._company_name
left join {{ ref('stg_service_location') }} sl
    on rs.service_location_id = sl.service_location_id
    and rs._company_name = sl._company_name
left join {{ ref('stg_service_stop_entry') }} sse
    on ss.service_stop_id = sse.service_stop_id
    and ss._company_name = sse._company_name
    and ss.pool_id = sse.pool_id
    and ss.service_date = sse.service_date
    and sse.entry_type = 'Dosage'
left join {{ ref('stg_entry_description') }} ed
    on sse.entry_description_id = ed.entry_description_id
    and sse._company_name = ed._company_name
