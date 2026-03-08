select
    c.company_id,
    c._company_name,
    c.customer_id,
    c.clean_customer_name,
    i.invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.status as invoice_status,
    i.payment_status,
    sl.service_location_id,
    sl.address as service_location_address,
    sl.city as service_location_city,
    sl.state as service_location_state,
    sl.zip as service_location_zip,
    sl.rate as service_location_rate,
    ii.item as invoice_item,
    ii.description as invoice_item_description,
    ii.quantity,
    ii.rate as item_rate,
    ii.amount as line_total,
    ii.subtotal,
    pr.name as product_name,
    pr.qbo_item_id as product_qbo_item_id
from {{ ref('stg_customer') }} c
left join {{ ref('stg_invoice') }} i
    on c.customer_id = i.customer_id
    and i.status = 'Sent'
left join {{ ref('stg_invoice_location') }} il
    on i.invoice_id = il.invoice_id
left join {{ ref('stg_service_location') }} sl
    on c.customer_id = sl.customer_id
    and il.service_location_id = sl.service_location_id
left join {{ ref('stg_invoice_item') }} ii
    on il.invoice_location_id = ii.invoice_location_id
left join {{ ref('stg_product') }} pr
    on ii.product_id = pr.product_id
where c.is_inactive = 0
