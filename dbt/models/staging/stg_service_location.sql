with source as (
    {{ union_companies('ServiceLocation') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as service_location_id,
        cast("CustomerId" as text) as customer_id,
        "Address" as address,
        "City" as city,
        "State" as state,
        "Zip" as zip,
        "Notes" as notes,
        cast("Rate" as double precision) as rate,
        "RateType" as rate_type,
        cast("LaborCost" as double precision) as labor_cost,
        "LaborCostType" as labor_cost_type,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
