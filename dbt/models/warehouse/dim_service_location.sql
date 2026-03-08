select
    sl.company_id,
    sl._company_name,
    sl.service_location_id,
    sl.customer_id,
    sl.city,
    sl.state,
    sl.zip,
    sl.rate,
    sl.rate_type,
    sl.labor_cost,
    sl.labor_cost_type
from {{ ref('stg_service_location') }} sl
