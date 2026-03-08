with source as (
    {{ union_companies('Product') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as product_id,
        "Name" as name,
        cast("QboItemId" as text) as qbo_item_id,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
