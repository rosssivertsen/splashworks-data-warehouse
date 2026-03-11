# Enterprise Data Glossary — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the enterprise data glossary directory, create the four customer-centric entity definitions, system landscape diagram, naming conventions, and CLAUDE.md files.

**Architecture:** Pure documentation — markdown files in `docs/enterprise/`, no code changes. Content derived from existing DATA_DICTIONARY.md, skimmer-semantic-layer.yaml, CRM-to-Skimmer field mappings, and QBO API references.

**Tech Stack:** Markdown, Mermaid diagrams

**Spec:** `docs/plans/2026-03-14-enterprise-glossary-design.md`

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Create | `docs/enterprise/CLAUDE.md` | Claude context for glossary work |
| Create | `docs/enterprise/README.md` | Overview and usage guide |
| Create | `docs/enterprise/system-landscape.md` | Versioned system diagram |
| Create | `docs/enterprise/glossary/customer.md` | Customer entity definition |
| Create | `docs/enterprise/glossary/contact.md` | Contact entity definition |
| Create | `docs/enterprise/glossary/service-location.md` | Service Location entity definition |
| Create | `docs/enterprise/glossary/pool.md` | Pool entity definition |
| Create | `docs/enterprise/standards/naming-conventions.md` | Cross-system naming standards |
| Create | `docs/enterprise/references/qbo-accounting-api.md` | QBO Accounting API reference |
| Create | `docs/enterprise/references/qbo-payments-api.md` | QBO Payments API reference |
| Modify | `CLAUDE.md` (root) | Add 3-line pointer to enterprise glossary |

---

## Chunk 1: Foundation Files

### Task 1: Create `docs/enterprise/CLAUDE.md`

**Files:**
- Create: `docs/enterprise/CLAUDE.md`

**Context:**
- This file loads automatically when Claude works on files in `docs/enterprise/`
- Should contain: purpose, systems in scope, entity template, naming standards reference
- Should NOT duplicate root CLAUDE.md content — just glossary-specific context

- [ ] **Step 1: Write the enterprise CLAUDE.md**

Content should include:
- Purpose of the enterprise glossary
- Systems in scope: Skimmer, Zoho CRM, QBO Advanced, Data Warehouse
- Entity template structure (abbreviated — point to README for full template)
- Key cross-system patterns (soft-delete conventions, identifier formats)
- Note: documentation-only directory, no code
- Pointer back to `docs/DATA_DICTIONARY.md` and `docs/skimmer-semantic-layer.yaml` for technical detail

- [ ] **Step 2: Commit**

```bash
git add docs/enterprise/CLAUDE.md
git commit -m "docs(enterprise): add CLAUDE.md for glossary context"
```

---

### Task 2: Create `docs/enterprise/README.md`

**Files:**
- Create: `docs/enterprise/README.md`

**Context:**
- This is the entry point for anyone finding this directory
- Should explain: what the glossary is, who it's for, how to use it, how to add entries
- Include the full entity template so contributors can follow the pattern

- [ ] **Step 1: Write README.md**

Sections:
- Overview (what is this, why does it exist)
- Audience (developers, business users, leadership)
- Directory structure explanation
- Entity template (full version)
- How to add a new entity
- How to add a new system
- Version history

- [ ] **Step 2: Commit**

```bash
git add docs/enterprise/README.md
git commit -m "docs(enterprise): add README with glossary structure and entity template"
```

---

### Task 3: Create `docs/enterprise/system-landscape.md`

**Files:**
- Create: `docs/enterprise/system-landscape.md`

**Context:**
- Mermaid flowchart showing all four systems and data flows
- Versioned with date header
- Shows: Zoho CRM → CRM Sync → Skimmer ← QBO native sync; Skimmer → Nightly Extract → Warehouse → BI tools
- Change log at bottom

**Source data:**
- CRM-to-Skimmer sync: `../CRMtoSkimmer/crm-to-skimmer-poc/docs/architecture.md`
- Warehouse ETL: `etl/scripts/nightly-pipeline.sh`
- QBO: Skimmer has native QBO sync (invoice/payment data flows via Skimmer, not directly to warehouse)

- [ ] **Step 1: Write system-landscape.md**

Include:
- Version header: "Current State: v1.0 — March 2026"
- Mermaid flowchart with all systems, integration points, and data flow direction
- Brief description of each integration (method, frequency, direction)
- Notes on planned/future integrations
- Change log table

- [ ] **Step 2: Commit**

```bash
git add docs/enterprise/system-landscape.md
git commit -m "docs(enterprise): add system landscape diagram v1.0"
```

---

### Task 4: Update root CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (root of repo)

- [ ] **Step 1: Add pointer to enterprise glossary**

Add after the "Key Documentation" table:

```markdown
## Enterprise Glossary

Enterprise data glossary lives in `docs/enterprise/`.
See `docs/enterprise/README.md` for structure and usage.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add enterprise glossary pointer to root CLAUDE.md"
```

---

## Chunk 2: Entity Definitions

### Task 5: Create `docs/enterprise/glossary/customer.md`

**Files:**
- Create: `docs/enterprise/glossary/customer.md`

**Source data:**
- Skimmer: `docs/DATA_DICTIONARY.md` (Customer table)
- Warehouse: `dbt/models/warehouse/dim_customer.sql`, `dbt/models/semantic/rpt_customer_360.sql`
- Zoho CRM: `../CRMtoSkimmer/crm-to-skimmer-poc/docs/architecture.md` (field mappings)
- QBO: Account, Customer entities from QBO Accounting API
- Semantic layer: `docs/skimmer-semantic-layer.yaml` (active_customer, cancelled_customer, new_customer terms)

**Key decisions:**
- System of Record: **Skimmer** (operational source of truth for active customer relationships)
- QBO Customer entity maps to Skimmer Customer via `QboCustomerId` field
- Zoho Contact maps to Skimmer Customer via email-based matching (CRM sync POC)
- Active filter: `is_inactive=0 AND deleted=0` (Skimmer/Warehouse), `active=true` (QBO)

- [ ] **Step 1: Write customer.md following the entity template**

Fill in all sections: Definition, System of Record, Synonyms, Naming Convention, Identifiers, Key Business Rules, Data Flow, Field Mapping (Skimmer ↔ Zoho ↔ QBO ↔ Warehouse), Related Entities, Change Log.

- [ ] **Step 2: Commit**

```bash
git add docs/enterprise/glossary/customer.md
git commit -m "docs(enterprise): add Customer entity definition"
```

---

### Task 6: Create `docs/enterprise/glossary/contact.md`

**Files:**
- Create: `docs/enterprise/glossary/contact.md`

**Source data:**
- Skimmer: Customer table has FirstName, LastName, Email, Phone fields (no separate Contact entity)
- Zoho CRM: Contact is a distinct entity from Account
- QBO: Customer entity includes contact info (no separate Contact)
- Warehouse: `dim_customer.clean_customer_name` normalizes display name

**Key decisions:**
- Skimmer and QBO embed contact info in the Customer entity
- Zoho CRM treats Contact as separate from Account
- The glossary should clarify this: "Contact" is a logical concept that maps to different physical structures per system

- [ ] **Step 1: Write contact.md following the entity template**

- [ ] **Step 2: Commit**

```bash
git add docs/enterprise/glossary/contact.md
git commit -m "docs(enterprise): add Contact entity definition"
```

---

### Task 7: Create `docs/enterprise/glossary/service-location.md`

**Files:**
- Create: `docs/enterprise/glossary/service-location.md`

**Source data:**
- Skimmer: `docs/DATA_DICTIONARY.md` (ServiceLocation table)
- Warehouse: `dbt/models/warehouse/dim_service_location.sql`
- Zoho CRM: `Other_Address` maps to service location address (from CRM sync POC)
- QBO: No direct equivalent (billing address only)
- Semantic layer: `docs/skimmer-semantic-layer.yaml` (dim_service_location entry)

**Key decisions:**
- System of Record: **Skimmer** (operational address where service happens)
- One customer can have multiple service locations
- Rate and labor_cost are per-location, not per-customer
- QBO has no concept of service location — it only knows billing address

- [ ] **Step 1: Write service-location.md following the entity template**

- [ ] **Step 2: Commit**

```bash
git add docs/enterprise/glossary/service-location.md
git commit -m "docs(enterprise): add Service Location entity definition"
```

---

### Task 8: Create `docs/enterprise/glossary/pool.md`

**Files:**
- Create: `docs/enterprise/glossary/pool.md`

**Source data:**
- Skimmer: `docs/DATA_DICTIONARY.md` (Pool table — "Body of Water")
- Warehouse: `dbt/models/warehouse/dim_pool.sql`
- Zoho CRM: `Pool_Type` field on Contact (from CRM sync POC)
- QBO: No equivalent
- Semantic layer: `docs/skimmer-semantic-layer.yaml` (pool business term, dim_pool entry)

**Key decisions:**
- System of Record: **Skimmer** (only system with pool-level detail)
- Skimmer calls it "Body of Water" in UI, "Pool" in database
- One service location can have multiple pools
- Gallons, filter pressure, pool name are Skimmer-only fields
- Zoho only captures pool type (residential/commercial), not full detail

- [ ] **Step 1: Write pool.md following the entity template**

- [ ] **Step 2: Commit**

```bash
git add docs/enterprise/glossary/pool.md
git commit -m "docs(enterprise): add Pool entity definition"
```

---

## Chunk 3: Standards & References

### Task 9: Create `docs/enterprise/standards/naming-conventions.md`

**Files:**
- Create: `docs/enterprise/standards/naming-conventions.md`

**Context:**
- Cross-system naming rules that apply to all entities
- Covers: customer name formatting, address formatting, identifier conventions, date formats, casing rules
- Derived from actual patterns in each system

**Key conventions to document:**
- Customer names: "FirstName LastName" (individuals), "CompanyName" (organizations)
- Skimmer's `DisplayAsCompany` flag controls which format
- Address casing: inconsistent today (e.g., "williston" vs "Ocala") — document the standard
- Date formats: Skimmer uses ISO timestamps, QBO uses ISO dates, warehouse uses TEXT
- Identifier formats: Skimmer UUIDs, QBO numeric IDs, warehouse composite keys
- Column casing: Skimmer PascalCase → warehouse snake_case

- [ ] **Step 1: Write naming-conventions.md**

- [ ] **Step 2: Commit**

```bash
git add docs/enterprise/standards/naming-conventions.md
git commit -m "docs(enterprise): add cross-system naming conventions"
```

---

### Task 10: Create QBO API reference files

**Files:**
- Create: `docs/enterprise/references/qbo-accounting-api.md`
- Create: `docs/enterprise/references/qbo-payments-api.md`

**Context:**
- Summarized from Firecrawl scrapes of Intuit developer docs
- Organized by entity category with key fields and Splashworks-relevant notes
- These are reference material for future QBO integration work

- [ ] **Step 1: Write qbo-accounting-api.md**

Sections: List Entities, Transaction Entities, Report Entities, Inventory, Key Patterns (soft delete, sparse update, batch operations)

- [ ] **Step 2: Write qbo-payments-api.md**

Sections: Charges, Tokens, BankAccounts, Cards, EChecks, Key Patterns

- [ ] **Step 3: Commit**

```bash
git add docs/enterprise/references/qbo-accounting-api.md docs/enterprise/references/qbo-payments-api.md
git commit -m "docs(enterprise): add QBO API reference summaries"
```
