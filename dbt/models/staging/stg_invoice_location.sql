with source as (
    {{ union_companies('InvoiceLocation') }}
),

renamed as (
    select
        _company_name,
        cast("id" as text) as invoice_location_id,
        cast("InvoiceId" as text) as invoice_id,
        cast("ServiceLocationId" as text) as service_location_id,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
