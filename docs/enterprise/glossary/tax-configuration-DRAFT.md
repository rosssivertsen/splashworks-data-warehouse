# Tax Configuration

> **Status:** DRAFT — pending review before release

## Definition

The jurisdiction-based tax rules that determine how sales tax is calculated on invoices. Tax configuration in Skimmer uses a three-table structure: `TaxGroup` (a named collection of rates applied to a location), `TaxRate` (an individual tax rate like "Florida State Sales Tax at 6%"), and `TaxGroupRate` (the junction linking rates to groups). Tax is applied at the invoice-location level, not per line item.

## System of Record

**Primary:** Skimmer (operational), QuickBooks Online Advanced (financial/compliance)
**Rationale:** Skimmer manages the tax configuration used during invoice generation. QBO has its own tax engine (Automated Sales Tax or manual tax codes) which must stay in sync with Skimmer for the QBO sync to produce correct financial records. Skimmer is authoritative for service billing; QBO is authoritative for tax filing and compliance.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| TaxGroup | Skimmer | Named group of tax rates (e.g., "Volusia County") |
| TaxRate | Skimmer | Individual tax rate (e.g., "FL State Sales Tax 6%") |
| TaxGroupRate | Skimmer | Junction table linking rates to groups |
| Tax Code | QuickBooks Online | QBO's tax classification system |
| Automated Sales Tax | QuickBooks Online | QBO's location-aware tax calculation engine |
| — | Data Warehouse | Not yet modeled (DX-4 on backlog) |
| — | Zoho CRM | No equivalent |

## Naming Convention

**Standard format:** Tax groups named by jurisdiction; tax rates named by authority + percentage.

**Rules:**
- Tax group names should clearly identify the jurisdiction: "Volusia County", "Orange County", "Tax Exempt"
- Tax rate names should include the taxing authority and rate: "FL State Sales Tax 6%", "Volusia County 0.5%"
- A "Tax Exempt" group with no rates handles non-taxable service locations

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer (TaxGroup) | TaxGroup.id | UUID | `tg1a2b3c4...` |
| Skimmer (TaxRate) | TaxRate.id | UUID | `tr1a2b3c4...` |
| Skimmer (TaxGroupRate) | TaxGroupRate.id | UUID | `tgr1a2b3c4...` |
| Data Warehouse | — | — | Not yet modeled |

## Key Business Rules

- **Tax is per-location, not per-customer:** Tax groups are assigned via `InvoiceLocation.TaxGroupId`. A customer with service locations in different counties can have different tax rates on the same invoice.
- **Compound rates:** A tax group can contain multiple rates. Example: "Volusia County" group = FL State 6% + Volusia County 0.5% = 6.5% total.
- **Active/inactive:** Both `TaxGroup.IsActive` and `TaxRate.IsActive` support deactivation without deletion — needed when rates change (old rate stays for historical invoices, new rate activates).
- **Line item taxability:** Each `InvoiceItem.IsTaxable` flag determines whether the item is subject to the location's tax group. Service is typically taxable; some parts may be exempt.
- **Invoice-level tax:** `Invoice.TaxAmount` is the computed total tax. Individual line item tax is derived from the item amount × applicable rates.
- **QBO sync consideration:** Skimmer's tax configuration must match QBO's tax codes for the sync to produce correct financial records. Mismatches cause reconciliation issues.
- **Company-scoped:** Tax groups and rates are per-company. AQPS and JOMO may operate in different jurisdictions with different tax obligations.

## Data Flow

```
Skimmer (Admin configures TaxGroup + TaxRate per jurisdiction)
    │
    ├── InvoiceLocation links to TaxGroup
    │   └── Each InvoiceItem checked for IsTaxable
    │       └── TaxAmount calculated: Σ(taxable line items × group rates)
    │
    ├── Invoice.TaxAmount reflects total
    │
    ├── Skimmer native sync → QBO
    │   └── QBO Invoice includes tax per its own tax code mapping
    │
    └── Nightly SQLite Extract
        └── Data Warehouse (not yet modeled — DX-4 backlog)
```

## Field Mapping

| Canonical Field | Skimmer (TaxGroup) | Skimmer (TaxRate) | QBO | Warehouse | Notes |
|----------------|-------------------|-------------------|-----|-----------|-------|
| Group ID | id | — | — | — | UUID |
| Group Name | Name | — | TaxCode.Name | — | Jurisdiction label |
| Group Active | IsActive | — | — | — | Boolean |
| Rate ID | — | id | — | — | UUID |
| Rate Name | — | Name | — | — | Authority + percentage |
| Rate | — | Rate | TaxRate.RateValue | — | Decimal percentage |
| Rate Active | — | IsActive | — | — | Boolean |
| Company | CompanyId | CompanyId | — | — | AQPS or JOMO |

## Related Entities

- [Invoice](invoice.md) — via InvoiceLocation (tax group determines tax calculation on each invoice section)
- [Service Location](service-location.md) — via InvoiceLocation (tax is jurisdiction-based, tied to where service is performed)
- [Company](company-DRAFT.md) — many:1 (tax configuration is per-company)
- [Product](product.md) — via InvoiceItem.IsTaxable (determines whether a product sale is taxed)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — TaxGroup + TaxRate + TaxGroupRate structure, per-location application, QBO sync notes | Claude / Ross Sivertsen |
