select
    ss.company_id,
    ss._company_name,
    ss.pool_id,
    rs.route_stop_id,
    rs.service_location_id,
    rs.account_id as tech_id,
    rs.service_date,
    pl.pool_name,
    pl.gallons as pool_gallons,
    pl.baseline_filter_pressure,
    sse.entry_type,
    sse.entry_value,
    ed.unit_of_measure,
    ed.reading_type,
    ed.dosage_type,
    ed.cost,
    ed.price,
    ed.can_include_with_service
from {{ ref('stg_service_stop') }} ss
left join {{ ref('stg_route_stop') }} rs
    on ss.route_stop_id = rs.route_stop_id
left join {{ ref('stg_pool') }} pl
    on ss.pool_id = pl.pool_id
    and rs.service_location_id = pl.service_location_id
left join {{ ref('stg_service_stop_entry') }} sse
    on ss.service_stop_id = sse.service_stop_id
    and ss.pool_id = sse.pool_id
    and rs.service_date = sse.service_date
    and sse.entry_type = 'Dosage'
left join {{ ref('stg_entry_description') }} ed
    on sse.entry_description_id = ed.entry_description_id
