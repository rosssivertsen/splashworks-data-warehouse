---
entity: work-order
type: glossary
system_of_record: skimmer
systems: [skimmer, warehouse]
warehouse_tables: [fact_work_order, fact_work_order_dosage]
related: [service-location, invoice, product]
---

# Work Order

## Definition

A request for repair, maintenance, or one-time service at a customer's service location. Work orders track the full lifecycle from problem identification through completion, billing, and customer communication. They are distinct from recurring service stops — a work order is a discrete unit of non-routine work.

## System of Record

**Primary:** Skimmer
**Rationale:** Work orders are created, assigned, scheduled, and completed entirely within Skimmer. Technicians execute work orders via the Skimmer mobile app. Billing flows from completed work orders into Skimmer invoices, which then sync to QBO.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| WorkOrder | Skimmer | Database entity name |
| Work Order | Skimmer UI | User-facing term; sometimes abbreviated "WO" |
| Estimate | QuickBooks Online | QBO's "Estimate" entity maps loosely to work order quotes |
| — | Zoho CRM | No equivalent — CRM tracks leads, not service work |
| — | Data Warehouse | Not yet modeled (backlog item) |

## Naming Convention

**Standard format:** Work orders are identified by type + location, not by a user-facing name.

**Rules:**
- Work order types are configured per company in Skimmer (e.g., "Filter Clean", "Equipment Repair", "Green Pool", "Leak Detection")
- `WorkNeeded` field describes the problem in free text
- `WorkPerformed` field describes the resolution in free text
- Both fields should be written clearly — they appear in customer-facing emails and invoices

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | WorkOrder.id | UUID | `d4e5f6a7b8c9...` |
| QuickBooks Online | — | — | No direct equivalent; invoiced via InvoiceItem |
| Data Warehouse | — | — | Not yet modeled |

## Key Business Rules

- **Work order types** are configurable per company. `WorkOrderType` determines default pricing and categorization.
- **Lifecycle:** Created → Scheduled → In Progress → Completed → Invoiced
- **Completion tracking:** `CompleteTime` is set when tech finishes. Sentinel value `2010-01-01 12:00:00` means NOT completed.
- **Billing status:** `IsInvoiced` flag tracks whether the work order has been billed. A completed work order flows into the billing queue.
- **Pricing:** `Price` is the customer-facing charge. `LaborCost` is the internal cost. Profit = Price - LaborCost.
- **Issue reporting workflow options:**
  - Option 1 (recommended): Finished Work Order — tech completes and marks done
  - Option 2: Unscheduled Work Order — created ad hoc when issue is discovered during a routine stop
- **Installed items:** Techs can track parts installed during a work order via `InstalledItem` records
- **Shopping list:** Parts needed for a work order are tracked via `ShoppingListItem` (Needed → Ordered → Installed lifecycle)

## Data Flow

```
Skimmer (WorkOrder — created by admin or tech)
    │
    ├── Tech completes via Skimmer mobile app
    │   └── InstalledItem records created for parts used
    │
    ├── Admin invoices completed work orders
    │   └── InvoiceItem records link back to WorkOrder
    │
    └── Invoice syncs to QBO (via Skimmer native sync)
        └── QBO sees line items, not the work order entity itself
```

**Not yet in data warehouse.** Work orders are in the Skimmer extract but not modeled in dbt. Future work order analytics would require a `dim_work_order_type` and `fact_work_order` model.

## Field Mapping

| Canonical Field | Skimmer | QBO Advanced | Warehouse | Notes |
|----------------|---------|--------------|-----------|-------|
| Work Order ID | id | — | — | UUID primary key |
| Type | WorkOrderTypeId → WorkOrderType.Description | — | — | Configurable categories |
| Location | ServiceLocationId | — | — | FK to ServiceLocation |
| Problem Description | WorkNeeded | — | — | Free text |
| Resolution | WorkPerformed | — | — | Free text |
| Created By | AddedByAccountId | — | — | FK to Account (admin or tech) |
| Assigned Tech | AccountId | — | — | FK to Account (technician) |
| Scheduled Date | ServiceDate | — | — | When work is planned |
| Start Time | StartTime | — | — | When tech begins |
| Complete Time | CompleteTime | — | — | When tech finishes |
| Estimated Minutes | EstimatedMinutes | — | — | Time estimate |
| Customer Price | Price | InvoiceItem.Rate | — | Amount charged |
| Labor Cost | LaborCost | — | — | Internal cost |
| Invoiced | IsInvoiced | — | — | Boolean: has been billed |
| Company | CompanyId | — | — | AQPS or JOMO |

## Training Resources

- [Mastering Work Order Management: Types & Best Practices](https://www.loom.com/share/d8258cb1030e4581b953715d1a24661b?sid=ec3d0435-5340-4180-a40e-a5e136913ee8)
- [Full Flow: Web Setup to Mobile Execution](https://www.loom.com/share/d52ba8e516c442cfa224330108bff6f6)
- [Why Strong Work Order Documentation Matters](https://thepooldeck.getskimmer.com/skimmer-training-tips-tricks-6/work-order-documentation-can-transform-your-pool-service-business-933)
- [Issue Reporting: Finished Work Order (Recommended)](https://www.loom.com/share/d23b1dba5ecf48859902bdd498eab678)
- [Issue Reporting: Unscheduled Work Order](https://www.loom.com/share/d4ef49582c0a431dbbf151937add01af)
- [How Technicians Track Installed Items](https://www.loom.com/share/cf8bb0f0ef284d318a7ccd3a1be1be44)
- [Work Orders to Billing End-to-End](https://www.loom.com/share/2adc33703f8142ca85181e50373e1b7d)

## Related Entities

- [Service Location](service-location.md) — many:1 (each work order is at one service location)
- [Product](product.md) — via InstalledItem and ShoppingListItem (parts used or needed)
- [Invoice](invoice.md) — 1:many via InvoiceItem (completed work orders generate invoice line items)
- [Payment](payment.md) — indirect via Invoice (work order → invoice → payment)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-18 | Initial definition — Skimmer schema + onboarding training links | Ross Sivertsen |
