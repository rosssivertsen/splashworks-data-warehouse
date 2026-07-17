# Blocked features — parked scaffolds

Reference material for features that are designed but **blocked on a data
dependency**. The `.sql.reference` files are dbt models kept OUT of `dbt/models/`
so they don't run against data that doesn't exist yet. Drop them back into
`dbt/models/` when the dependency clears.

## Recurring Service Checklist report (DL, blocked)

**Goal:** per-route, per-stop, per-day — was each Service Checklist item completed,
and if not, why. Operational quality / tech-accountability reporting.

**Blocker:** the per-item checklist completion data is **not available in the
nightly SQLite extract nor the Skimmer public API.** Verified twice:
- 2026-04-30 — full investigation (extract + devportal), see
  `docs/correspondence/2026-04-30-skimmer-service-checklist-data-request.md`.
- 2026-07-17 — re-verified live: extract has only stop-level `service_completion`
  (from `CompleteTime`), not per-item; Skimmer API `Routes`/`ServiceStops`/
  `Checklists`/`ServiceHistory` endpoints all return **404** (only Customers-type
  resources exist). The data lives only in Skimmer's UI "Service History" export.

**Unblock path (Option C, from the correspondence):** Skimmer writes a scheduled
Service History CSV to the OneDrive extract folder → ingest via the existing
pipeline. Requires Skimmer/Glenn to enable it, or we automate the UI export.

**Parked scaffold:**
- `rpt_recurring_checklist.sql.reference` — the intended semantic report model.
- `stg_location_work_order_type.sql.reference` — supporting staging model.
