---
type: standard
scope: cross-system
applies_to: [skimmer, zoho_crm, qbo, warehouse]
---

# Naming Conventions

**Version:** 1.0
**Last Updated:** 2026-03-14

Cross-system naming and formatting standards for Splashworks data. These conventions apply to all systems (Skimmer, Zoho CRM, QBO Advanced, Data Warehouse) and should be followed when creating or updating records.

---

## Customer Names

### Individuals
**Format:** `FirstName LastName`
- Title case (e.g., "John Smith", not "john smith" or "JOHN SMITH")
- No honorifics (Mr., Mrs., Dr.) in the name field
- No suffixes in the name field (Jr., Sr., III) — append to LastName if essential
- Hyphenated last names preserved (e.g., "Maria Garcia-Lopez")

### Organizations / Commercial Accounts
**Format:** Legal business name
- Title case (e.g., "Grand Oaks Manor", not "GRAND OAKS MANOR")
- Use the legal entity name, not abbreviations (e.g., "Golfview Condominium Association", not "Golfview Condo")
- Include entity type if part of the legal name (Inc., LLC, HOA)
- Skimmer's `DisplayAsCompany` flag must be set to `1` for commercial accounts

### Display Name Resolution
The warehouse uses `clean_customer_name` which applies this logic:
```
IF display_as_company = 1 THEN CompanyName
ELSE FirstName || ' ' || LastName
```

---

## Addresses

### Street Address
- Title case (e.g., "123 Oak View Dr", not "123 oak view dr")
- Standard USPS abbreviations: St, Ave, Blvd, Dr, Ln, Ct, Pl, Way, Cir
- Include unit/suite if applicable: "456 Palm Ave, Unit 12"
- No periods in abbreviations (St not St.)

### City
- Title case (e.g., "Ponte Vedra Beach", "Jacksonville")
- Full city name — no abbreviations (e.g., "Jacksonville", not "Jax")

### State
- Two-letter USPS abbreviation, uppercase (e.g., "FL", not "Florida" or "fl")

### ZIP Code
- Five-digit format (e.g., "32256")
- ZIP+4 if available (e.g., "32256-1234") but not required

### Known Issues
- Some existing Skimmer records have inconsistent casing (e.g., "williston" instead of "Williston")
- Address standardization is not enforced by any system — manual correction required
- The warehouse inherits whatever casing Skimmer provides

---

## Dates and Timestamps

| System | Format | Example | Notes |
|--------|--------|---------|-------|
| Skimmer | ISO 8601 with timezone | `2026-03-14 13:45:22.9164+00:00` | Stored as TEXT in SQLite |
| Zoho CRM | ISO 8601 | `2026-03-14T13:45:22-04:00` | |
| QBO Advanced | ISO 8601 | `2026-03-14T13:45:22-07:00` | |
| Warehouse (facts) | TEXT (ISO date) | `2026-03-14 13:45:22` | String comparisons, NOT date functions |
| Warehouse (dim_date) | DATE | `2026-03-14` | Only dim_date uses real DATE type |

**Critical rule:** Fact table date columns (`service_date`, `payment_date`, `invoice_date`) are stored as TEXT in the warehouse. Use string comparisons with ISO date literals. Do NOT use `DATE_TRUNC()`, `CURRENT_DATE`, `INTERVAL`, or any date/time functions on these columns.

---

## Identifiers

### Skimmer
- **Format:** UUID (32 hex characters, no hyphens)
- **Example:** `a175f9798206420ea366f66bd8b2dd31`
- **Column name:** PascalCase `{Entity}Id` (e.g., `CustomerId`, `ServiceLocationId`)

### Zoho CRM
- **Format:** Numeric (large integer)
- **Example:** `4150868000012345`
- **Column name:** Mixed_Case `{Entity}.id`

### QuickBooks Online
- **Format:** Numeric (integer)
- **Example:** `58`
- **Column name:** PascalCase `Id` (within entity context)

### Data Warehouse
- **Format:** Composite key — UUID + company discriminator
- **Example:** `a175f979...` + `AQPS`
- **Column name:** snake_case `{entity}_id` + `_company_name`
- **Critical:** ALL joins in the warehouse must include both the entity ID AND `_company_name` to prevent cross-company matching

---

## Column Casing by System

| System | Convention | Example |
|--------|-----------|---------|
| Skimmer (SQLite) | PascalCase | `FirstName`, `ServiceLocationId`, `IsInactive` |
| Zoho CRM | Mixed_Case with underscores | `First_Name`, `Last_Name`, `Email` |
| QBO Advanced | PascalCase | `GivenName`, `FamilyName`, `DisplayName` |
| Data Warehouse (staging) | snake_case | `first_name`, `service_location_id`, `is_inactive` |
| Data Warehouse (warehouse) | snake_case | `customer_id`, `clean_customer_name` |

**Transformation:** Skimmer PascalCase → warehouse snake_case happens in the dbt staging layer (`stg_*` models).

---

## Boolean / Status Fields

| Concept | Skimmer | QBO | Warehouse | Notes |
|---------|---------|-----|-----------|-------|
| Active | IsInactive = 0 | Active = true | is_inactive = 0 | Inverted logic between systems |
| Deleted | Deleted = 0 | — | deleted = 0 | Skimmer-only soft delete |
| Service Completed | service_status = 1 | — | service_status = 1 | Derived from sentinel timestamp |

**Watch out:** Skimmer uses "IsInactive" (double negative — `IsInactive = 0` means active), while QBO uses "Active" (positive — `Active = true` means active). The warehouse preserves Skimmer's convention.

---

## Company Entities

| Short Name | Full Name | Skimmer CompanyId | Warehouse _company_name |
|------------|-----------|-------------------|------------------------|
| AQPS | A Quality Pool Service of Central Florida, Inc. | `e265c9dee47c47c6a73f689b0df467ca` | `AQPS` |
| JOMO | Jomo Pool Service | `95d37a64d1794a1caef111e801db5477` | `JOMO` |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-14 | Initial naming conventions — customer names, addresses, dates, identifiers, casing | Ross Sivertsen |
