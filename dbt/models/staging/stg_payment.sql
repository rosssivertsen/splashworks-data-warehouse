with source as (
    {{ union_companies('Payment') }}
),

renamed as (
    select
        _company_name,
        cast("CompanyId" as text) as company_id,
        cast("id" as text) as payment_id,
        cast("InvoiceId" as text) as invoice_id,
        cast("CustomerId" as text) as customer_id,
        cast("Amount" as double precision) as amount,
        "PaymentDate" as payment_date,
        "PaymentMethod" as payment_method,
        -- Fields added for BI reconciliation (bi_compat.payment_main); exist in raw Payment.
        "PaymentOrigin" as payment_origin,
        "PaymentType" as payment_type,
        "Status" as status,
        "StatusMessage" as status_message,
        "Reference" as payment_reference,
        "PaymentIntentStatus" as payment_intent_status,
        cast("ApplicationFee" as double precision) as application_fee,
        cast("AmountRefundedOnline" as double precision) as amount_refunded_online,
        cast("AmountRefundedOffline" as double precision) as amount_refunded_offline,
        "ErrorCode" as error_code,
        "DeclineCode" as decline_code,
        cast("IsCustomerInitiated" as integer) as is_customer_initiated,
        cast("IsAutopay" as integer) as is_autopay,
        "PayoutId" as payout_id,
        cast("PaymentMethodId" as text) as payment_method_id,
        "SourcePaymentMethod" as source_payment_method,
        cast("Deleted" as integer) as deleted
    from source
)

select * from renamed
where deleted = 0
