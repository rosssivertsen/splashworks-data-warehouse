with source as (
    {{ union_companies('CustomerTag') }}
),

renamed as (
    select
        _company_name,
        cast("id" as text) as customer_tag_id,
        cast("CustomerId" as text) as customer_id,
        cast("TagId" as text) as tag_id,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
