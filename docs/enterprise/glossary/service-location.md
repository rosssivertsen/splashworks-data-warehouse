# Service Location

## Definition

A physical property where Splashworks performs pool service. Each service location has a street address, service rate, and one or more pools (bodies of water). A single customer may have multiple service locations.

## System of Record

**Primary:** Skimmer
**Rationale:** Service locations are created and maintained in Skimmer as part of operational scheduling. Rate and labor cost are configured per-location in Skimmer. Neither Zoho CRM nor QBO has a full service location concept.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| ServiceLocation | Skimmer | Database entity name |
| Service Address | Skimmer UI | User-facing term in Skimmer's interface |
| Other Address | Zoho CRM | The "Other Address" field on a Contact is used for service address |
| — | QuickBooks Online | No equivalent — QBO only tracks billing address |
| dim_service_location | Data Warehouse | Warehouse dimension table |

## Naming Convention

**Standard format:** Street address in title case

**Rules:**
- Full street address: "123 Main St" (not "123 main st" or "123 MAIN ST")
- Use standard USPS abbreviations: St, Ave, Blvd, Dr, Ln, Ct
- City names in title case
- State as two-letter abbreviation (FL, not Florida)
- Five-digit ZIP code (no ZIP+4 unless available)
- Known issue: some existing records have inconsistent casing (e.g., "williston" vs "Ocala") — normalize to title case going forward

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | ServiceLocationId (id) | UUID | `b3f8a2c1e5d74...` |
| Zoho CRM | — | — | No dedicated ID; address fields on Contact |
| QuickBooks Online | — | — | No equivalent entity |
| Data Warehouse | service_location_id + _company_name | UUID + text | `b3f8a2c1...` + `AQPS` |

## Key Business Rules

- **One customer, many locations:** A customer can have multiple service locations (e.g., residential + vacation home, or a property management company with multiple properties)
- **Rate and labor cost are per-location:** Not per-customer. This is critical for profitability calculations.
- **Rate types:** FlatMonthlyRateIncludingChemicals, FlatMonthlyRatePlusChemicals, PerStopIncludingChemicals, PerStopPlusChemicals, None
- **Labor cost types:** PerStop, PerMonth
- **Soft delete:** Skimmer uses `Deleted` flag. Warehouse `dim_service_location` filters `deleted = 0`.
- **QBO gap:** QuickBooks has no concept of service location. Invoices reference billing address, not service address. This means service-level profitability analysis is only available in the warehouse, not in QBO reporting.

## Data Flow

```
Zoho CRM (Other_Address on Contact — partial)
    │
    ▼ CRM-to-Skimmer Sync (address fields mapped to ServiceLocation)
    │
Skimmer (ServiceLocation — full entity with rate, labor cost)
    │
    ▼ Nightly Extract
    │
Data Warehouse
    ├── public_staging.stg_service_location (raw)
    └── public_warehouse.dim_service_location (cleaned, with address, rate, labor_cost)
```

## Field Mapping

| Canonical Field | Skimmer | Zoho CRM | QBO Advanced | Warehouse | Notes |
|----------------|---------|----------|--------------|-----------|-------|
| Address | Address | Other_Street | — | address | Street address |
| City | City | Other_City | — | city | |
| State | State | Other_State | — | state | Two-letter abbreviation |
| ZIP | Zip | Other_Zip | — | zip | |
| Service Rate | Rate | — | — | rate | Monthly or per-stop rate |
| Rate Type | RateType | — | — | rate_type | See rate types above |
| Labor Cost | LaborCost | — | — | labor_cost | Per-stop or per-month |
| Labor Cost Type | LaborCostType | — | — | labor_cost_type | PerStop or PerMonth |
| Customer Link | CustomerId | Contact.id | — | customer_id | FK to Customer |
| Deleted | Deleted | — | — | — | Soft delete flag, filtered in warehouse |

## Related Entities

- [Customer](customer.md) — many:1 (each service location belongs to one customer)
- [Pool](pool.md) — 1:many (each service location can have multiple pools)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-14 | Initial definition — 4 systems mapped | Ross Sivertsen |
