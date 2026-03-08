select
    p.company_id,
    p._company_name,
    p.pool_id,
    p.service_location_id,
    sl.customer_id,
    p.pool_name,
    p.gallons,
    p.baseline_filter_pressure,
    p.notes
from {{ ref('stg_pool') }} p
left join {{ ref('stg_service_location') }} sl
    on p.service_location_id = sl.service_location_id
