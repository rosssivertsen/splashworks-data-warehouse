with source as (
    {{ union_companies('WorkOrder') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as work_order_id,
        cast("WorkOrderTypeId" as text) as work_order_type_id,
        cast("ServiceLocationId" as text) as service_location_id,
        cast("AccountId" as text) as account_id,
        "ServiceDate" as service_date,
        "StartTime" as start_time,
        "CompleteTime" as complete_time,
        {{ service_status('"StartTime"', '"CompleteTime"') }} as service_status,
        "WorkNeeded" as work_needed,
        "WorkPerformed" as work_performed,
        "Notes" as notes,
        cast("LaborCost" as double precision) as labor_cost,
        cast("Price" as double precision) as price,
        cast("EstimatedMinutes" as double precision) as estimated_minutes,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
