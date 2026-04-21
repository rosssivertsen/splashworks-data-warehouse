# CTRL-02 — Drift Alerting

**Status:** Planned (design documented; implementation lands with ETL-9)
**Owner:** ETL pipeline (`etl/schema_contract.py`, `etl/alerts.py`)
**Related policy:** `../policy.md` §2B
**Depends on:** CTRL-01 (detection)

## Control objective

Ensure that every unapproved drift event is made visible to a human operator within minutes of detection, with enough diagnostic detail to classify and resolve the event.

## How the control operates

When CTRL-01 detects drift:

1. A row is inserted into `public.etl_schema_drift` with:
   - `drift_id` (uuid), `first_seen_at` (timestamptz, default now())
   - `source_name`, `company_id`, `table_name`
   - `drift_type` — `additive` | `subtractive` | `type_change` | `ordering` | `combined`
   - `contract_columns` (jsonb), `actual_columns` (jsonb), `diff` (jsonb — structured: `{added: [], removed: [], changed: []}`)
   - `resolution = 'unresolved'` (default)
2. A Slack message is posted to `#alerts` (channel `C0ARN4C5KPS`, per CLAUDE.md guardrail) with:
   - Source system, company, table
   - Drift type
   - Columns added / removed / changed with types
   - Pipeline run_id and timestamp
   - Link to the resolution procedure (`../procedures/drift-incident-response.md`)
   - Link to the `etl_schema_drift` row (if a query UI exists) or the row's `drift_id`
3. The pipeline exit is non-zero (CTRL-04), causing the wrapping `nightly-pipeline.sh` to alert via its existing error handler.

## Alert payload example

```
🚨 SCHEMA DRIFT DETECTED — pipeline halted
Source: skimmer | Company: AQPS | Table: WorkOrderType
Type: additive
Contract version: v1.1 (a1b2c3d)
Diff:
  + SetCustomerActiveOnHold (BOOLEAN)  [in source, not in contract]
Runbook: docs/data-governance/procedures/drift-incident-response.md
Drift ID: 7e9c1a4b-…
```

## Alert routing

| Severity | Destination | Ack SLA |
|----------|-------------|---------|
| Drift detected | Slack `#alerts` | 24 hours (business day) |
| Drift unresolved > 48h | Slack `#alerts` (reminder) + iMessage to Ross | 1 hour |
| Pipeline exit non-zero from drift | Same as above + existing cron error path | Same |

Reminder escalation is a stretch goal for ETL-9; v1 sends one alert per drift event per pipeline run.

## Non-triggers (by design)

CTRL-02 does **not** fire for:

- Row-count change (that's what the pre-governance checksum handles).
- Data-value changes (CTRL-03 reconciliation is responsible).
- Post-approval drift where contract was just updated — the new contract supersedes the prior fingerprint.

## De-duplication

The same drift, detected on consecutive nights before resolution, does not create new `etl_schema_drift` rows. The existing open row's `last_seen_at` is updated. A summary alert fires once per 24h (not every run) to reduce noise while a drift is being actively resolved.

## Evidence of operation

- `public.etl_schema_drift` — primary record
- Slack `#alerts` channel history — auxiliary corroboration
- Pipeline log: `CTRL-02: drift event emitted for skimmer.AQPS.WorkOrderType (drift_id=7e9c1a4b)`

## Test procedure

`etl/tests/test_drift_alerting.py` covers:

1. Drift detected → row inserted in `etl_schema_drift`.
2. Slack alert sent with correct payload (mocked Slack client).
3. De-duplication: second night same drift → no new row, `last_seen_at` updated.
4. Alert formatting: additive vs subtractive vs type change vs ordering produces distinct messages.

## Amendment history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial definition. Implementation pending in ETL-9. |
