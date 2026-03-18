{{ config(
    materialized='incremental',
    unique_key=['payment_id', '_company_name']
) }}

select
    p._company_name,
    p.company_id,
    p.payment_id,
    p.invoice_id,
    i.customer_id,
    p.amount,
    p.payment_date,
    p.payment_method
from {{ ref('stg_payment') }} p
left join {{ ref('stg_invoice') }} i
    on p.invoice_id = i.invoice_id
    and p._company_name = i._company_name
