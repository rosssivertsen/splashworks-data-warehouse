# Data Quality Rules

**Version:** 1.0-DRAFT
**Last Updated:** 2026-04-13

Cross-system data quality expectations for Splashworks. These rules define required fields, valid value ranges, known quality issues, and validation logic applied during ETL and warehouse modeling.

---

## General Principles

1. **Source system is authoritative.** The warehouse inherits data as-is from Skimmer. Transformations clean and type-cast but do not fabricate missing data.
2. **Soft deletes are real.** Records with `Deleted = 1` or `IsInactive = 1` are excluded from active reporting but preserved for historical analysis.
3. **Multi-tenancy is a data quality gate.** Any query or model missing the `_company_name` discriminator is a data quality violation — it risks cross-company contamination.
4. **TEXT dates require string comparisons.** Fact table date columns are stored as TEXT. Using `DATE_TRUNC()`, `CURRENT_DATE`, or `INTERVAL` on them will produce silent wrong results — this is the most common warehouse query error.

---

## Required Fields by Entity

### Customer

| Field | Required | Validation | Known Issues |
|-------|----------|-----------|--------------|
| CustomerId | Yes | UUID, non-null | — |
| CompanyId | Yes | Must match AQPS or JOMO UUID | — |
| FirstName OR CompanyName | Yes (one of) | Non-empty when applicable | Some records have both blank — `clean_customer_name` falls back to empty string |
| DisplayAsCompany | Yes | 0 or 1 | — |
| IsInactive | Yes | 0 or 1 | — |
| Deleted | Yes | 0 or 1 | — |

### Service Location

| Field | Required | Validation | Known Issues |
|-------|----------|-----------|--------------|
| ServiceLocationId | Yes | UUID, non-null | — |
| CustomerId | Yes | FK → Customer | — |
| Address | Yes | Non-empty | Some records have inconsistent casing ("williston" vs "Williston") |
| City | Yes | Non-empty | Same casing inconsistency |
| State | Yes | Two-letter abbreviation | Some records use full state name — `_to_state_abbrev()` handles conversion in CRM sync |
| Rate | Expected | Numeric ≥ 0 | Some locations have Rate = 0 or NULL — these are typically inactive or commercial with custom billing |
| LaborCost | Expected | Numeric ≥ 0 | Missing labor costs make profitability calculations impossible for that location |

### Pool

| Field | Required | Validation | Known Issues |
|-------|----------|-----------|--------------|
| PoolId | Yes | UUID, non-null | — |
| ServiceLocationId | Yes | FK → ServiceLocation | — |
| PoolName | Expected | Non-empty | Some records have generic names like "Pool" — acceptable for single-pool locations |
| Gallons | Expected | Integer > 0 | Missing gallons prevents accurate chemical dosage calculations |

### Technician (Account)

| Field | Required | Validation | Known Issues |
|-------|----------|-----------|--------------|
| AccountId | Yes | UUID, non-null | — |
| FirstName | Yes | Non-empty | — |
| LastName | Yes | Non-empty | — |
| RoleType | Yes | Non-empty | Values not consistently standardized across companies |
| IsActive | Yes | Boolean | — |

### Invoice

| Field | Required | Validation | Known Issues |
|-------|----------|-----------|--------------|
| InvoiceId | Yes | UUID, non-null | — |
| CustomerId | Yes | FK → Customer | — |
| InvoiceNumber | Yes | Integer, unique per company | — |
| Total | Yes | Numeric | — |
| Status | Yes | One of: Draft, Sent, Paid, Void | — |
| PaymentStatus | Yes | One of: Unpaid, Partial, Paid | — |

### Service Stop (RouteStop)

| Field | Required | Validation | Known Issues |
|-------|----------|-----------|--------------|
| RouteStopId | Yes | UUID, non-null | — |
| AccountId | Yes | FK → Account | — |
| ServiceLocationId | Yes | FK → ServiceLocation | — |
| ServiceDate | Yes | ISO 8601 text | — |
| CompleteTime | Conditional | Sentinel `2010-01-01 12:00:00` = NOT completed | The sentinel value is a Skimmer design choice, not a bug — warehouse derives `service_status` from it |

### Chemical Reading (ServiceStopEntry)

| Field | Required | Validation | Known Issues |
|-------|----------|-----------|--------------|
| ServiceStopId | Yes | FK → ServiceStop | — |
| EntryDescriptionId | Yes | FK → EntryDescription | — |
| Value | Expected | Numeric | Some entries have Value = 0 — may be legitimate (e.g., 0 ppm chlorine) or a data entry skip |
| EntryType | Yes | One of: Reading, Dosage, Observation | — |

---

## Valid Value Ranges

| Metric | Field Path | Valid Range | Red Flag Range | Notes |
|--------|-----------|------------|----------------|-------|
| pH | ServiceStopEntry.Value (pH) | 6.8–8.2 | < 6.5 or > 8.5 | Extreme values may indicate meter malfunction |
| Free Chlorine | ServiceStopEntry.Value (Free Cl) | 0.5–10 ppm | > 15 ppm | Very high may be post-shock reading |
| CYA | ServiceStopEntry.Value (CYA) | 0–150 ppm | > 200 ppm | Test kit max is typically 100–150 |
| Alkalinity | ServiceStopEntry.Value (Alk) | 40–200 ppm | > 300 ppm | — |
| Filter Pressure | ServiceStopEntry.Value (PSI) | 5–35 PSI | > 40 PSI or 0 | 0 may mean pump off or entry error |
| Pool Gallons | Pool.Gallons | 1,000–100,000 | > 200,000 | Commercial pools can be large but > 200K is unusual |
| Service Rate | ServiceLocation.Rate | 0–2,000 | > 3,000 | $0 is valid (inactive/custom billing) |
| Labor Cost | ServiceLocation.LaborCost | 0–500 | > 500 | Per-stop labor costs above $500 are unusual |
| Minutes at Stop | RouteStop.MinutesAtStop | 5–180 | > 240 | Stops over 4 hours may indicate timer left running |
| Invoice Total | Invoice.Total | 0–50,000 | > 50,000 | Large invoices typically for commercial or equipment installs |

---

## Known Data Quality Issues

### Address Casing Inconsistency
**Scope:** ServiceLocation addresses in Skimmer
**Issue:** Some addresses have inconsistent casing (e.g., "williston" instead of "Williston", "OCALA" instead of "Ocala")
**Impact:** Affects address-based grouping and display
**Mitigation:** None currently. Warehouse inherits as-is. Future: address standardization step in ETL.
**Tracking:** Known since March 2026, no fix planned.

### Missing Labor Costs
**Scope:** Some ServiceLocation records have LaborCost = 0 or NULL
**Issue:** Profitability calculations (`semantic_profit`) produce inflated margins for these locations
**Impact:** Profitability reports overstate profit for affected locations
**Mitigation:** `semantic_profit` model includes these locations — consumers should be aware that $0 labor cost may mean "not configured" rather than "free labor."

### Sentinel Timestamps
**Scope:** RouteStop.CompleteTime, WorkOrder.CompleteTime
**Issue:** Skimmer uses `2010-01-01 12:00:00` as a sentinel for "not completed" instead of NULL
**Impact:** Naive date filters (e.g., "completed before 2024") will include incomplete records
**Mitigation:** Warehouse `fact_service_stop` derives `service_status` from the sentinel value. Always filter on `service_status = 1` for completed stops.

### Denormalized JSON Fields
**Scope:** Customer.Tags, Customer.ServiceLocations, ServiceLocation.Pools, etc.
**Issue:** Skimmer denormalizes related records into JSON arrays for search performance. These may be stale if the extract runs during a write window.
**Impact:** JSON fields may lag behind normalized tables by up to 24 hours
**Mitigation:** Always use normalized tables (CustomerTag, ServiceLocation, Pool) for analytics. JSON fields are for reference only.

---

## ETL Validation Checks

The nightly ETL pipeline (`etl/scripts/nightly-pipeline.sh`) runs the following quality checks:

| Check | Table | Rule | Action on Failure |
|-------|-------|------|-------------------|
| Row count | All | Row count > 0 | Pipeline fails, alert sent |
| Checksum (schema-aware, since 2026-04-20) | All | Skip re-load if row count **AND** schema fingerprint both match prior extract. Schema fingerprint is a SHA-256 of (column_name, column_type, ordinal) tuples from the SQLite source. | Log and skip (optimization, not error). A change in either component forces a rebuild. |
| Schema governance — CTRL-01 | Governed tables (`docs/data-governance/contracts/<source>/_index.yml`) | Source schema fingerprint must match the current canonical contract version. | Pipeline fails atomically (fail-fast, no loads). Drift event recorded in `public.etl_schema_drift`. Slack `#alerts`. See `docs/data-governance/controls/CTRL-01-schema-validation.md`. |
| Company count | All | Exactly 2 companies (AQPS, JOMO) | Pipeline fails |
| Reconciliation — CTRL-03 | See control doc | 6 raw↔warehouse row/amount checks | `data/reconciliation.json` flags discrepancies. See `docs/data-governance/controls/CTRL-03-reconciliation.md`. |

### Recommended Future Checks

| Check | Table | Rule | Priority |
|-------|-------|------|----------|
| Orphan detection | ServiceLocation | All CustomerId values exist in Customer | Medium |
| Rate sanity | ServiceLocation | Rate > 0 for active locations | Low |
| Gallons sanity | Pool | Gallons > 0 for active pools | Low |
| Date range | RouteStop | ServiceDate within trailing 6-month window | Medium |
| Duplicate detection | Customer | No duplicate PrimaryEmail per company | Low |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — required fields, valid ranges, known issues, ETL checks | Claude / Ross Sivertsen |
