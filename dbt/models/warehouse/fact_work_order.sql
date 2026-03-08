select
    wo.company_id,
    wo._company_name,
    wo.work_order_id,
    wo.work_order_type_id,
    wo.service_location_id,
    wo.account_id as tech_id,
    wo.service_date,
    substr(wo.service_date, 1, 7) as service_month,
    wo.start_time,
    wo.complete_time,
    wo.service_status,
    wo.labor_cost,
    wo.price,
    sl.customer_id
from {{ ref('stg_work_order') }} wo
left join {{ ref('stg_service_location') }} sl
    on wo.service_location_id = sl.service_location_id
