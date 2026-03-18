{{ config(
    materialized='incremental',
    unique_key=['route_move_id', '_company_name']
) }}

select
    rm._company_name,
    rm.route_move_id,
    rm.route_assignment_id,
    rm.service_location_id,
    rm.original_account_id,
    rm.original_service_date,
    rm.move_to_account_id,
    rm.move_to_service_date,
    rm.created_date,
    -- Was this a tech reassignment, date change, or both?
    case
        when rm.original_account_id != rm.move_to_account_id
         and rm.original_service_date != rm.move_to_service_date then 'tech_and_date'
        when rm.original_account_id != rm.move_to_account_id then 'tech_change'
        when rm.original_service_date != rm.move_to_service_date then 'date_change'
        else 'other'
    end as move_type,
    sl.customer_id,
    c.clean_customer_name as customer_name,
    sl.address as service_address,
    orig_tech.full_name as original_tech_name,
    new_tech.full_name as new_tech_name
from {{ ref('stg_route_move') }} rm
left join {{ ref('stg_service_location') }} sl
    on rm.service_location_id = sl.service_location_id
    and rm._company_name = sl._company_name
left join {{ ref('stg_customer') }} c
    on sl.customer_id = c.customer_id
    and sl._company_name = c._company_name
left join {{ ref('stg_account') }} orig_tech
    on rm.original_account_id = orig_tech.account_id
    and rm._company_name = orig_tech._company_name
left join {{ ref('stg_account') }} new_tech
    on rm.move_to_account_id = new_tech.account_id
    and rm._company_name = new_tech._company_name
