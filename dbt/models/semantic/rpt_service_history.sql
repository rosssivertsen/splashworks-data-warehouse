{{ config(materialized='table') }}

select
    fss._company_name,
    fss.service_date,
    fss.service_month,

    -- human-readable names (no IDs)
    c.clean_customer_name as customer_name,
    dt.full_name as technician_name,
    p.pool_name,
    p.gallons as pool_gallons,

    -- service address
    sl.address as service_address,
    sl.city as service_city,
    sl.state as service_state,
    sl.zip as service_zip,

    -- visit details
    fss.service_status,
    fss.start_time,
    fss.complete_time,
    fss.minutes_at_stop,
    fss.notes,
    fss.notes_to_customer

from {{ ref('fact_service_stop') }} fss
left join {{ ref('dim_customer') }} c
    on fss.customer_id = c.customer_id
    and fss._company_name = c._company_name
left join {{ ref('dim_tech') }} dt
    on fss.tech_id = dt.tech_id
    and fss._company_name = dt._company_name
left join {{ ref('dim_pool') }} p
    on fss.pool_id = p.pool_id
    and fss._company_name = p._company_name
left join {{ ref('dim_service_location') }} sl
    on fss.service_location_id = sl.service_location_id
    and fss._company_name = sl._company_name
