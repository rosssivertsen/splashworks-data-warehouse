# Splashworks Enterprise Data Glossary

## Overview

**What:** A cross-system enterprise data glossary that standardizes how Splashworks defines, names, and tracks core business entities across every application in the stack.

**Why:** Splashworks operates across multiple systems -- Skimmer for service operations, Zoho CRM for sales, QuickBooks Online for accounting, and a Postgres data warehouse for analytics. Without a shared vocabulary, the same concept (e.g., "customer") can mean different things in different contexts. This glossary eliminates ambiguity by establishing canonical definitions, naming conventions, and field mappings for each entity.

**Who:** This glossary serves three audiences:

- **Senior leadership** -- Clear, jargon-free definitions of business entities and how data flows between systems. Use this to understand what data exists, where it lives, and how it connects.
- **Business analysts and SOP authors** -- Authoritative reference for writing standard operating procedures. When an SOP says "customer," this glossary defines exactly what that means, which system owns the record, and what fields matter.
- **Developers** -- Technical field mappings, identifier formats, and join paths for building integrations, reports, and warehouse models.

## Systems

| System | Role | Key Data |
|--------|------|----------|
| **Skimmer** | Service operations | System of record for customer profiles, service locations, pools, technicians, route assignments, service stops, and chemical readings. Nightly SQLite extracts feed the data warehouse. |
| **Zoho CRM** | Sales and leads | Customer intake, lead tracking, sales pipeline. Source of initial customer and contact records before they enter Skimmer. |
| **QuickBooks Online Advanced** | Invoicing, payments, accounting | Financial system of record. Invoices, payments, credits, and chart of accounts. |
| **Data Warehouse** | Postgres analytics hub | All systems converge here. dbt transforms raw extracts into dimensional models (staging, warehouse, semantic layers) for reporting and AI-powered querying. |

## Directory Structure

```
docs/enterprise/
  README.md                  # This file -- entry point and index
  CLAUDE.md                  # AI tooling context for this directory
  glossary/                  # One file per business entity
    customer.md
    contact.md
    service-location.md
    pool.md
    work-order.md
    invoice.md
    payment.md
    product.md
  standards/                 # Cross-cutting rules and conventions
    naming-conventions.md
  references/                # API docs, integration specs, external resources
    qbo-accounting-api.md
    qbo-payments-api.md
  system-landscape.md        # Architecture diagram showing system integrations
```

- **glossary/** -- Each entity gets its own file following the template below. One entity, one file, no exceptions.
- **standards/** -- Rules that apply across all entities: naming conventions, data quality expectations, change management procedures.
- **references/** -- External documentation, API references, and integration specifications that glossary entries link to.
- **system-landscape.md** -- A visual diagram (Mermaid or image) showing how systems connect, what data flows between them, and which direction.

## Entity Template

Every glossary entry follows this structure. Copy it verbatim when creating a new entity.

```markdown
# {Entity Name}

## Definition

{1-2 sentences in plain English. What is this entity? What business concept does it represent?
Write it so a non-technical stakeholder can understand it without further context.}

## System of Record

**Primary system:** {System name}
**Rationale:** {Why this system is authoritative for this entity.}

## Synonyms

| Term | System | Context |
|------|--------|---------|
| {Alternate name} | {Where it appears} | {When/why this term is used} |

## Naming Convention

**Standard format:** {e.g., "FirstName LastName", "ACME Pool Service — Main Office"}
**Rules:**
- {Rule 1}
- {Rule 2}

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| {System} | {Field name} | {Format description} | {Example value} |

## Key Business Rules

- {Rule 1 -- e.g., "A customer must have at least one service location to be considered active."}
- {Rule 2}

## Data Flow

{Mermaid diagram or plain-text description showing how this entity's data moves between systems.}

## Field Mapping

| Canonical Field | Skimmer | Zoho CRM | QBO | Warehouse | Notes |
|----------------|---------|----------|-----|-----------|-------|
| {field} | {Skimmer field} | {Zoho field} | {QBO field} | {warehouse column} | {notes} |

## Related Entities

- [{Related entity}](glossary/{related-entity}.md) -- {relationship description}

## Change Log

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | {What changed} | {Who} |
```

## How to Add a New Entity

1. Copy the full entity template above into a new file.
2. Fill in every section. If a section does not apply, write "N/A" with a brief explanation rather than deleting it.
3. Save the file as `docs/enterprise/glossary/{entity-name}.md` using kebab-case (e.g., `service-location.md`, `route-assignment.md`).
4. Add links from the "Related Entities" section in every connected entry. Relationships are bidirectional -- if Customer links to Service Location, Service Location must link back to Customer.
5. Update the "Current Entities" list in this README.

## How to Add a New System

1. Add a new column to the "Field Mapping" table in every glossary entry.
2. Add a new row to the "Systems" table in this README.
3. Update the `system-landscape.md` diagram to show the new system's integrations and data flows.
4. Update `docs/enterprise/CLAUDE.md` (if it exists) so AI tooling is aware of the new system.

## Current Entities

| Entity | File | Description |
|--------|------|-------------|
| Customer | [glossary/customer.md](glossary/customer.md) | The business or individual that contracts Splashworks for pool service |
| Contact | [glossary/contact.md](glossary/contact.md) | A person associated with a customer account |
| Service Location | [glossary/service-location.md](glossary/service-location.md) | A physical address where pool service is performed |
| Pool | [glossary/pool.md](glossary/pool.md) | A body of water at a service location that receives maintenance |
| Work Order | [glossary/work-order.md](glossary/work-order.md) | A repair, maintenance, or one-time service request at a service location |
| Invoice | [glossary/invoice.md](glossary/invoice.md) | A billing document aggregating charges from service stops and work orders |
| Payment | [glossary/payment.md](glossary/payment.md) | A financial transaction recording money received against an invoice |
| Product | [glossary/product.md](glossary/product.md) | A chemical, part, or equipment item used or sold during pool service |

## Version History

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-03-14 | Initial glossary — 4 customer-centric entities, 4 systems |
| v1.1 | 2026-03-18 | Added Work Order, Invoice, Payment, Product entities (EIA-3 + EIA-4 scope) |
