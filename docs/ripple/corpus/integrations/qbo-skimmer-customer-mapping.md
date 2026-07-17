# QBO ↔ Skimmer Customer Name Mapping — Integration Patterns

## Overview

QuickBooks Online (QBO) and Skimmer store customer names in fundamentally different formats. Any cross-system operation (invoice migration, rate comparison, customer sync) requires name resolution. This document captures the patterns discovered during the April 2026 invoice migration.

## Name Format Differences

### QBO Name Formats (by frequency)

| Format | Example | Frequency |
|--------|---------|-----------|
| Last, First | `McClure, Shane` | ~80% |
| First Last | `Donna Lee` | ~10% |
| Business Name | `Marion Landing Pool` | ~7% |
| Parent:Child (sub-customer) | `Hired Helpr:Zapata, Lina` | ~3% |

### Skimmer Name Formats

| Format | Example | Notes |
|--------|---------|-------|
| First Last | `Shane McClure` | Most common display format |
| Business Name | `Marion Landings HOA` | May differ from QBO spelling |
| Combined | `Butch & Laurie May` | Ampersand format common |

## Resolution Strategies

### Strategy 1: Last Name Search (Primary)

Search Skimmer's dropdown by last name only. Works for ~85% of customers.

```
QBO: "McClure, Shane" → search: "McClure" → matches: "Shane McClure"
QBO: "Reece, Colleen" → search: "Reece" → matches: "Colleen Reece"
```

**Why last name only?** Skimmer's dropdown displays names with double-spaces in some cases (`Janet  Oehlerking`), causing full-name searches to fail.

### Strategy 2: Sub-Customer Extraction

QBO sub-customers use `Parent:Child` format. Strip the parent, use the child's last name.

```
QBO: "Hired Helpr:Zapata, Lina" → search: "Zapata" → matches: "Lina Zapata"
QBO: "Adena JC Holdings:One Story House" → search: "Adena" → matches: "Adena Golf and Country Club"
```

### Strategy 3: Business Name Keywords

For business names, use a distinctive keyword rather than the full name.

```
QBO: "Marion Landing Pool" → search: "Marion" → matches: "Marion Landings HOA"
QBO: "Grand Oaks Manor Property Owners Assoc I" → search: "Grand Oaks" → matches abbreviated version
```

### Strategy 4: Fuzzy Token Matching (Fallback)

For names with spelling differences, use token-weighted fuzzy matching with last-name bonus.

| QBO Name | Skimmer Name | Resolution |
|----------|-------------|------------|
| Shaprio, Kim | Shapiro, Kim | Spelling correction |
| Strausser, Melissa | Strawser, Melissa | Spelling variation |
| Vargas, Zuly | Vargis, Zuly | Spelling variation |

## Expected Match Verification

Always verify dropdown selection using an `expectedMatch` keyword array:

```javascript
// After searching "McClure", verify the selected option contains "Shane"
expectedMatch: ["Shane McClure"]

// After searching "Adena", verify it matches the right sub-location
expectedMatch: ["Adena Golf and Country Club", "One Story House", "Two Story"]
```

## Known Problematic Patterns

| Pattern | Issue | Resolution |
|---------|-------|------------|
| Multiple customers with same last name | Wrong customer selected | Use more specific search (first + last) |
| Business names with "LLC", "HOA", "Inc" | May or may not appear in Skimmer | Search without suffix |
| "&" in names | QBO uses "and", Skimmer uses "&" | Search by one spouse's name |
| Inactive customers in QBO | May still be active in Skimmer billing | Check Skimmer status independently |

## API vs UI Customer Populations

**Critical discovery:** Skimmer's API and web UI maintain different customer populations in sandbox environments:
- API `GET /Customers`: returns 1,725 records
- UI customer list: shows 884 records
- API-created customers have `isLead: true` and do NOT appear in the billing dropdown
- Only UI-created customers are billing-eligible

This affects any workflow that creates customers via API and expects them to be immediately available for invoice creation.

## Cross-Reference Fields

| System | Customer ID Field | Format |
|--------|-------------------|--------|
| QBO | Customer.Id | Numeric |
| Skimmer API | Customer.id | UUID |
| Skimmer DB | Customer.QboCustomerId | Nullable (link field) |
| Data Warehouse | customer_id + _company_name | UUID + text |
