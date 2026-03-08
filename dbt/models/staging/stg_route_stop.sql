with source as (
    {{ union_companies('RouteStop') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as route_stop_id,
        cast("ServiceLocationId" as text) as service_location_id,
        cast("AccountId" as text) as account_id,
        "ServiceDate" as service_date,
        "StartTime" as start_time,
        "CompleteTime" as complete_time,
        cast("MinutesAtStop" as double precision) as minutes_at_stop,
        {{ service_status('"StartTime"', '"CompleteTime"') }} as service_status,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
