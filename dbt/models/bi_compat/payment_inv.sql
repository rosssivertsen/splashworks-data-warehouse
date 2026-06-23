-- bi_compat.payment_inv
-- Warehouse-sourced replacement for Cleo's `jomo_inv` + `aqps_inv` (Payment Payout).
-- Original: per-invoice latest balance for invoices referenced by payments
-- (ROW_NUMBER dedup over payment->invoice). stg_invoice is already invoice-grain,
-- so the dedup collapses to "distinct invoices that appear in payments".
-- Decoded original: ../../../Skimmer Nightly/RECONCILIATION/payment-report-decoded.md

select distinct
    c.invoice_id        as "InvoiceID",
    c.amount_due        as "InvoiceAmountDue",
    c.paid_amount       as "InvoicePaidAmount",
    c.status            as "InvoiceStatus",
    c.payment_status    as "InvoicePaymentStatus"
from {{ ref('stg_invoice') }} c
where c.status is not null
  and c.invoice_id in (select invoice_id from {{ ref('stg_payment') }})
