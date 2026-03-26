---
entity: payment
type: glossary
system_of_record: qbo
systems: [skimmer, qbo, warehouse]
warehouse_tables: [fact_payment, rpt_payment_summary]
related: [customer, invoice]
---

# Payment

## Definition

A financial transaction recording money received from a customer against an invoice. Payments track the method, status, and processing details of each transaction, including online (Stripe) and offline (check, cash) collection methods.

## System of Record

**Primary:** Skimmer (collection), QuickBooks Online Advanced (financial reconciliation)
**Rationale:** Payments are initiated and processed through Skimmer's integrated payment system (powered by Stripe). Skimmer syncs completed payments to QBO, where they are reconciled against bank deposits. QBO is authoritative for financial audit.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| Payment | Skimmer | Database entity and UI term |
| Payment | QuickBooks Online | Same term — `Payment` entity in QBO API |
| fact_payment | Data Warehouse | Warehouse fact table |
| rpt_payment_summary | Data Warehouse | Denormalized report with customer names and monthly aggregation |

## Naming Convention

**Standard format:** Payments are identified by system-generated IDs, not user-facing names.

**Rules:**
- Skimmer assigns a UUID to each payment
- QBO assigns a numeric ID after sync
- Stripe assigns a `PaymentIntentId` for online transactions

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | Payment.id | UUID | `a1b2c3d4e5f6...` |
| QuickBooks Online | Payment.Id | Numeric | `9247` |
| Stripe | PaymentIntentId | String | `pi_3N7x8K2eZvKYlo2C...` |
| Data Warehouse | payment_id + _company_name | UUID + text | `a1b2c3d4...` + `AQPS` |

## Key Business Rules

- **Status values:** Succeeded, Failed, Pending
- **Only `Succeeded` payments apply to invoices.** Failed payments do not reduce AmountDue.
- **Payment origins:** Online (customer-initiated via portal), Manual (admin-entered), Autopay (recurring automatic charge)
- **Payment types:** Credit (card), Check, Cash, ACH, Other
- **Autopay:** `IsAutopay = true` indicates a recurring automatic payment. `IsCustomerInitiated` distinguishes customer portal payments from admin-entered payments.
- **Refunds:** Tracked separately as `AmountRefundedOnline` and `AmountRefundedOffline`. Net payment = Amount - AmountRefundedOnline - AmountRefundedOffline.
- **Failed payment retry:** `LastFailedDate` tracks the most recent failure for retry logic. `ErrorCode` and `DeclineCode` provide failure details.
- **Processing fees:** `ApplicationFee` records Stripe's processing fee per transaction.
- **Void:** `VoidReason` required if payment is voided.

## Data Flow

```
Customer
    │
    ├── Online payment (Stripe via Skimmer portal)
    │   └── PaymentIntent created → charge processed → Payment record in Skimmer
    │
    ├── Autopay (Stripe recurring charge)
    │   └── Scheduled charge → Payment record in Skimmer
    │
    └── Manual entry (admin records check/cash)
        └── Payment record in Skimmer

Skimmer (Payment)
    │
    ├── Skimmer native sync → QBO Advanced (Payment entity)
    │   └── Applied against QBO Invoice, reconciled with bank deposit
    │
    └── Nightly SQLite Extract
        └── Data Warehouse
            ├── public_staging.stg_payment (raw)
            ├── public_warehouse.fact_payment (cleaned, typed)
            └── public_semantic.rpt_payment_summary (denormalized)
```

## Field Mapping

| Canonical Field | Skimmer | QBO Advanced | Warehouse | Notes |
|----------------|---------|--------------|-----------|-------|
| Payment ID | id | Id | payment_id | UUID in Skimmer |
| Customer | CustomerId | CustomerRef | customer_id | FK to Customer |
| Invoice | InvoiceId | Line[].LinkedTxn | invoice_id | FK to Invoice |
| Date | PaymentDate | TxnDate | payment_date | TEXT in warehouse |
| Amount | Amount | TotalAmt | amount | |
| Payment Type | PaymentType | PaymentMethodRef | payment_type | Credit, Check, Cash |
| Payment Method | PaymentMethod | — | payment_method | Last 4 digits, etc. |
| Status | Status | — | status | Succeeded, Failed, Pending |
| Origin | PaymentOrigin | — | payment_origin | Online, Manual |
| Autopay | IsAutopay | — | is_autopay | Boolean |
| Stripe Intent | PaymentIntentId | — | — | For online payments |
| Processing Fee | ApplicationFee | — | — | Stripe fee |
| Refunded Online | AmountRefundedOnline | — | — | |
| Refunded Offline | AmountRefundedOffline | — | — | |
| Company | CompanyId | — | _company_name | AQPS or JOMO |

## Training Resources

- [Payments Settings Group Training](https://us-17324.app.gong.io/e/c-share/?tkn=v6xv6wrcppcnp3aku5mfukf)
- [Payments Workflows Group Training](https://us-17324.app.gong.io/e/c-share/?tkn=gq9ltwtpeimg193x8iw1hq91f)
- [Transition to AutoPay Email Template](https://docs.google.com/document/d/1CV_vnvHAU1eBp7aFJHn5CYYMQY5WrSuP4Mj5VZWgrcs/copy)
- [We Are Going Cashless Email Template](https://21254957.fs1.hubspotusercontent-na1.net/hubfs/21254957/Broadcast%2520Email%2520Templates/Going%2520Cashless%2520Email%2520Template%2520-%2520Skimmer%2520PDF.pdf)

## Related Entities

- [Customer](customer.md) — many:1 (each payment comes from one customer)
- [Invoice](invoice.md) — many:1 (each payment applies to one invoice)
- [Work Order](work-order.md) — indirect via Invoice (work order → invoice → payment)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-18 | Initial definition — Skimmer + QBO + Stripe mapping, training links | Ross Sivertsen |
