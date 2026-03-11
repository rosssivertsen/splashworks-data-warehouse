{{ config(materialized='table') }}

select
    fp._company_name,
    fp.payment_date,
    substr(fp.payment_date, 1, 7) as payment_month,

    -- human-readable names (no IDs)
    c.clean_customer_name as customer_name,
    c.billing_city,
    c.billing_state,

    -- payment details
    fp.amount,
    fp.payment_method,

    -- invoice context
    i.invoice_number,
    i.invoice_date,
    i.status as invoice_status,
    i.payment_status,
    i.total as invoice_total

from {{ ref('fact_payment') }} fp
left join {{ ref('dim_customer') }} c
    on fp.customer_id = c.customer_id
    and fp._company_name = c._company_name
left join {{ ref('stg_invoice') }} i
    on fp.invoice_id = i.invoice_id
    and fp._company_name = i._company_name
