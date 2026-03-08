select
    rs.company_id,
    rs._company_name,
    rs.account_id,
    rs.service_date,
    substr(rs.service_date, 1, 7) as service_month,
    sl.customer_id as service_location_customer_id,
    sl.city,
    sl.state,
    sl.zip,
    sl.rate,
    sl.rate_type,
    sl.labor_cost,
    sl.labor_cost_type,
    sse.entry_type,
    sse.entry_value,
    ed.description as entry_description,
    ed.unit_of_measure,
    ed.reading_type,
    ed.dosage_type,
    ed.cost,
    ed.price,
    coalesce(sse.entry_value, 0) * coalesce(ed.cost, 0) as dosage_cost,
    coalesce(sse.entry_value, 0) * coalesce(ed.price, 0) as dosage_price
from {{ ref('stg_route_stop') }} rs
left join {{ ref('stg_service_location') }} sl
    on rs.service_location_id = sl.service_location_id
left join (
    select route_stop_id, max(service_stop_id) as keep_id
    from {{ ref('stg_service_stop') }}
    group by route_stop_id
) latest_ss on rs.route_stop_id = latest_ss.route_stop_id
left join {{ ref('stg_service_stop') }} ss
    on latest_ss.keep_id = ss.service_stop_id
    and rs.service_date = ss.service_date
left join {{ ref('stg_service_stop_entry') }} sse
    on ss.service_stop_id = sse.service_stop_id
    and rs.service_date = sse.service_date
    and sse.entry_type = 'Dosage'
left join {{ ref('stg_entry_description') }} ed
    on sse.entry_description_id = ed.entry_description_id
    and ed.entry_type = 'Dosage'
