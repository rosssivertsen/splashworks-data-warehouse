# Enterprise Data Glossary — Design Spec

**Date:** 2026-03-14
**Status:** Approved
**Effort:** M (half day initial scaffold + ongoing)

## Goal

Create a cross-system enterprise data glossary for Splashworks that serves as the canonical reference for entity definitions, naming conventions, system-of-record designations, and data flows across all applications. Must be presentable to senior leadership, derivable into SOPs, and usable by developers onboarding to the data warehouse.

## Systems in Scope

| System | Role | Integration Status |
|--------|------|-------------------|
| Skimmer | Service operations (scheduling, routing, service stops) | Active — nightly extract to warehouse |
| Zoho CRM | Sales & leads, customer intake | POC — CRM-to-Skimmer sync |
| QuickBooks Online Advanced | Invoicing, payments, accounting | Active — native sync with Skimmer |
| Data Warehouse (Postgres) | Analytics hub — staging → warehouse → semantic | Active — all systems converge here |

## Entity Scope (v1)

Customer-centric entities only:
1. **Customer** — person or org contracting for pool service
2. **Contact** — individual person (may differ from customer for commercial accounts)
3. **Service Location** — physical property/address where service is performed
4. **Pool** — body of water / service unit at a location

## Directory Structure

```
docs/enterprise/
├── CLAUDE.md                    # Context for Claude when working in this directory
├── README.md                    # Overview, purpose, how to use the glossary
├── system-landscape.md          # Versioned Mermaid diagram — systems + data flows
├── glossary/
│   ├── customer.md              # Customer entity definition
│   ├── contact.md               # Contact/person definition
│   ├── service-location.md      # Physical property/address
│   └── pool.md                  # Body of water / service unit
├── standards/
│   └── naming-conventions.md    # Cross-system naming rules
└── references/
    ├── qbo-accounting-api.md    # QBO Accounting API entity reference
    └── qbo-payments-api.md      # QBO Payments API entity reference
```

## Entity Template

Each file in `glossary/` follows this standard structure:

```markdown
# [Entity Name]

## Definition
[1-2 sentence plain-English definition]

## System of Record
**Primary:** [System name]
**Rationale:** [Why this system owns the data]

## Synonyms
| Term | System | Context |
|------|--------|---------|

## Naming Convention
**Standard format:** [How this entity should be named/displayed]
**Rules:**
- [Formatting rules]

## Identifiers
| System | Field | Format | Example |
|--------|-------|--------|---------|

## Key Business Rules
- [Active/inactive logic, validation, required fields]

## Data Flow
[Mermaid or text showing how entity moves between systems]

## Field Mapping
| Canonical Field | Skimmer | Zoho CRM | QBO | Warehouse | Notes |
|----------------|---------|----------|-----|-----------|-------|

## Related Entities
- [Links to other glossary entries]

## Change Log
| Date | Change | Author |
|------|--------|--------|
```

## System Landscape Diagram

Versioned Mermaid flowchart in `system-landscape.md`:
- Shows all four systems + integration points
- Versioned with date (e.g., "Current State: v1.0 — March 2026")
- Change log at bottom tracks architectural changes
- Data flow direction: Zoho → Skimmer ← QBO → Warehouse → BI tools

## QBO API References

Saved for future integration development:

**QBO Accounting API entities:** Account, Customer, Vendor, Employee, Invoice, Bill, Payment, BillPayment, Refund, Item, JournalEntry, Estimate, PurchaseOrder, SalesReceipt, CreditMemo, TimeActivity, VendorCredit, ProfitAndLoss, GeneralLedger, CashFlow

**QBO Payments API entities:** Charges, Tokens, BankAccounts, Cards, EChecks

**Key pattern:** QBO uses `active=false` for soft-delete (list entities) and hard delete for transactions — analogous to Skimmer's `IsInactive + Deleted` flags.

## CLAUDE.md Strategy

- **Root CLAUDE.md:** 3-line pointer to `docs/enterprise/`
- **`docs/enterprise/CLAUDE.md`:** Full context for glossary work (systems, template, naming standards)
- Context isolation: warehouse dev loads root CLAUDE.md only; glossary work loads both

## Distribution

- Markdown files render natively in GitHub and SharePoint
- One-file-per-entity enables direct linking from SOPs
- `system-landscape.md` serves as standalone leadership presentation artifact

## Out of Scope

- MDM tooling (the glossary IS the standard; dbt enforces it)
- Non-customer entities (technician, invoice, payment — future iterations)
- Automated cross-system validation or sync tooling
- Formal UML/ArchiMate diagrams (Mermaid is sufficient at current scale)
