# Company

> **Status:** DRAFT — pending review before release

## Definition

A legal business entity that operates pool service under the Splashworks umbrella. Splashworks currently operates two companies — AQPS and JOMO — through a single Skimmer instance. The company entity is the multi-tenancy root: every customer, service location, technician, invoice, and operational record belongs to exactly one company. All warehouse queries must include the company discriminator to prevent cross-company data leakage.

## System of Record

**Primary:** Skimmer
**Rationale:** Skimmer manages multi-company operations natively. Each company has its own customer base, technician roster, route schedules, invoice sequences, product catalog, and configuration. QBO may have separate "companies" or use class tracking, but Skimmer is the operational source of truth.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| Company | Skimmer | Root entity — `Company` table with `CompanyId` FK on every other table |
| Company | QuickBooks Online | QBO treats each company as a separate tenant (separate QBO account) |
| dim_company | Data Warehouse | Warehouse dimension table (from `company_lookup` seed) |
| _company_name | Data Warehouse | Discriminator column on every staging, warehouse, and semantic table |
| — | Zoho CRM | No multi-company concept — Zoho is a single tenant |

## Current Company Entities

| Short Code | Legal Name | Skimmer CompanyId | Warehouse _company_name |
|------------|-----------|-------------------|------------------------|
| AQPS | A Quality Pool Service of Central Florida, Inc. | `e265c9dee47c47c6a73f689b0df467ca` | `AQPS` |
| JOMO | Jomo Pool Service | `95d37a64d1794a1caef111e801db5477` | `JOMO` |

## Naming Convention

**Standard format:** Four-letter uppercase short code (e.g., `AQPS`, `JOMO`)

**Rules:**
- Short code used in warehouse `_company_name` column, logs, and cross-system references
- Legal name used in customer-facing documents, invoices, contracts
- Skimmer uses the full UUID `CompanyId` internally; short codes are a warehouse convenience

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | Company.id | UUID | `e265c9dee47c47c6a73f689b0df467ca` |
| Data Warehouse | _company_name | Text (short code) | `AQPS` |
| Data Warehouse | company_id | UUID (from Skimmer) | `e265c9dee47c47c6a73f689b0df467ca` |

**Cross-system linkage:**
- Warehouse `company_lookup` seed maps `company_id` (UUID) → `company_name` (short code) → `company_full_name` (legal name)
- Every staging model adds `_company_name` via the `union_companies()` dbt macro, which unions the AQPS and JOMO database extracts

## Key Business Rules

- **Multi-tenancy is absolute:** AQPS and JOMO share a Skimmer instance but their data is completely segregated by `CompanyId`. A customer in AQPS cannot appear on a JOMO route.
- **Warehouse composite keys:** ALL joins in the warehouse must include BOTH the entity ID AND `_company_name`. Joining on `customer_id` alone risks matching an AQPS customer to a JOMO record if UUIDs ever collide.
- **Independent sequences:** Invoice numbers, quote numbers, and other sequences are per-company. Invoice #1001 in AQPS is unrelated to Invoice #1001 in JOMO.
- **Independent configuration:** Each company has its own:
  - Product catalog and pricing
  - Work order types and defaults
  - Entry descriptions (chemical reading templates)
  - Tax groups and rates
  - Company settings (default minutes per stop, privacy settings, etc.)
  - Company address(es)
- **Subscription:** `ActiveUntil` on the Company record tracks the Skimmer subscription expiration
- **Soft delete:** `Deleted` flag for deactivated companies (not used for AQPS or JOMO today)

## Data Flow

```
Skimmer (Company — configured by Skimmer admin)
    │
    ├── Every entity includes CompanyId FK
    │   └── Segregates AQPS and JOMO data
    │
    ├── Nightly SQLite Extract (separate .db file per company)
    │   ├── AQPS.db
    │   └── JOMO.db
    │
    └── Data Warehouse
        ├── ETL: union_companies() macro unions both extracts, adds _company_name
        ├── company_lookup seed: maps UUID → short code → legal name
        └── dim_company: company_id, company_name, company_full_name
```

## Field Mapping

| Canonical Field | Skimmer | Warehouse | Notes |
|----------------|---------|-----------|-------|
| Company ID | id | company_id | UUID primary key |
| Name | Name | company_name | Short code in warehouse (AQPS, JOMO) |
| Full Name | — | company_full_name | Legal name from seed |
| Subscription End | ActiveUntil | — | Not in warehouse |
| Created | CreatedAt | — | Not in warehouse |
| Updated | UpdatedAt | — | Not in warehouse |
| Deleted | Deleted | — | Soft delete flag |

## Configuration Entities (Children of Company)

These tables are company-scoped configuration — not modeled in the glossary individually but important to understand:

| Config Entity | Purpose | Notes |
|--------------|---------|-------|
| CompanySetting | Global defaults (minutes per stop, privacy settings) | One row per company |
| CompanyAddress | Office location(s) with GPS coordinates | For route optimization start point |
| WorkOrderType | Work order categories with default pricing | Per-company catalog |
| EntryDescription | Chemical reading templates and dosage types | Per-company catalog |
| ProductCategory | Product groupings | Per-company catalog |
| TaxGroup + TaxRate | Jurisdiction-based tax rules | Per-company tax config |
| SkippedStopReason | Reasons for skipping a stop | Per-company list |

## Related Entities

- [Customer](customer.md) — 1:many (a company has many customers)
- [Technician](technician-DRAFT.md) — 1:many (a company employs many technicians)
- [Service Location](service-location.md) — 1:many (via Customer)
- [Invoice](invoice.md) — 1:many (invoices are per-company)
- [Product](product.md) — 1:many (product catalog is per-company)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — multi-tenancy root entity, warehouse composite key rules, configuration children | Claude / Ross Sivertsen |
