---
entity: brand
type: glossary
status: DRAFT
system_of_record: warehouse
systems: [skimmer, qbo, warehouse]
warehouse_tables: [dim_customer]
related: [branch, customer, company]
---

# Brand

## Definition

A customer-facing trade name under which Splashworks delivers pool service. A Brand is the marketing/operational identity seen by customers; it is distinct from the legal **Tenant** (the LLC that operates under the brand) and the underlying Skimmer **company_id** (the technical multi-tenancy key).

Two Brands exist today: **JOMO** (Jacksonville market) and **Splashworks** (Florida Gulf-coast markets, served from two Branches — see [branch-DRAFT.md](branch-DRAFT.md)).

## System of Record

**Primary:** Data Warehouse (`_company_name` column in `dim_customer` and most warehouse tables).
**Rationale:** Brand is a derived/operational concept that exists in Skimmer only as a separate database per brand, not as a column. The warehouse stamps every row with `_company_name` during ingestion, making Brand queryable across the unified analytics layer.

## Synonyms — load-bearing naming asymmetry

| Term | System | Meaning |
|------|--------|---------|
| **Brand** (canonical) | EIA / Warehouse | Customer-facing trade name |
| `_company_name` | Warehouse `dim_*`, `fact_*` tables | The column that carries Brand on every row. Values: `'AQPS'`, `'JOMO'` |
| **Splashworks** | Customer-facing | Brand label used in marketing, the dashboard, and on `sales.splshwrks.com` |
| **AQPS** | Warehouse / SDW | Technical canonical name for the Splashworks Brand (legacy of legal entity "A Quality Pool Services") |
| **JOMO** | All systems | Same string used everywhere — no asymmetry |
| **Tenant** | Multi-tenancy concept | Synonym for `_company_name` in security/access contexts |
| **Company** | Skimmer | Skimmer's company_id (UUID); maps 1:1 to Brand but is a technical key, not a label |

**Critical:** *"Splashworks" (brand label) and "AQPS" (warehouse value) refer to the same Brand.* Any new analytics surface MUST normalize one to the other at presentation time. The dashboard chooses "Splashworks" for display; SQL and warehouse models keep "AQPS" for stable joins.

## Identifiers

| System | Field | Format | Splashworks value | JOMO value |
|--------|-------|--------|-------------------|------------|
| Skimmer | `company_id` | UUID | `e265c9dee47c47c6a73f689b0df467ca` | `95d37a64d1794a1caef111e801db5477` |
| Warehouse | `_company_name` | text | `AQPS` | `JOMO` |
| OneDrive extract path | filename prefix | text | `AQPS*.db.gz` | `JOMO*.db.gz` |
| QBO realm | realmId | numeric | TBD | TBD |
| M365 email domain | UPN | text | `@splashworkspools.com` | `@jomopoolservice.com` |
| Dashboard / web | display label | text | `Splashworks` | `JOMO` |

## Brand → Branch hierarchy

```
Brand
├── JOMO ───────────► (single branch, implicit) — Jacksonville
└── Splashworks ────► Branch
                      ├── Spring Hill
                      └── Ocala
```

JOMO is a single-branch Brand (Jacksonville). Splashworks is multi-branch — see [branch-DRAFT.md](branch-DRAFT.md) for the city/ZIP classifier.

## Key business rules

- **Multi-tenancy isolation:** every fact/dim row in the warehouse carries `_company_name` and joins MUST include it in the predicate. Cross-brand contamination is a data-integrity bug, not a feature.
- **Display normalization:** at presentation time, `_company_name='AQPS'` → `"Splashworks"`. This mapping lives in the consuming application (dashboard, BI tool) — the warehouse does not store the display label.
- **No "All Brands" rollup as canonical:** dashboards may show aggregate rows, but the underlying grain is always per-Brand. There is no parent legal entity in the warehouse today (AQPN, the parent LLC, is not modeled as a Brand).
- **New brands:** if Splashworks acquires a third brand, it gets a new `_company_name` value, a new Skimmer database, a new OneDrive extract, and a new row in the Brand registry. Mappings are not retroactively rewritten.

## Field mapping

| Canonical | Warehouse | Skimmer | QBO | Dashboard |
|-----------|-----------|---------|-----|-----------|
| Brand | `_company_name` | (database-level, not column) | n/a | `data.brand` |
| Display Label | (derived: AQPS→Splashworks, JOMO→JOMO) | n/a | n/a | tile labels, headers |

## Related entities

- [Branch](branch-DRAFT.md) — Splashworks Brand splits into two Branches; JOMO is single-branch
- [Customer](customer.md) — every customer belongs to exactly one Brand
- [Company](company-DRAFT.md) — the technical Skimmer-side multi-tenancy primitive

## Open questions for Ross

- Is **AQPS** the long-term canonical warehouse value, or should it be renamed to `SPLASHWORKS` during the SDW migration? (Renaming touches every `dim_*` row but eliminates the naming asymmetry forever.)
- Should the parent legal entity **AQPN** (A Quality Pool Network) be modeled as a `Group` above Brand for M&A reporting?

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-23 | Initial DRAFT — captures the Splashworks↔AQPS naming asymmetry that's been load-bearing across the dashboard, SDW migration, and Cloudflare Access policies | Claude (on Ross's direction) |
