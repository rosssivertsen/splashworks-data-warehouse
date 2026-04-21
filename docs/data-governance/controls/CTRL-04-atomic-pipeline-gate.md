# CTRL-04 — Atomic Pipeline Gate

**Status:** Planned (design documented; implementation lands with ETL-9)
**Owner:** `etl/main.py`, `etl/scripts/nightly-pipeline.sh`
**Related policy:** `../policy.md` §2B ("No partial progress")

## Control objective

Prevent the warehouse from landing in an internally-inconsistent state when schema drift is detected mid-pipeline. If any governed table fails CTRL-01, the entire nightly load is aborted atomically before any data mutation.

## How the control operates

The nightly pipeline executes in five phases. **Each phase is a gate for the next.**

```
Phase 0  sync       rclone OneDrive → /opt/splashworks/data/extracts/
Phase 1  validate   CTRL-01 against every governed table              ← gate
Phase 2  load       Python ETL writes raw_skimmer tables              ← gate
Phase 3  transform  dbt run (staging → warehouse → semantic)          ← gate
Phase 4  reconcile  CTRL-03 raw↔warehouse checks                      ← gate
Phase 5  health     API health check publishes status
```

### Gate rules

- **Phase 1 → Phase 2.** Any drift event → abort. No raw_skimmer mutation for any table in the run, including tables that passed their own CTRL-01 check. The principle: cross-table reconciliation (Phase 4) requires a consistent snapshot; allowing some tables to advance while others are frozen breaks that premise.
- **Phase 2 → Phase 3.** Any ETL load error → abort. dbt never runs against a partial load.
- **Phase 3 → Phase 4.** dbt partial failure classifier decides:
  - If all failed models are **downstream-only** (not in CTRL-03's dependency DAG) → continue to Phase 4.
  - If any failed model is **in the CTRL-03 dependency DAG** → abort Phase 4. CTRL-03 evidence against a broken warehouse is worse than no evidence.
- **Phase 4 → Phase 5.** CTRL-03 failure → Phase 5 still runs but reports `reconciliation_failed` status. Health endpoint must tell the truth.

### Classifier for Phase 3 → Phase 4

Parse `dbt/target/run_results.json` after every `dbt run`. For each failed model, walk its ancestry in `manifest.json`. If any descendant is in the set `{dim_customer, dim_service_location, fact_payment, fact_invoice_item, fact_service_stop, fact_route_skip}` — the CTRL-03 dependency set — abort Phase 4. Otherwise continue.

This is narrower than "any dbt failure aborts" (which was the pre-CTRL-04 behavior and caused reconciliation to miss 6 consecutive nights) and narrower than "always continue" (which breaks the reliability pillar). It's the correct gate.

## Status reporting

The `/api/health` endpoint publishes one of the following statuses, visible to operators and the frontend status bar:

| Status | Meaning |
|--------|---------|
| `healthy` | All five phases succeeded. |
| `drift_detected` | Phase 1 caught unapproved drift; pipeline halted. See `etl_schema_drift`. |
| `load_failed` | Phase 2 failed. See pipeline log. |
| `dbt_partial_failure_downstream` | Phase 3 had failures, all downstream-only; Phases 4–5 completed. |
| `dbt_partial_failure_blocking` | Phase 3 had failures in the CTRL-03 dependency DAG; Phase 4 skipped. |
| `reconciliation_failed` | Phase 4 found row/amount mismatches. |
| `unreachable` | API could not be reached for health check. |

## Relationship to existing pipeline script

`etl/scripts/nightly-pipeline.sh` currently aborts on any dbt failure (the 2026-04-15 → 2026-04-20 outage pattern). ETL-9 refactors it to implement the classifier above.

## Evidence of operation

- Pipeline log phase markers: `=== Phase N: <name> starting ===`, `=== Phase N: <name> complete ===`, `=== Phase N: <name> aborted: <reason> ===`
- `/api/health` response history (captured by status-bar audit trail IN-6)
- `public.etl_schema_log.pipeline_status` — terminal status per run_id

## Amendment history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial definition. Implementation pending in ETL-9. |
