---
entity: branch
type: glossary
status: DRAFT
system_of_record: warehouse
systems: [skimmer, warehouse]
warehouse_tables: [dim_service_location, dim_customer]
related: [brand, service-location, customer]
---

# Branch

## Definition

A geographic sub-division of a [Brand](brand-DRAFT.md), corresponding to a physical service territory and (usually) a dispatch hub. Customers, route assignments, and technicians are bound to a Branch via the service location's city/ZIP.

Branches exist because the **Splashworks** Brand serves two distinct markets from separate operational footprints, and many KPIs (utilization, route density, on-time rate, profit margin) only make sense at the Branch grain — not rolled up to Brand.

## System of Record

**Primary:** Data Warehouse — derived at ingestion via the Branch Classifier (see [Field Mapping](#field-mapping)) from `dim_service_location.billing_zip` and `dim_service_location.billing_city`.
**Rationale:** Skimmer has no Branch column; the assignment is a derived attribute computed from geography.

## Branches (current)

| Brand | Branch | Hub city | Counties / Markets |
|-------|--------|----------|--------------------|
| JOMO | **Jacksonville** | Jacksonville, FL | Duval, Clay, St. Johns (Nassau optional) |
| Splashworks | **Spring Hill** | Spring Hill, FL | Hernando County |
| Splashworks | **Ocala** | Ocala, FL | Marion + Citrus Counties (incl. Dunnellon) |

JOMO is single-branch; the Branch concept is implicit but recorded for symmetry. Splashworks is two-branch — every Splashworks customer must classify to one of {Spring Hill, Ocala}.

## Branch Classifier (canonical rules)

These rules are implemented in `sales-dashboard/refresh/geography.py` and MUST stay in sync with this glossary entry. If a customer doesn't classify cleanly, the default is **Ocala** (the larger Splashworks branch).

### Splashworks Branch — ZIP-first, then city-keyword

**Spring Hill ZIPs (Hernando County):**

```
34601, 34602, 34603, 34604, 34605, 34606,
34607, 34608, 34609, 34610, 34611, 34612,
34613, 34614, 34636, 34637, 34661
```

If `billing_zip[:5]` matches any of the above → **Spring Hill**.

**Spring Hill city keywords (fallback when ZIP unclassified):**

```
spring hill, brooksville, weeki wachee
```

**Ocala city keywords (Marion + Citrus):**

```
ocala, belleview, silver springs, summerfield,
dunnellon, citra, fort mccoy, reddick, anthony,
sparr, inglis, crystal river, homosassa, lecanto,
beverly hills, hernando, floral city, inverness,
citrus, marion
```

City matching is case-insensitive substring (e.g., "North Ocala" matches `ocala`).

**Default:** Ocala. (Reasoning: Ocala is the larger branch by customer count, so unclassified-default-to-Ocala minimizes miscategorization. Revisit if the customer mix changes.)

### JOMO Branch

JOMO has only one Branch (Jacksonville). All JOMO customers classify there by default. If Splashworks acquires a JOMO competitor in a non-Jacksonville market, a second JOMO Branch will need to be defined.

## Key business rules

- **Branch is derived, not stored:** Skimmer has no Branch column. The Branch Classifier runs at the BI/dashboard layer (currently `geography.py`); the SDW warehouse should compute `branch` as a column on `dim_service_location` so downstream tools don't reimplement the logic.
- **Service Location grain:** Branch is a property of the Service Location, not the Customer. A multi-property customer with locations in both Spring Hill and Ocala (rare but possible) has different Branches per location.
- **Routing:** routes are assigned within a Branch. Cross-branch route assignment is an exception flag.
- **Tech assignment:** technicians belong to a Branch. The dashboard's "Routes per Day by Tech" KPI is implicitly Branch-scoped.
- **Reporting:** KPIs at Branch grain include: route density, drive-time, on-time %, profit per stop, branch utilization. Brand-level rollups MUST sum from Branch grain.

## Field mapping

| Canonical | Source | Notes |
|-----------|--------|-------|
| branch | derived | Output of Branch Classifier — `'Jacksonville'` (JOMO) / `'Spring Hill'` / `'Ocala'` (Splashworks) |
| branch_input.billing_zip | `dim_service_location.billing_zip` | Primary key for Spring Hill match |
| branch_input.billing_city | `dim_service_location.billing_city` | Fallback when ZIP doesn't match Hernando set |

## Open questions for Ross

- Should the Branch Classifier move into the SDW (computed once at warehouse load) so Brian's dashboard, Metabase, Power BI, and future tools all read the same column?
- The Spring Hill ZIP list is 17 ZIPs — is that the canonical Hernando County set, or do we want a programmatic lookup (e.g., `LEFT(zip,3)='346'` AND county='Hernando')?
- For multi-location customers split across Branches, do we attribute the **Customer** to a primary Branch (largest revenue? oldest location?), or always report at Service Location grain?

## Related

- [Brand](brand-DRAFT.md) — parent concept
- [Service Location](service-location.md) — Branch is derived from this entity
- [Customer](customer.md) — Customer's "Branch" is inferred from primary Service Location
- `sales-dashboard/refresh/geography.py` — current implementation of the classifier

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-23 | Initial DRAFT — formalizes the Splashworks Spring Hill / Ocala split that's been living only in `geography.py` | Claude (on Ross's direction) |
