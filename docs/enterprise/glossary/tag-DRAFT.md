# Tag

> **Status:** DRAFT — pending review before release

## Definition

A label applied to a customer for segmentation, filtering, and reporting. Tags are the primary classification mechanism in Skimmer — they enable grouping customers by business category (e.g., "Commercial", "Residential"), operational status (e.g., "VIP", "Problem Account"), or organizational unit (e.g., "Russell's"). Tags are many-to-many: a customer can have multiple tags, and a tag applies to many customers.

## System of Record

**Primary:** Skimmer
**Rationale:** Tags are created and managed in Skimmer by admin users. They are applied to customers through the Skimmer web interface. No other system currently manages customer segmentation tags, though a future CRM sync could bridge Zoho CRM segments to Skimmer tags.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| Tag | Skimmer | Database entity — the label definition |
| CustomerTag | Skimmer | Junction table — the association between a customer and a tag |
| Label | General | Informal synonym used in conversation |
| Segment | Zoho CRM | Zoho's segmentation concept — not currently synced |
| stg_tag | Data Warehouse | Staging model for tag definitions |
| stg_customer_tag | Data Warehouse | Staging model for tag assignments |
| customer_tags | Data Warehouse | Semantic model joining customers to their tags |

## Naming Convention

**Standard format:** Short, descriptive label in title case

**Rules:**
- Tag names should be concise and self-explanatory (e.g., "Commercial", "Residential", "VIP")
- Tags are company-configurable — AQPS and JOMO can have different tag sets
- Avoid duplicate or overlapping tags (e.g., don't have both "Commercial" and "Commercial Account")

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer (Tag) | Tag.id | UUID | `t1a2b3c4d5e6...` |
| Skimmer (CustomerTag) | CustomerTag.id | UUID | `ct1a2b3c4d5e6...` |
| Data Warehouse | tag_id + _company_name | UUID + text | `t1a2b3c4...` + `AQPS` |

## Key Business Rules

- **Many-to-many:** A customer can have multiple tags. A tag can be applied to many customers.
- **Company-scoped:** Tags are defined per company. AQPS tags are independent from JOMO tags.
- **Soft delete:** Both `Tag` and `CustomerTag` have a `Deleted` flag. Warehouse stages filter `deleted = 0`.
- **Russell's segmentation:** The warehouse `customer_tags` semantic model derives a `clean_tag_name` that groups customers by operating brand. If any of a customer's tags contain "Russells", they are classified as "Russell's"; otherwise "A Quality Pool Service". This is specific to AQPS's multi-brand operation.
- **No hierarchy:** Tags are flat — there is no parent-child or category system. All grouping logic lives in queries and semantic models.
- **Customer.Tags JSON:** Skimmer denormalizes tags into a JSON array on the Customer record for search performance. The normalized `CustomerTag` junction table is the authoritative source.

## Data Flow

```
Skimmer (Admin creates Tag, applies to Customer via CustomerTag)
    │
    ├── Customer.Tags JSON updated (denormalized for search)
    │
    └── Nightly SQLite Extract
        └── Data Warehouse
            ├── public_staging.stg_tag (tag definitions)
            ├── public_staging.stg_customer_tag (customer ↔ tag assignments)
            └── public_semantic.customer_tags (joined: customer + tag + clean_tag_name)
```

## Field Mapping

| Canonical Field | Skimmer (Tag) | Skimmer (CustomerTag) | Warehouse | Notes |
|----------------|--------------|----------------------|-----------|-------|
| Tag ID | id | — | tag_id | UUID primary key |
| Tag Name | Name | — | name | Display label |
| Customer Tag ID | — | id | customer_tag_id | Junction record ID |
| Customer | — | CustomerId | customer_id | FK to Customer |
| Tag Reference | — | TagId | tag_id | FK to Tag |
| Deleted | Deleted | Deleted | deleted | Soft delete, filtered in staging |
| Company | CompanyId | CompanyId | _company_name | AQPS or JOMO |

## Related Entities

- [Customer](customer.md) — many:many (via CustomerTag junction table)
- [Company](company-DRAFT.md) — many:1 (tags are company-scoped)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — Tag + CustomerTag schema, Russell's segmentation logic, warehouse models | Claude / Ross Sivertsen |
