with source as (
    {{ union_companies('InvoiceItem') }}
),

renamed as (
    select
        _company_name,
        cast("id" as text) as invoice_item_id,
        cast("InvoiceLocationId" as text) as invoice_location_id,
        cast("ProductId" as text) as product_id,
        "Item" as item,
        "Description" as description,
        cast("Quantity" as double precision) as quantity,
        cast("Rate" as double precision) as rate,
        cast("Amount" as double precision) as amount,
        cast("Subtotal" as double precision) as subtotal,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
