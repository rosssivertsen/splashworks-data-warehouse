with source as (
    {{ union_companies('Pool') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as pool_id,
        cast("ServiceLocationId" as text) as service_location_id,
        "Name" as pool_name,
        cast("Gallons" as double precision) as gallons,
        cast("BaselineFilterPressure" as double precision) as baseline_filter_pressure,
        "Notes" as notes,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
