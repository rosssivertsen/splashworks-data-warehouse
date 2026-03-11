# QuickBooks Online Accounting API — Reference

**Source:** [Intuit Developer Documentation](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account)
**Last Updated:** 2026-03-14
**Purpose:** Reference for future QBO Advanced integration with the Splashworks data warehouse

---

## Entity Categories

### List Entities (Name Lists)
Individuals or accounts referenced in transactions. Soft-deleted via `active = false`.

| Entity | Description | Splashworks Relevance |
|--------|-------------|----------------------|
| **Account** | Financial accounts (bank, expense, income, etc.) | Chart of accounts for P&L reporting |
| **Customer** | Individuals or businesses that pay for goods/services | Maps to Skimmer Customer via QboCustomerId |
| **Vendor** | Suppliers and service providers | Chemical suppliers, subcontractors |
| **Employee** | Company staff | Maps to Skimmer Account/Technician |

### Transaction Entities
Sales forms and financial transactions. Hard-deleted (permanent).

| Entity | Description | Splashworks Relevance |
|--------|-------------|----------------------|
| **Invoice** | Bill sent to customer for services | Core — maps to Skimmer Invoice and warehouse fact_invoice |
| **Payment** | Customer payment received | Core — maps to Skimmer Payment and warehouse fact_payment |
| **Bill** | Vendor bill received | Chemical/supply purchases |
| **BillPayment** | Payment made to vendor | |
| **Estimate** | Quote/proposal sent to customer | Repair/work order quotes |
| **SalesReceipt** | Payment received at time of sale | |
| **CreditMemo** | Credit issued to customer | |
| **RefundReceipt** | Refund processed | |
| **Purchase** | General expense transaction | Operating expenses |
| **PurchaseOrder** | Order placed with vendor | |
| **JournalEntry** | Manual accounting adjustment | Year-end adjustments |
| **TimeActivity** | Time tracking entry | Potential future time tracking integration |
| **VendorCredit** | Credit from vendor | |

### Report Entities
Business analytics reports (read-only).

| Entity | Description | Splashworks Relevance |
|--------|-------------|----------------------|
| **ProfitAndLoss** | Income statement | Compare with warehouse semantic_profit |
| **GeneralLedger** | All transactions by account | Audit trail |
| **CashFlow** | Cash flow statement | Cash position reporting |

### Inventory Entities

| Entity | Description | Splashworks Relevance |
|--------|-------------|----------------------|
| **Item** | Products, services, inventory items, bundles | Chemical products, service line items |

---

## Key API Patterns

### Soft Delete (List Entities)
- Set `active = false` to deactivate (customer, vendor, account, etc.)
- Entity remains in system but hidden from default queries
- Reactivate by setting `active = true`
- **Splashworks parallel:** Skimmer uses `IsInactive = 1` + `Deleted = 1`

### Hard Delete (Transaction Entities)
- Permanently removes invoices, payments, etc.
- Cannot be undone
- Simplified delete: only requires `id` + `syncToken` in request body

### Sparse Updates
- Update only specific fields without affecting others
- Include `sparse="true"` in request body
- Recommended over full updates to prevent data loss

### Batch Operations
- Multiple operations in a single API call
- Use for transactions only (NOT for list entities like customers)
- Reduces network round trips

### Change Data Capture
- Returns entities changed within a timeframe
- Useful for periodic sync (similar to Skimmer nightly extract concept)
- Endpoint: `GET /cdc?entities=Customer,Invoice&changedSince=2026-03-01`

---

## API Reference Links

- [API Explorer (all entities)](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account)
- [Accounting overview](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api)
- [Basic field definitions](https://developer.intuit.com/app/developer/qbo/docs/learn/learn-basic-field-definitions)
- [Query syntax](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/data-queries)
- [OAuth 2.0 setup](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [Webhooks](https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks)
- [Error codes](https://developer.intuit.com/app/developer/qbo/docs/develop/troubleshooting/error-codes)
