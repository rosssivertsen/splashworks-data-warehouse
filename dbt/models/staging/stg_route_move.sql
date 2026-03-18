with source as (
    {{ union_companies('RouteMove') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as route_move_id,
        cast("RouteAssignmentId" as text) as route_assignment_id,
        cast("ServiceLocationId" as text) as service_location_id,
        cast("OriginalAccountId" as text) as original_account_id,
        "OriginalServiceDate" as original_service_date,
        cast("MoveToAccountId" as text) as move_to_account_id,
        "MoveToServiceDate" as move_to_service_date,
        "CreatedDate" as created_date,
        cast("Sequence" as integer) as sequence,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
