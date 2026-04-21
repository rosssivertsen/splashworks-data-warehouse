# Equipment

> **Status:** DRAFT — pending review before release

## Definition

A physical piece of pool infrastructure — a pump, filter, heater, chlorinator, automation system, or other mechanical component — installed at a specific pool. Equipment is tracked for maintenance history, warranty awareness, replacement scheduling, and failure analysis. It is distinct from products and chemicals: equipment is *installed at a pool* and has a Category → Make → Model identity; products and chemicals are *consumed during service*.

## System of Record

**Primary:** Skimmer
**Rationale:** Skimmer is the only system that tracks pool-level equipment inventory, including the three-level taxonomy (category, manufacturer, model). QBO tracks equipment as inventory items for accounting but has no pool-level association. Zoho CRM has no equipment concept.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| EquipmentItem | Skimmer | Database entity — a specific piece of equipment at a pool |
| Equipment | Skimmer UI | User-facing term |
| PartCategory | Skimmer | Equipment type (Pump, Filter, Heater, etc.) |
| PartMake | Skimmer | Manufacturer (Pentair, Hayward, Jandy, etc.) |
| PartModel | Skimmer | Specific model (IntelliFlo VSF, Clean & Clear 150, etc.) |
| Item | QuickBooks Online | QBO's generic inventory entity — no pool association |
| — | Data Warehouse | Not yet modeled (DL-6 on backlog: dim_equipment) |
| — | Zoho CRM | No equivalent |

## Naming Convention

**Standard format:** Category → Make → Model hierarchy

**Rules:**
- Equipment follows a three-level taxonomy:
  - **Category** (PartCategory): Pump, Filter, Heater, Chlorinator, Automation, Cleaner, etc.
  - **Make** (PartMake): Pentair, Hayward, Jandy, Polaris, Zodiac, etc.
  - **Model** (PartModel): IntelliFlo VSF, Clean & Clear 150, H400FDN, AquaRite, etc.
- `Description` on the EquipmentItem is freeform text — may or may not follow the hierarchy
- PartCategory → PartMake → PartModel is a strict hierarchy: a make belongs to one category, a model belongs to one make

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer (EquipmentItem) | EquipmentItem.id | UUID | `e1a2b3c4d5e6...` |
| Skimmer (PartCategory) | PartCategory.id | UUID | `pc1a2b3c4...` |
| Skimmer (PartMake) | PartMake.id | UUID | `pm1a2b3c4...` |
| Skimmer (PartModel) | PartModel.id | UUID | `pmod1a2b3c4...` |
| QuickBooks Online | Item.Id | Numeric | `45` |
| Data Warehouse | — | — | Not yet modeled |

## Key Business Rules

- **Equipment is per-pool:** Each `EquipmentItem` is linked to a specific `Pool`, not to a customer or service location. A pool with a pump, filter, and heater has three equipment records.
- **Soft delete:** `EquipmentItem.SoftDeleted` flag preserves history when equipment is removed or replaced.
- **Replacement tracking:** When equipment is replaced, an `InstalledItem` record is created linking to both the old `EquipmentItem` (via `EquipmentItemId`) and the work performed. `PreviousStatus` records the old equipment's condition.
- **Shopping list integration:** Parts needed for equipment repair flow through `ShoppingListItem` (Needed → Ordered → Installed lifecycle). Each shopping list item can reference the `EquipmentItem` it's for.
- **No age/warranty tracking:** Skimmer does not natively track installation date or warranty expiration on equipment. This is a known gap — notes fields are used as a workaround.
- **Work order connection:** Equipment repairs are tracked via Work Orders. The work order targets a service location; the installed items within it reference specific equipment.

## Data Flow

```
Skimmer (Admin or tech adds equipment to a pool's profile)
    │
    ├── Equipment taxonomy: PartCategory → PartMake → PartModel
    │   └── Configured per company (shared catalog, not per-pool)
    │
    ├── Tech discovers issue during service stop
    │   ├── ShoppingListItem created (Needed)
    │   ├── Part ordered (Ordered)
    │   └── Work Order completed → InstalledItem created (Installed)
    │       └── Old equipment soft-deleted or kept with replacement note
    │
    └── Nightly SQLite Extract
        └── Data Warehouse (not yet modeled — DL-6 backlog)
            └── Future: dim_equipment with Category/Make/Model denormalized
```

## Field Mapping

| Canonical Field | Skimmer (EquipmentItem) | Skimmer (PartCategory) | Skimmer (PartMake) | Skimmer (PartModel) | Warehouse | Notes |
|----------------|------------------------|----------------------|--------------------|--------------------|-----------|-------|
| Equipment ID | id | — | — | — | — | UUID primary key |
| Description | Description | — | — | — | — | Freeform text |
| Category | PartCategoryId | id / Description | — | — | — | FK → PartCategory |
| Make | PartMakeId | — | id / Description | — | — | FK → PartMake |
| Model | PartModelId | — | — | id / Description | — | FK → PartModel |
| Pool | PoolId | — | — | — | — | FK to Pool |
| Notes | Notes | — | — | — | — | Freeform text |
| Soft Deleted | SoftDeleted | — | — | — | — | Boolean |
| Company | CompanyId | CompanyId | — | — | — | AQPS or JOMO |

## Common Equipment Categories

| Category | Examples | Business Relevance |
|----------|----------|-------------------|
| Pump | Variable speed (IntelliFlo), single speed | Highest-value equipment; failure = no circulation |
| Filter | Cartridge (Clean & Clear), DE, sand | Regular cleaning schedule (every 4-6 weeks) |
| Heater | Gas (MasterTemp), heat pump, solar | Seasonal demand; high repair cost |
| Chlorinator | Salt (AquaRite), tablet feeder | Determines chemical delivery method |
| Automation | IntelliCenter, OmniLogic, iAqualink | Controls multiple systems; complex repairs |
| Cleaner | Robotic, pressure, suction | Tenant preference; warranty-sensitive |

## Training Resources

- [How Technicians Track Installed Items](https://www.loom.com/share/cf8bb0f0ef284d318a7ccd3a1be1be44)
- [Using the Shopping List for Product Requests](https://www.loom.com/share/fefeb9c879ad4b51a8c8bd11ad8b16f0)

## Related Entities

- [Pool](pool.md) — many:1 (each equipment item belongs to one pool)
- [Product](product.md) — related but distinct (products are consumable; equipment is installed infrastructure)
- [Work Order](work-order.md) — via InstalledItem (equipment repairs generate work orders)
- [Service Stop](service-stop-DRAFT.md) — via InstalledItem (equipment can be replaced during a service stop)
- [Customer](customer.md) — indirect via Pool → Service Location → Customer

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — EquipmentItem + PartCategory/Make/Model hierarchy, replacement tracking, DL-6 reference | Claude / Ross Sivertsen |
