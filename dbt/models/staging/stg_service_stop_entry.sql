with source as (
    {{ union_companies('ServiceStopEntry') }}
),

renamed as (
    select
        _company_name,
        cast("id" as text) as service_stop_entry_id,
        cast("ServiceStopId" as text) as service_stop_id,
        cast("PoolId" as text) as pool_id,
        cast("WorkOrderId" as text) as work_order_id,
        cast("EntryDescriptionId" as text) as entry_description_id,
        "ServiceDate" as service_date,
        "EntryType" as entry_type,
        cast("Value" as double precision) as entry_value,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
