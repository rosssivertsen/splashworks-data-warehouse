# CLAUDE.md — Enterprise Data Glossary

## Purpose

Enterprise data glossary — canonical reference for entity definitions, naming conventions, system-of-record designations, and data flows across Splashworks applications. This is a **documentation-only directory** — no code, no dbt models, no API changes.

## Systems in Scope

| System | Domain | Notes |
|--------|--------|-------|
| **Skimmer** | Service operations | Pool service management SaaS — nightly SQLite extracts |
| **Zoho CRM** | Sales / leads | Customer acquisition pipeline |
| **QuickBooks Online Advanced** | Invoicing / payments / accounting | Financial system of record |
| **Data Warehouse** | Analytics hub | Postgres 16 + pgvector, dbt layers (staging / warehouse / semantic) |

## Company Entities

| Code | Company |
|------|---------|
| AQPS | A Quality Pool Service of Central Florida, Inc. |
| JOMO | Jomo Pool Service |

## Entity Template

See `README.md` for the full glossary entry template. Key sections per entity:

- **Definition** — What the entity represents in business terms
- **System of Record** — Which system owns the golden record
- **Synonyms** — Alternate names across systems (e.g., Customer vs. Contact vs. Client)
- **Naming Convention** — Table/field names per system
- **Identifiers** — Primary keys and cross-system ID mappings
- **Key Business Rules** — Active/inactive logic, required fields, constraints
- **Data Flow** — How the entity moves between systems (direction, frequency)
- **Field Mapping** — Column-level mapping across systems
- **Related Entities** — Foreign key relationships and join paths
- **Change Log** — Version history for the glossary entry

## Cross-System Patterns

### Soft-Delete

- **Skimmer:** `IsInactive` + `Deleted` flags (both integers, 0/1)
- **QBO:** `active` boolean (true/false)
- **Warehouse:** mirrors Skimmer — `is_inactive` + `deleted` (snake_case)

### Active Customer Filter

- **Skimmer / Warehouse:** `is_inactive = 0 AND deleted = 0` (BOTH conditions required)
- **Cancelled customer:** `is_inactive = 1 OR deleted = 1`, use `updated_at` as cancellation date

### Identifier Patterns

| System | Format | Example |
|--------|--------|---------|
| Skimmer | UUIDs | `CustomerId = 'e265c9de...'` |
| Zoho CRM | Numeric IDs | `Contact.id = 123456` |
| QBO | Numeric IDs | `Customer.Id = 42` |
| Warehouse | Composite keys | `customer_id + _company_name` |

### Column Casing

| System | Convention | Example |
|--------|------------|---------|
| Skimmer | PascalCase | `CustomerId`, `IsInactive` |
| Zoho CRM | Mixed_Case | `Contact_Name`, `Lead_Source` |
| QBO | PascalCase | `DisplayName`, `PrimaryPhone` |
| Warehouse | snake_case | `customer_id`, `is_inactive` |

## Related Documentation

| File | Purpose |
|------|---------|
| `docs/DATA_DICTIONARY.md` | Raw Skimmer schema — field-level documentation for all 30 tables |
| `docs/skimmer-semantic-layer.yaml` | Business terms, SQL patterns, verified queries, metrics |
| `docs/ERD.md` | Entity relationship diagrams (Skimmer / Warehouse) |
