with source as (
    {{ union_companies('Payment') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as payment_id,
        cast("InvoiceId" as text) as invoice_id,
        cast("Amount" as double precision) as amount,
        "PaymentDate" as payment_date,
        "PaymentMethod" as payment_method,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
