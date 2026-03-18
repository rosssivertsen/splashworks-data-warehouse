{{ config(
    materialized='incremental',
    unique_key=['service_stop_entry_id', '_company_name']
) }}

select
    wo.company_id,
    wo._company_name,
    sse.service_stop_entry_id,
    wo.work_order_id,
    wo.work_order_type_id,
    wo.service_location_id,
    wo.account_id as tech_id,
    wo.service_date,
    substr(wo.service_date, 1, 7) as service_month,
    wo.start_time,
    wo.complete_time,
    wo.service_status,
    sl.customer_id,
    sse.entry_type,
    sse.entry_value,
    ed.description as entry_description,
    ed.unit_of_measure,
    ed.dosage_type,
    ed.cost as unit_cost,
    ed.price as unit_price,
    coalesce(sse.entry_value, 0) * coalesce(ed.cost, 0) as dosage_cost,
    coalesce(sse.entry_value, 0) * coalesce(ed.price, 0) as dosage_price
from {{ ref('stg_work_order') }} wo
left join {{ ref('stg_service_location') }} sl
    on wo.service_location_id = sl.service_location_id
    and wo._company_name = sl._company_name
left join {{ ref('stg_service_stop_entry') }} sse
    on wo.work_order_id = sse.work_order_id
    and wo._company_name = sse._company_name
    and wo.service_date = sse.service_date
    and sse.entry_type = 'Dosage'
left join {{ ref('stg_entry_description') }} ed
    on sse.entry_description_id = ed.entry_description_id
    and sse._company_name = ed._company_name
