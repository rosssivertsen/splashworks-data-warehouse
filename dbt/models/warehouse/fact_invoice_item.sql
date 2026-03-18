select
    ii._company_name,
    ii.invoice_item_id,
    il.invoice_id,
    il.service_location_id,
    i.customer_id,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.status as invoice_status,
    i.payment_status,
    ii.product_id,
    pr.name as product_name,
    ii.item as item_name,
    ii.description as item_description,
    ii.quantity,
    ii.rate as unit_rate,
    ii.amount as line_total,
    ii.subtotal
from {{ ref('stg_invoice_item') }} ii
left join {{ ref('stg_invoice_location') }} il
    on ii.invoice_location_id = il.invoice_location_id
    and ii._company_name = il._company_name
left join {{ ref('stg_invoice') }} i
    on il.invoice_id = i.invoice_id
    and il._company_name = i._company_name
left join {{ ref('stg_product') }} pr
    on ii.product_id = pr.product_id
    and ii._company_name = pr._company_name
