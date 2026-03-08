with source as (
    {{ union_companies('RouteAssignment') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as route_assignment_id,
        cast("ServiceLocationId" as text) as service_location_id,
        cast("AccountId" as text) as account_id,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
