with source as (
    {{ union_companies('ServiceStop') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as service_stop_id,
        cast("RouteStopId" as text) as route_stop_id,
        cast("PoolId" as text) as pool_id,
        "ServiceDate" as service_date,
        "Notes" as notes,
        "NotesToCustomer" as notes_to_customer,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
