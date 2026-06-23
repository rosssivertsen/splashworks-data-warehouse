-- bi_compat.payment_main
-- Warehouse-sourced replacement for Cleo's Power BI `jomo_main` + `aqps_main`
-- (Payment Payout Dashboard). Reproduces the exact output columns the PBI model
-- expects, so the report repoint is a near-pure DSN swap.
-- Source: warehouse staging (already unions AQPS+JOMO; applies deleted=0/dedup).
-- Decoded original SQLite query: ../../../Skimmer Nightly/RECONCILIATION/payment-report-decoded.md
-- SQLite->Postgres: strftime->to_char, date('now')->current_date,
--   julianday diffs->date subtraction, "literal"->'literal'.

select
    p.company_id                                   as "CompanyID",
    p.payment_id                                   as "PaymentID",
    p.invoice_id                                   as "InvoiceID",
    p.customer_id                                  as "CustomerID",
    to_char(p.payment_date::timestamp, 'MM/DD/YYYY') as "PaymentDate",
    to_char(p.payment_date::timestamp, 'YYYY')     as "PaymentDateYear",
    to_char(p.payment_date::timestamp, 'MM')       as "PaymentDateMonth",
    p.payment_origin                               as "PaymentOrigin",
    p.payment_type                                 as "PaymentType",
    p.payment_method                               as "PaymentMethod",
    p.status                                       as "PaymentStatus",
    p.status_message                               as "PaymentStatusMessage",
    p.payment_reference                            as "PaymentReferenceID",
    p.amount                                       as "PaymentAmount",
    p.payment_intent_status                        as "PaymentIntentStatus",
    p.application_fee                              as "PaymentApplicationFee",
    p.amount_refunded_online                       as "PaymentAmountRefundedOnline",
    p.amount_refunded_offline                      as "PaymentRefundedOffline",
    p.error_code                                   as "PaymentErrorCode",
    p.decline_code                                 as "PaymentDeclineCode",
    p.is_customer_initiated                        as "PaymentIsCustomerInitiated",
    p.is_autopay                                   as "PaymentIsAutoPay",
    p.payout_id                                    as "PayOutUD",
    p.payment_method_id                            as "PaymentMethodID",
    p.source_payment_method                        as "SourcePaymentMethod",

    -- customer (clean_customer_name already encodes the displayascompany logic)
    b.clean_customer_name                          as "CustomerFullName",
    b.billing_address                              as "BillingAddress",
    b.billing_city                                 as "BillingCity",
    b.billing_state                                as "BillingState",
    b.billing_zip                                  as "BillingZip",
    b.billing_address || ' ' || b.billing_city || ' ' || b.billing_state || ' ' || b.billing_zip
                                                   as "CompleteBillingAddress",
    b.qbo_customer_id                              as "QBOCustomerId",
    b.is_inactive                                  as "CustomerIsInActive",

    -- invoice
    c.invoice_number                               as "InvoiceNumber",
    to_char(c.invoice_date::timestamp, 'MM/DD/YYYY') as "InvoiceDate",
    to_char(c.invoice_date::timestamp, 'YYYY')     as "InvoiceDateYear",
    to_char(c.invoice_date::timestamp, 'MM')       as "InvoiceDateMonth",
    to_char(c.due_date::timestamp, 'MM/DD/YYYY')   as "InvoiceDueDate",
    to_char(c.due_date::timestamp, 'YYYY')         as "InvoiceDueDateYear",
    to_char(c.due_date::timestamp, 'MM')           as "InvoiceDueDateMonth",
    c.status                                       as "InvoiceStatus",
    c.payment_status                               as "InvoicePaymentStatus",
    c.quote_id                                     as "InvoiceQuoteId",

    case
        when current_date <= c.due_date::date then 'Not Past Due'
        when current_date >  c.due_date::date then 'Past Due'
    end                                            as "PastDueStatus",
    case
        when current_date > c.due_date::date then (current_date - c.due_date::date)
        else 0
    end                                            as "DaysPastDue",
    (current_date - c.invoice_date::date)          as "DaysOutStanding",
    case
        when (current_date - c.due_date::date) <= 30  then '0-30 Days'
        when (current_date - c.due_date::date) <= 60  then '31-60 Days'
        when (current_date - c.due_date::date) <= 90  then '61-90 Days'
        when (current_date - c.due_date::date) <= 120 then '91-120 Days'
        else '120+ Days'
    end                                            as "AgingBucket",
    (p.payment_date::date - c.invoice_date::date)  as "DaysToPay"

from {{ ref('stg_payment') }} p
left join {{ ref('stg_customer') }} b
    on p.customer_id = b.customer_id
    and p._company_name = b._company_name
    and b.deleted = 0
left join {{ ref('stg_invoice') }} c
    on p.invoice_id = c.invoice_id
    and p._company_name = c._company_name
