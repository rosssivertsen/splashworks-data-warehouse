# Invoice

## Definition

A billing document sent to a customer for services rendered. Invoices aggregate charges from recurring service stops, work orders, and installed parts into a single document with line items. They are the primary financial record linking operational work to revenue collection.

## System of Record

**Primary:** Skimmer (operational), QuickBooks Online Advanced (financial)
**Rationale:** Invoices originate in Skimmer from completed service work. Skimmer's native sync pushes invoices to QBO, where they become the financial system of record for accounting, tax, and collections. Both systems maintain the invoice, but QBO is authoritative for financial reporting.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| Invoice | Skimmer | Database entity and UI term |
| Invoice | QuickBooks Online | Same term — direct mapping |
| fact_invoice | Data Warehouse | Warehouse fact table |
| rpt_payment_summary | Data Warehouse | Denormalized report including invoice details |

## Naming Convention

**Standard format:** Invoices are identified by `InvoiceNumber` — a sequential integer per company.

**Rules:**
- Invoice numbers are auto-incremented per company entity (AQPS and JOMO have independent sequences)
- Invoice numbers must be unique within a company
- QBO assigns its own `DocNumber` which should match Skimmer's `InvoiceNumber` after sync

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | Invoice.id | UUID | `f1a2b3c4d5e6...` |
| QuickBooks Online | Invoice.Id | Numeric | `1842` |
| Data Warehouse | invoice_id + _company_name | UUID + text | `f1a2b3c4...` + `AQPS` |

**Cross-system linkage:**
- Skimmer stores invoice ID internally; QBO sync creates a matching QBO Invoice
- Invoice has a `QuoteId` field linking to the originating Quote (if converted from a quote)
- Warehouse joins on `invoice_id` + `_company_name` (composite key)

## Key Business Rules

- **Status lifecycle:** Draft → Sent → Paid → Void
- **Payment status:** Unpaid → Partial → Paid
- **AmountDue = Total - PaidAmount** — tracks outstanding balance
- **Voiding:** `VoidReason` is required when Status = Void. Voided invoices are excluded from revenue reporting.
- **Autopay:** `CanAutopay` flag indicates whether the invoice is eligible for automatic payment. `AutopayMethodExists` confirms a payment method is on file.
- **Fees and discounts:** Invoices support both flat-amount and percentage-based fees and discounts at the invoice level
- **Tax:** `TaxAmount` calculated from `TaxGroup` and `TaxRate` configuration per jurisdiction
- **Line items:** Each `InvoiceItem` links to its source — `RouteStopId` (service), `WorkOrderId` (repair), `InstalledItemId` (part), or `ProductId` (product sale)
- **Invoice locations:** `InvoiceLocation` joins invoices to service locations, enabling per-location billing on a single invoice
- **Prorated invoices:** The Invoice Generator supports prorated billing for mid-cycle starts

## Data Flow

```
Skimmer (completed service stops + work orders)
    │
    ├── Admin generates invoices (manual or batch)
    │   └── InvoiceItem records created per line item
    │
    ├── Skimmer native sync → QBO Advanced
    │   └── QBO Invoice created with matching line items
    │
    └── Nightly SQLite Extract
        └── Data Warehouse
            ├── public_staging.stg_invoice (raw)
            ├── public_warehouse.fact_invoice (cleaned, typed)
            └── public_semantic.rpt_payment_summary (denormalized with customer names)
```

## Field Mapping

| Canonical Field | Skimmer | QBO Advanced | Warehouse | Notes |
|----------------|---------|--------------|-----------|-------|
| Invoice ID | id | Id | invoice_id | UUID in Skimmer, numeric in QBO |
| Invoice Number | InvoiceNumber | DocNumber | invoice_number | Sequential per company |
| Customer | CustomerId | CustomerRef | customer_id | FK to Customer |
| Invoice Date | InvoiceDate | TxnDate | invoice_date | TEXT in warehouse |
| Due Date | DueDate | DueDate | due_date | |
| Total | Total | TotalAmt | total | Including tax |
| Subtotal | Subtotal | — | subtotal | Pre-tax |
| Tax Amount | TaxAmount | TxnTaxDetail.TotalTax | tax_amount | |
| Amount Due | AmountDue | Balance | amount_due | Outstanding balance |
| Status | Status | — | status | Draft, Sent, Paid, Void |
| Payment Status | PaymentStatus | — | payment_status | Unpaid, Partial, Paid |
| Paid Amount | PaidAmount | — | paid_amount | |
| Autopay Eligible | CanAutopay | — | — | Boolean |
| Quote Link | QuoteId | — | — | If converted from quote |
| Company | CompanyId | — | _company_name | AQPS or JOMO |

## Training Resources

- [Work Orders to Billing End-to-End Overview](https://www.loom.com/share/2adc33703f8142ca85181e50373e1b7d)
- [How to Generate Prorated Invoices](https://www.loom.com/share/21e1fef1e510447db74ebc2071453e08)
- [Quick Tip: Service Rate Check Before Invoicing](https://www.loom.com/share/df64b82c8063484cba6693d6f3db1679)
- [QBO Sync Training](https://us-17324.app.gong.io/e/c-share/?tkn=k6wlldp8d1ck1ulj7y4i7d59n)
- [Transition from Billing in Arrears to Prepaid](https://docs.google.com/document/d/1PSWmvoVf3CwzRu1klcIFTMyutufFiEqF7jp-I6V7t0c/edit?tab=t.0)

## Related Entities

- [Customer](customer.md) — many:1 (each invoice belongs to one customer)
- [Service Location](service-location.md) — many:many via InvoiceLocation (an invoice can cover multiple locations)
- [Work Order](work-order.md) — via InvoiceItem (work order charges appear as line items)
- [Payment](payment.md) — 1:many (an invoice can have multiple payments, e.g., partial payments)
- [Product](product.md) — via InvoiceItem (product sales appear as line items)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-18 | Initial definition — Skimmer + QBO cross-system mapping, training links | Ross Sivertsen |
