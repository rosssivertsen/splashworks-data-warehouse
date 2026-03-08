select
    i.company_id,
    i._company_name,
    i.customer_id,
    cast(substr(i.invoice_date, 6, 2) as integer) as invoice_month_num,
    cast(substr(i.invoice_date, 1, 4) as integer) as invoice_year,
    sum(i.total) as invoice_total,
    i.status as invoice_status,
    i.payment_status,
    sum(i.paid_amount) as invoice_paid_amount,
    c.clean_customer_name
from {{ ref('stg_invoice') }} i
left join {{ ref('stg_customer') }} c
    on i.customer_id = c.customer_id
where i.status = 'Sent'
group by
    i.company_id,
    i._company_name,
    i.customer_id,
    i.invoice_number,
    i.invoice_date,
    i.status,
    i.payment_status,
    c.clean_customer_name
