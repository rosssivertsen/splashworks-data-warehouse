# CTRL-03 — Raw ↔ Warehouse Reconciliation

**Status:** **In production** since 2026-03-26 (ETL-5)
**Owner:** `etl/reconcile.py`
**Related policy:** `../policy.md` §5 (evidence)

## Control objective

Detect mismatches between raw source data loaded into `raw_skimmer.*` and the transformed state in `public_warehouse.*` / `public_semantic.*`. Provides assurance that transformations did not silently drop or miscount rows or aggregate amounts.

## How the control operates

After each successful `dbt run`, `etl/reconcile.py` executes six checks per company:

| # | Check | Raw query | Warehouse query | Tolerance |
|---|-------|-----------|-----------------|-----------|
| 1 | Active customers | `COUNT(*)` from `Customer` where `IsInactive=0 AND Deleted=0` | `COUNT(*)` from `dim_customer` where `is_inactive=0 AND deleted=0` | Exact |
| 2 | Payments | `COUNT(*)` from `Payment` | `COUNT(*)` from `fact_payment` | Exact |
| 3 | Invoice items | `COUNT(*)` from `InvoiceItem` | `COUNT(*)` from `fact_invoice_item` | Exact |
| 4 | Service stops | `COUNT(*)` from `ServiceStop` | `COUNT(*)` from `fact_service_stop` | Exact |
| 5 | Payment totals | `SUM(Amount)` from `Payment` | `SUM(amount)` from `fact_payment` | Float epsilon |
| 6 | Route skips | `COUNT(*)` from `RouteSkip` where `IsSkipped=1` | `COUNT(*)` from `fact_route_skip` | Exact |

Results are written to `data/reconciliation.json` with per-check pass/fail. The pipeline exits non-zero if any check fails.

## Relationship to CTRL-01

**CTRL-01 is a precondition for CTRL-03.** Reconciliation only runs when the schema state is valid:

- If CTRL-01 detects drift → CTRL-04 skips the dbt step → CTRL-03 never runs.
- Running CTRL-03 against an out-of-contract warehouse would produce misleading evidence, which is worse than no evidence.

## Known limitations

- Incremental facts (all 10 since ETL-1, 2026-03-18) accumulate history beyond the current 6-month extract window. Reconciliation compares current-window raw counts against full-history warehouse counts — a warehouse count >= raw count is expected and not a failure.
- Float epsilon for amount comparisons avoids false failures from floating-point drift across SQLite → Postgres → dbt type casts.

## Evidence of operation

- `data/reconciliation.json` — per-run output, archived by pipeline timestamp (VPS: `/opt/splashworks/data/reconciliation-YYYYMMDD.json` post-rotation)
- Pipeline log: `Step 4: Reconciliation passed` (or `WARNING: Reconciliation found discrepancies`)

## Amendment history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-03-26 | Initial control (ETL-5). |
| 1.1 | 2026-04-20 | Documented as CTRL-03. Clarified CTRL-01 precondition. |
