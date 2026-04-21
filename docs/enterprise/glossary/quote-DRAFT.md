# Quote

> **Status:** DRAFT — pending review before release

## Definition

A formal estimate or proposal sent to a customer before work is performed. Quotes typically precede work orders for non-routine repairs, equipment replacements, or special projects. Once approved by the customer, a quote can be converted into a work order and subsequently invoiced.

## System of Record

**Primary:** Skimmer
**Rationale:** Quotes are created and managed in Skimmer by admin users. Skimmer's native QBO sync can push quotes as Estimates to QBO, but Skimmer is the operational source of truth for the approval workflow.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| Quote | Skimmer | Database entity and UI term |
| Estimate | QuickBooks Online | QBO's equivalent entity — a non-binding price proposal |
| — | Zoho CRM | No direct equivalent (Zoho has Quotes but not connected to Skimmer) |
| — | Data Warehouse | Not yet modeled |

## Naming Convention

**Standard format:** Quotes are identified by a sequential number per company, similar to invoices.

**Rules:**
- Quote numbers are auto-incremented per company entity (AQPS and JOMO have independent sequences)
- Description should clearly state the scope of proposed work

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | Quote.id | UUID | `q1a2b3c4d5e6...` |
| QuickBooks Online | Estimate.Id | Numeric | `205` |
| Data Warehouse | — | — | Not yet modeled |

**Cross-system linkage:**
- `Invoice.QuoteId` links an invoice back to the originating quote (when a quote is converted to invoice)
- QBO Estimate maps to Skimmer Quote via the native sync

## Key Business Rules

- **Lifecycle:** Draft → Sent → Approved → Converted to Work Order/Invoice → Closed
- **Approval:** Customer approves the quote before work begins. Approval may be verbal, email, or via customer portal.
- **Conversion:** An approved quote can be converted directly into an invoice. The `Invoice.QuoteId` field tracks this lineage.
- **Pricing:** Quotes include line items with quantities, rates, and descriptions — same structure as invoice items
- **Expiration:** Quotes may have an expiration date after which the pricing is no longer valid

## Data Flow

```
Skimmer (Admin creates Quote for customer)
    │
    ├── Quote sent to customer (email or portal)
    │
    ├── Customer approves
    │   ├── Work Order created (for repairs/installs)
    │   └── Invoice generated (QuoteId links back)
    │
    ├── Skimmer native sync → QBO Advanced (as Estimate)
    │
    └── Nightly SQLite Extract
        └── Data Warehouse (not yet modeled)
```

## Field Mapping

| Canonical Field | Skimmer | QBO Advanced | Warehouse | Notes |
|----------------|---------|--------------|-----------|-------|
| Quote ID | id | Estimate.Id | — | UUID in Skimmer |
| Customer | CustomerId | CustomerRef | — | FK to Customer |
| Quote Number | — | DocNumber | — | Sequential per company |
| Total | Total | TotalAmt | — | Including tax |
| Status | Status | — | — | Draft, Sent, Approved, etc. |
| Expiration Date | — | ExpirationDate | — | QBO supports this natively |
| Quote → Invoice | — (reverse: Invoice.QuoteId) | — | — | Invoice references originating quote |
| Company | CompanyId | — | — | AQPS or JOMO |

## Related Entities

- [Customer](customer.md) — many:1 (each quote is for one customer)
- [Invoice](invoice.md) — 1:1 (an approved quote converts to an invoice, linked by QuoteId)
- [Work Order](work-order.md) — 1:1 (an approved quote can trigger a work order)
- [Product](product.md) — via quote line items (parts and equipment in the proposal)
- [Service Location](service-location.md) — many:1 (quote is for work at a specific location)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — Skimmer Quote + QBO Estimate mapping, conversion workflow | Claude / Ross Sivertsen |
