with source as (
    {{ union_companies('Invoice') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as invoice_id,
        cast("CustomerId" as text) as customer_id,
        "InvoiceNumber" as invoice_number,
        "InvoiceDate" as invoice_date,
        "DueDate" as due_date,
        "Status" as status,
        "PaymentStatus" as payment_status,
        cast("Total" as double precision) as total,
        cast("SubTotal" as double precision) as sub_total,
        cast("TaxAmount" as double precision) as tax_amount,
        cast("PaidAmount" as double precision) as paid_amount,
        cast("AmountDue" as double precision) as amount_due,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
