with source as (
    {{ union_companies('LocationWorkOrderType') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as location_work_order_type_id,
        cast("ServiceLocationId" as text) as service_location_id,
        cast("WorkOrderTypeId" as text) as work_order_type_id,
        "LastDoneDate" as last_done_date,
        "PreviousLastDoneDate" as previous_last_done_date,
        cast("LaborCost" as double precision) as labor_cost,
        cast("Price" as double precision) as price
    from source
)

select * from renamed
