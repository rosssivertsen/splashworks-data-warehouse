---
entity: product
type: glossary
system_of_record: skimmer
systems: [skimmer, qbo, warehouse]
warehouse_tables: [fact_dosage, fact_invoice_item]
related: [invoice, work-order]
---

# Product

## Definition

A physical item — chemical, part, or piece of equipment — used or sold during pool service. Products are tracked for inventory awareness, billing, and profitability. They flow through a lifecycle: stocked → requested (shopping list) → installed → invoiced.

## System of Record

**Primary:** Skimmer
**Rationale:** Skimmer manages the product catalog, shopping lists, installed items, and equipment hierarchy. QBO tracks products as inventory items for accounting, but Skimmer is the operational source of truth for what was used where.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| Product | Skimmer | General product catalog entity |
| Chemical | Skimmer | Subset — pool chemicals with dosage tracking |
| EquipmentItem | Skimmer | Installed equipment at a pool (pump, filter, heater) |
| InstalledItem | Skimmer | A product, chemical, or equipment part installed during service |
| ShoppingListItem | Skimmer | A product requested/needed for an upcoming job |
| Item | QuickBooks Online | QBO's generic inventory/service item entity |
| — | Data Warehouse | Not yet modeled (DL-6 dim_equipment on backlog) |

## Naming Convention

**Standard format:** Product names should match manufacturer labels where possible.

**Rules:**
- Chemical names: use common industry names (e.g., "Liquid Chlorine", "Muriatic Acid", "CYA")
- Equipment follows a hierarchy: Category → Make → Model (e.g., "Pump → Pentair → IntelliFlo VSF")
- Product categories are configurable per company in Skimmer

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer (Product) | Product.id | UUID | `p1a2b3c4...` |
| Skimmer (Chemical) | Chemical.id | UUID | `c1a2b3c4...` |
| Skimmer (Equipment) | EquipmentItem.id | UUID | `e1a2b3c4...` |
| QuickBooks Online | Item.Id | Numeric | `45` |
| Data Warehouse | — | — | Not yet modeled |

## Key Business Rules

- **Equipment hierarchy:** `PartCategory` → `PartMake` → `PartModel`. Example: "Filter" → "Pentair" → "Clean & Clear 150"
- **Equipment is per-pool:** Each `EquipmentItem` is linked to a specific `Pool`, not a customer or location
- **Soft delete:** `EquipmentItem.SoftDeleted` keeps history without permanent deletion
- **Shopping list lifecycle:** `ItemStatus` tracks: Needed → Ordered → Installed. When installed, an `InstalledItem` record is created.
- **Installed items link to source:** An `InstalledItem` can reference an `EquipmentItem` (replacement), `Chemical` (dosage), or `Product` (general item). The `ItemType` field distinguishes them.
- **Billing:** Installed items flow into `InvoiceItem` records for customer billing. `Price` on InstalledItem is the customer-facing charge.
- **Chemical dosage tracking:** Chemical products connect to `ServiceStopEntry` for dosage readings and chemical usage per service visit

## Data Flow

```
Skimmer (Product/Chemical catalog — admin configured)
    │
    ├── Tech identifies need during service stop
    │   └── ShoppingListItem created (status: Needed)
    │
    ├── Parts ordered
    │   └── ShoppingListItem updated (status: Ordered)
    │
    ├── Tech installs part
    │   └── InstalledItem created, linked to WorkOrder or ServiceStop
    │       └── ShoppingListItem updated (status: Installed)
    │
    ├── Admin invoices
    │   └── InvoiceItem created from InstalledItem
    │
    └── Nightly SQLite Extract
        └── Data Warehouse (not yet modeled — DL-6 backlog)
```

## Field Mapping

| Canonical Field | Skimmer (Product) | Skimmer (Chemical) | Skimmer (Equipment) | QBO | Warehouse | Notes |
|----------------|-------------------|--------------------|--------------------|-----|-----------|-------|
| Name | Description | Description | Description | Name | — | Display name |
| Category | ProductCategory.Description | — | PartCategory.Description | Type | — | |
| Make | — | — | PartMake.Description | — | — | Equipment only |
| Model | — | — | PartModel.Description | — | — | Equipment only |
| Price | UnitPrice | — | — | UnitPrice | — | Customer-facing |
| Cost | UnitCost | — | — | PurchaseCost | — | Internal cost |
| Pool Link | — | — | PoolId | — | — | Equipment is per-pool |
| Company | CompanyId | CompanyId | CompanyId | — | — | AQPS or JOMO |

## Training Resources

- [Why Products Matter](https://www.loom.com/share/80dbce17c75a4fb4b6ef201d73522b92)
- [Using the Shopping List for Product Requests and On-the-Spot Installs](https://www.loom.com/share/fefeb9c879ad4b51a8c8bd11ad8b16f0)
- [How Technicians Track Installed Items](https://www.loom.com/share/cf8bb0f0ef284d318a7ccd3a1be1be44)
- [Chemical Spend System Calculator](https://docs.google.com/spreadsheets/d/1TemXbDK7OMvU1RnOxBT5wt-HnnsvHNWmVf05q0c1-jo/copy)
- [Repair Pricing Calculator](https://docs.google.com/spreadsheets/d/1OleiqVNTVnmC5Hva-l0Y8yt_5ROVbQls0j0gHFuL8tE/copy)
- [Learn Orenda's LSI Method in Skimmer](https://drive.google.com/file/d/1a5f1Q8mH9x9DHYgZjq57vA0YBHYjxAMt/edit)

## Related Entities

- [Pool](pool.md) — many:1 for equipment (each equipment item belongs to one pool)
- [Work Order](work-order.md) — via InstalledItem and ShoppingListItem (parts used/needed for work)
- [Invoice](invoice.md) — via InvoiceItem (product charges as line items)
- [Service Location](service-location.md) — indirect via Pool (products installed at a location's pool)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-18 | Initial definition — Skimmer product/chemical/equipment schema, training links | Ross Sivertsen |
