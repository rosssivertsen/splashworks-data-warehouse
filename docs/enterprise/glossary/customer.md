---
entity: customer
type: glossary
system_of_record: skimmer
systems: [skimmer, zoho_crm, qbo, warehouse]
warehouse_tables: [dim_customer, rpt_customer_360]
related: [contact, service-location, invoice, payment]
---

# Customer

## Definition

A person or organization that contracts with Splashworks for recurring pool service. Customers are the primary business entity — all service locations, pools, invoices, and payments roll up to a customer.

## System of Record

**Primary:** Skimmer
**Rationale:** Skimmer is the operational platform where customer records are created, maintained, and used daily for scheduling and billing. All other systems sync to/from Skimmer.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| Contact | Zoho CRM | Zoho treats individuals as "Contacts" and organizations as "Accounts" |
| Account | Zoho CRM | Commercial/organizational customers map to Zoho Accounts |
| Customer | QuickBooks Online | QBO uses "Customer" — same concept, different field structure |
| dim_customer | Data Warehouse | Warehouse dimension table for customer entity |
| rpt_customer_360 | Data Warehouse | Denormalized customer profile with service stats, financials, and LTV |

## Naming Convention

**Standard format:**
- **Individuals:** "FirstName LastName" (e.g., "John Smith")
- **Organizations:** "CompanyName" (e.g., "Grand Oaks Manor")

**Rules:**
- Skimmer's `DisplayAsCompany` flag determines which format is used
- Warehouse normalizes this into `clean_customer_name` via: if `display_as_company=1` then CompanyName, else FirstName + " " + LastName
- Title case for all names — no ALL CAPS, no all lowercase
- No honorifics (Mr., Mrs., Dr.) in the name field — use Notes if needed
- Commercial accounts use the legal business name, not abbreviations

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | CustomerId (id) | UUID | `a175f9798206420ea366f66bd8b2dd31` |
| Zoho CRM | Contact.id | Numeric | `4150868000012345` |
| QuickBooks Online | Customer.Id | Numeric | `58` |
| Data Warehouse | customer_id + _company_name | UUID + text | `a175f979...` + `AQPS` |

**Cross-system linkage:**
- Skimmer stores `QboCustomerId` to link to QBO
- CRM-to-Skimmer sync matches on `PrimaryEmail` (email-based dedup)
- Warehouse joins on `customer_id` + `_company_name` (composite key required for multi-tenant isolation)

## Key Business Rules

- **Active customer:** `is_inactive = 0 AND deleted = 0` (BOTH conditions required in Skimmer and Warehouse)
- **Cancelled customer:** `is_inactive = 1 OR deleted = 1` — use `updated_at` as the cancellation date
- **QBO equivalent:** `active = true` for active, `active = false` for inactive (soft delete)
- **Multi-tenancy:** Every customer belongs to exactly one company entity (AQPS or JOMO), identified by `_company_name`
- **Soft delete:** Skimmer uses `Deleted` flag (not hard delete). QBO uses `active` boolean. Neither system permanently removes customer records.
- **Customer code:** Optional `CustomerCode` field in Skimmer for custom reference numbers — not used cross-system

## Data Flow

```
Zoho CRM (Contact)
    │
    ▼ CRM-to-Skimmer Sync (email match, manual review)
    │
Skimmer (Customer) ◄──── QBO Advanced (Customer, via native sync + QboCustomerId)
    │
    ▼ Nightly SQLite Extract (OneDrive → ETL pipeline)
    │
Data Warehouse
    ├── public_staging.stg_customer (raw, all fields)
    ├── public_warehouse.dim_customer (cleaned, typed, clean_customer_name)
    └── public_semantic.rpt_customer_360 (denormalized with service stats, financials, LTV)
```

## Field Mapping

| Canonical Field | Skimmer | Zoho CRM | QBO Advanced | Warehouse | Notes |
|----------------|---------|----------|--------------|-----------|-------|
| First Name | FirstName | First_Name | GivenName | first_name | |
| Last Name | LastName | Last_Name | FamilyName | last_name | |
| Display Name | CompanyName or FirstName+LastName | Full_Name | DisplayName | clean_customer_name | Controlled by DisplayAsCompany flag |
| Company Name | CompanyName | Account_Name | CompanyName | company_name | Commercial accounts only |
| Email | PrimaryEmail | Email | PrimaryEmailAddr.Address | — | Not in warehouse dim |
| Phone | MobilePhone | Phone | PrimaryPhone.FreeFormNumber | — | Not in warehouse dim |
| Billing Address | BillingAddress | Mailing_Street | BillAddr.Line1 | — | Not in warehouse dim |
| Billing City | BillingCity | Mailing_City | BillAddr.City | billing_city | |
| Billing State | BillingState | Mailing_State | BillAddr.CountrySubDivisionCode | billing_state | |
| Billing Zip | BillingZip | Mailing_Zip | BillAddr.PostalCode | billing_zip | |
| Active Status | IsInactive (0=active) | — | Active (true=active) | is_inactive | Inverted logic: Skimmer 0=active, QBO true=active |
| Deleted | Deleted (0=not deleted) | — | — | deleted | Skimmer-only soft delete flag |
| Created Date | CreatedAt | Created_Time | CreateTime | created_at | |
| Updated Date | UpdatedAt | Modified_Time | MetaData.LastUpdatedTime | updated_at | |
| QBO Link | QboCustomerId | — | Id | qbo_customer_id | Links Skimmer ↔ QBO |
| Customer Code | CustomerCode | — | — | — | Skimmer-only optional reference |
| Notes | Notes | Description | Notes | — | Free text, synced in CRM-to-Skimmer |

## Related Entities

- [Service Location](service-location.md) — 1:many (a customer can have multiple service addresses)
- [Contact](contact.md) — logical concept embedded in Customer across most systems
- [Pool](pool.md) — indirect via Service Location (Customer → Service Location → Pool)
- [Invoice](invoice.md) — 1:many (a customer receives invoices for service)
- [Payment](payment.md) — 1:many (a customer makes payments against invoices)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-14 | Initial definition — 4 systems mapped | Ross Sivertsen |
