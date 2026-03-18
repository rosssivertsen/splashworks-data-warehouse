# Pool

## Definition

A body of water at a service location that Splashworks maintains. Each pool has its own chemical readings, service history, and equipment baseline. Skimmer refers to this as a "Body of Water" in its user interface.

## System of Record

**Primary:** Skimmer
**Rationale:** Skimmer is the only system with pool-level detail (gallons, filter pressure, chemical readings, service history). QBO has no pool concept. Zoho CRM captures only a basic pool type descriptor.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| Body of Water | Skimmer UI | User-facing term in Skimmer's interface |
| Pool | Skimmer DB | Database entity name |
| Pool_Type | Zoho CRM | A field on the Contact record — basic descriptor only (e.g., "Residential", "Commercial") |
| — | QuickBooks Online | No equivalent |
| dim_pool | Data Warehouse | Warehouse dimension table |

## Naming Convention

**Standard format:** Descriptive name identifying the specific body of water

**Rules:**
- Use the customer's naming convention if they have one (e.g., "Main Pool", "Spa", "Overflow")
- For single-pool locations, "Pool" is acceptable
- For multi-pool locations, differentiate clearly (e.g., "Front Pool", "Back Pool", "Hot Tub")
- Avoid generic labels like "Pool 1", "Pool 2" — use descriptive names when possible

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | PoolId (id) | UUID | `d4e7f2a1b8c34...` |
| Zoho CRM | — | — | No pool-level identifier |
| QuickBooks Online | — | — | No equivalent entity |
| Data Warehouse | pool_id + _company_name | UUID + text | `d4e7f2a1...` + `JOMO` |

## Key Business Rules

- **One location, many pools:** A service location can have multiple bodies of water (e.g., pool + spa + wading pool)
- **Pool is the operational grain:** Chemical readings and service stops are recorded per-pool, not per-location
- **Gallons:** Pool volume in gallons — used for chemical dosing calculations
- **Baseline filter pressure:** Reference pressure for the pool's filtration system — techs compare current readings against this
- **Soft delete:** Skimmer uses `Deleted` flag. Warehouse `dim_pool` filters `deleted = 0`.
- **Pool dedup in queries:** When joining dim_pool to route assignments, GROUP BY route_assignment_id to avoid counting the same visit multiple times across pools at the same location
- **Zoho limitation:** Zoho CRM only stores a pool type string (e.g., "Residential") — no gallons, no equipment, no chemical history
- **Key join path:** Customer → Service Location → Pool → fact_service_stop (chemical readings and visit history)

## Data Flow

```
Zoho CRM (Pool_Type field on Contact — minimal)
    │
    ▼ CRM-to-Skimmer Sync (maps to bodiesOfWater.name)
    │
Skimmer (Pool / Body of Water — full detail)
    │
    ▼ Nightly Extract
    │
Data Warehouse
    ├── public_staging.stg_pool (raw)
    └── public_warehouse.dim_pool (cleaned, with customer_id from service_location join)
```

## Field Mapping

| Canonical Field | Skimmer | Zoho CRM | QBO Advanced | Warehouse | Notes |
|----------------|---------|----------|--------------|-----------|-------|
| Pool Name | PoolName | Pool_Type | — | pool_name | Zoho only has type, not full name |
| Gallons | Gallons | — | — | gallons | Pool volume for dosing calculations |
| Filter Pressure | BaselineFilterPressure | — | — | baseline_filter_pressure | Equipment reference |
| Notes | Notes | — | — | notes | Free text |
| Service Location Link | ServiceLocationId | — | — | service_location_id | FK to Service Location |
| Customer Link | — | — | — | customer_id | Derived via service_location join in warehouse |
| Deleted | Deleted | — | — | — | Soft delete, filtered in warehouse |

## Related Entities

- [Service Location](service-location.md) — many:1 (each pool belongs to one service location)
- [Customer](customer.md) — indirect via Service Location (Pool → Service Location → Customer)
- [Product](product.md) — 1:many for equipment (equipment items are installed at specific pools)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-14 | Initial definition — 4 systems mapped | Ross Sivertsen |
