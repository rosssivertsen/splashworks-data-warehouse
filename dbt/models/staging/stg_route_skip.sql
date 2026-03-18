with source as (
    {{ union_companies('RouteSkip') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as route_skip_id,
        cast("RouteAssignmentId" as text) as route_assignment_id,
        "ServiceDate" as service_date,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
