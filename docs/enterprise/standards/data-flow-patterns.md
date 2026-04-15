# Data Flow Patterns

**Version:** 1.0-DRAFT
**Last Updated:** 2026-04-13

Operational details for each data integration between Splashworks systems. Covers sync frequency, failure modes, recovery procedures, and reconciliation expectations. Complements `system-landscape.md` (which shows the high-level architecture) with the operational runbook detail.

---

## Integration Summary

| # | Integration | Direction | Frequency | Method | Owner |
|---|-------------|-----------|-----------|--------|-------|
| 1 | Skimmer → Data Warehouse | One-way | Nightly | SQLite extract → Python ETL → dbt | Automated (cron) |
| 2 | Skimmer ↔ QBO Advanced | Bi-directional | Real-time | Native Skimmer integration | Skimmer (managed) |
| 3 | Zoho CRM → Skimmer | One-way | On-demand | REST API (POC scripts) | Manual |

---

## 1. Skimmer → Data Warehouse (Nightly Extract Pipeline)

### Overview
Skimmer produces a nightly SQLite database extract per company, delivered to OneDrive. The ETL pipeline syncs these to the VPS, loads them into Postgres, and runs dbt transformations.

### Schedule
- **Skimmer extract:** Generated nightly by Skimmer (exact time varies, typically 11 PM–1 AM ET)
- **ETL cron:** `1:15 AM UTC` (9:15 PM ET) via `nightly-pipeline.sh`
- **Data window:** Trailing ~6 months from extract date (older data is dropped each night)

### Pipeline Steps

```
1. rclone sync (OneDrive → VPS /opt/splashworks/data/)
   └── Syncs AQPS.db and JOMO.db (~76 MB total)

2. Python ETL (etl/load_extract.py)
   ├── Computes SHA-256 checksum per table per company
   ├── Skips tables with unchanged checksums (optimization)
   ├── Loads changed tables into public_raw schema
   └── Records load timestamp and row counts

3. dbt run
   ├── Staging models (stg_*) — type-cast, rename, filter deleted
   ├── Warehouse models (dim_*, fact_*) — joins, business logic
   └── Semantic models (rpt_*, semantic_*) — denormalized reports

4. Health check
   └── Validates row counts, schema existence, key metrics
```

### Failure Modes

| Failure | Symptom | Recovery |
|---------|---------|----------|
| OneDrive sync failure | rclone returns non-zero; stale .db files | Re-run `rclone sync` manually. Check OneDrive auth token. |
| Skimmer extract delayed | .db file timestamp older than expected | Wait and re-run. Skimmer support if persistent. |
| ETL load error | Python traceback in pipeline log | Check `/opt/splashworks/logs/pipeline.log`. Fix schema drift if new columns appeared. |
| dbt model failure | dbt returns non-zero; specific model named | Run `dbt run --select <model>` to isolate. Check upstream staging model. |
| Postgres disk full | ETL fails mid-load, partial data | Clear old Docker logs/images. Expand VPS disk if recurring. |

### Reconciliation
- **Row counts:** Health check compares current vs. prior load. >10% drop in any major table triggers an alert.
- **Data freshness:** Check `MAX(service_date)` in `fact_service_stop` — should be within 48 hours of current date.
- **Checksum log:** ETL records which tables were updated vs. skipped. If all tables show "skipped" for multiple days, the Skimmer extract may not be refreshing.

### Data Characteristics
- **Overwrite, not append:** Each nightly extract is a full replacement of the trailing 6-month window. There is no incremental/CDC feed.
- **No hard deletes visible:** If a record was hard-deleted in Skimmer before the extract, it simply won't appear. Only soft-deleted records (Deleted=1) are visible.
- **Historical data loss:** Data older than ~6 months is lost on each extract. The warehouse snapshots (dbt SCD2 on customer, tech) capture slowly-changing dimensions, but fact-level history beyond the window is not available.

---

## 2. Skimmer ↔ QBO Advanced (Native Sync)

### Overview
Skimmer has a built-in bi-directional sync with QuickBooks Online. This is a managed integration — Splashworks does not control the sync code or infrastructure.

### Sync Behavior

| Data Type | Direction | Trigger | Notes |
|-----------|-----------|---------|-------|
| Customer | Skimmer → QBO | On customer create/update | Links via `QboCustomerId` |
| Customer | QBO → Skimmer | On QBO customer update | Sync back limited to name/address fields |
| Invoice | Skimmer → QBO | On invoice send | Invoices push to QBO when sent (not on draft) |
| Invoice | QBO → Skimmer | Not synced back | QBO edits to invoices do NOT reflect in Skimmer |
| Payment | Skimmer → QBO | On payment receipt | Online (Stripe) and manual payments sync to QBO |
| Payment | QBO → Skimmer | Not synced back | Payments entered directly in QBO do NOT appear in Skimmer |

### Failure Modes

| Failure | Symptom | Recovery |
|---------|---------|----------|
| QBO auth token expired | Sync stops silently; invoices not appearing in QBO | Re-authenticate QBO integration in Skimmer Settings |
| Duplicate customers | Same customer created in both systems before sync | Manual merge in QBO; update `QboCustomerId` in Skimmer |
| Invoice mismatch | Amounts differ between Skimmer and QBO | Check tax configuration alignment. Manual correction in QBO if needed. |
| Sync lag | Invoices appear in QBO minutes to hours after creation | Normal — not real-time. Check Skimmer sync status page. |

### Reconciliation
- **Monthly:** Compare total invoiced in Skimmer vs. QBO for each company. Differences indicate sync failures or manual QBO edits.
- **Customer count:** Active customer count in Skimmer should approximate QBO active customer count. Large discrepancies indicate sync gaps.
- **QboCustomerId coverage:** Query `SELECT COUNT(*) FROM Customer WHERE QboCustomerId IS NULL AND IsInactive = 0` — any active customer without a QBO link is not syncing.

### Limitations
- **One-directional for invoices:** QBO is downstream for invoices. Editing an invoice in QBO does not update Skimmer.
- **No work order sync:** QBO has no work order entity. Work order charges reach QBO only as invoice line items.
- **No product catalog sync:** Skimmer products and QBO items must be manually aligned.

---

## 3. Zoho CRM → Skimmer (API Sync — POC)

### Overview
A proof-of-concept REST API sync that pushes lead/customer data from Zoho CRM into Skimmer. Currently manual, not automated.

### Status
**POC — not in production.** Scripts exist in `crm-to-skimmer-poc/`. Full bi-directional sync is on the backlog.

### Sync Behavior

| Data Type | Direction | Method | Notes |
|-----------|-----------|--------|-------|
| Contact → Customer | Zoho → Skimmer | REST API (POST /Customers) | Creates new Skimmer customer from Zoho contact |
| Address | Zoho → Skimmer | REST API (within customer payload) | Mailing_* → billing; Other_* → service location |
| Pool Type | Zoho → Skimmer | REST API (within customer payload) | Pool_Type → bodiesOfWater[0].name |

### Matching Logic
- **Primary match:** Email address (`PrimaryEmail` in Skimmer, `Email` in Zoho)
- **Fallback:** Manual review queue for non-matches
- **Dedup risk:** If the same person exists in both systems with different emails, a duplicate will be created

### Known Quirks (Verified)
- Zoho grant tokens are single-use and expire in minutes — must be exchanged immediately
- Skimmer POST /Customers always returns `isLead: true` regardless of intent
- Skimmer PUT /Customers requires the full customer object (not sparse update)
- State fields require conversion from full name ("Florida") to abbreviation ("FL")

### Failure Modes

| Failure | Symptom | Recovery |
|---------|---------|----------|
| Zoho token expired | 401 on API calls | Generate new grant token via Zoho developer console, exchange for refresh token |
| Skimmer API rate limit | 429 response | Back off and retry. Batch size of 25 recommended. |
| Duplicate customer created | Same person in both systems | Manual cleanup — delete duplicate in Skimmer, update Zoho record |

---

## Cross-Integration Considerations

### Data Freshness by System

| Query Source | Freshness | Notes |
|-------------|-----------|-------|
| Skimmer (direct) | Real-time | Current operational state |
| QBO (direct) | Near real-time | Depends on sync lag from Skimmer |
| Data Warehouse | T+1 (nightly) | Yesterday's data at best |
| Zoho CRM | Manual sync | Only as recent as last sync run |

### The "Where is the truth?" Decision Tree

```
Question about a customer's current status?
  → Skimmer (operational SoR)

Question about an invoice's financial status?
  → QBO (financial SoR)

Question about historical trends or cross-entity analytics?
  → Data Warehouse (analytical layer, T+1 freshness)

Question about a lead or sales pipeline?
  → Zoho CRM (sales SoR)
```

### Reconciliation Calendar

| Check | Frequency | Owner | Method |
|-------|-----------|-------|--------|
| Warehouse data freshness | Daily (automated) | ETL health check | MAX(service_date) within 48 hours |
| Skimmer ↔ QBO invoice totals | Monthly | Office admin | Compare Skimmer Billing Report to QBO P&L |
| QboCustomerId coverage | Monthly | Office admin | SQL query for active customers missing QBO link |
| Warehouse row count trends | Weekly | ETL monitoring | Health check flag for >10% drop |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — three integrations documented with failure modes, reconciliation, and freshness model | Claude / Ross Sivertsen |
