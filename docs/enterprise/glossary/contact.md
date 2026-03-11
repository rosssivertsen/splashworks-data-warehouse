# Contact

## Definition

An individual person associated with a customer account. For residential customers, the contact is typically the homeowner. For commercial accounts, contacts may include property managers, HOA board members, or on-site staff.

## System of Record

**Primary:** Skimmer (embedded in Customer record)
**Rationale:** Contact information is part of the Customer entity in Skimmer and QBO. Zoho CRM is the only system that treats Contact as a first-class entity separate from Account/Customer.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| Contact | Zoho CRM | Distinct entity — linked to Account but independently managed |
| Customer | Skimmer | Contact fields (name, email, phone) are embedded in the Customer record |
| Customer | QuickBooks Online | Contact fields embedded in Customer entity |
| dim_customer | Data Warehouse | Contact fields flow through as part of the customer dimension |

## Naming Convention

**Standard format:** "FirstName LastName" (e.g., "Jane Doe")

**Rules:**
- Always title case — no ALL CAPS, no all lowercase
- No honorifics in the name field
- For commercial accounts with multiple contacts, the primary contact's name goes in the Customer record; additional contacts go in Notes
- Zoho CRM supports multiple contacts per Account — only the primary syncs to Skimmer

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | CustomerId | UUID | Same as Customer — no separate Contact ID |
| Zoho CRM | Contact.id | Numeric | `4150868000012345` |
| QuickBooks Online | Customer.Id | Numeric | Same as Customer — no separate Contact ID |
| Data Warehouse | customer_id | UUID | Same as Customer |

**Key difference:** Only Zoho CRM has a separate Contact identifier. In all other systems, contact info is embedded in the Customer entity.

## Key Business Rules

- **Skimmer:** One set of contact fields per Customer (FirstName, LastName, PrimaryEmail, MobilePhone, SecondaryEmail, MobilePhone2). No separate Contact entity.
- **Zoho CRM:** Contact is a separate entity from Account. Many-to-one relationship (multiple contacts per account). Only the primary contact syncs to Skimmer.
- **QBO:** Contact info embedded in Customer. Supports PrimaryEmailAddr, PrimaryPhone, and an AlternatePhone.
- **CRM-to-Skimmer sync:** Matches contacts to customers by email address. If no email match, manual linking is required.

## Data Flow

```
Zoho CRM (Contact — separate entity)
    │
    ▼ CRM-to-Skimmer Sync (primary contact only, matched by email)
    │
Skimmer (Customer — contact fields embedded)
    │
    ▼ Nightly Extract
    │
Data Warehouse (dim_customer — contact fields embedded)
```

## Field Mapping

| Canonical Field | Skimmer | Zoho CRM | QBO Advanced | Warehouse | Notes |
|----------------|---------|----------|--------------|-----------|-------|
| First Name | FirstName | First_Name | GivenName | first_name | |
| Last Name | LastName | Last_Name | FamilyName | last_name | |
| Primary Email | PrimaryEmail | Email | PrimaryEmailAddr.Address | — | Used for CRM sync matching |
| Secondary Email | SecondaryEmail | — | — | — | Skimmer-only |
| Primary Phone | MobilePhone | Phone | PrimaryPhone.FreeFormNumber | — | |
| Secondary Phone | MobilePhone2 | — | AlternatePhone.FreeFormNumber | — | |

## Related Entities

- [Customer](customer.md) — Contact is embedded within Customer in Skimmer, QBO, and Warehouse. Separate entity only in Zoho CRM.

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-14 | Initial definition — documenting cross-system contact patterns | Ross Sivertsen |
