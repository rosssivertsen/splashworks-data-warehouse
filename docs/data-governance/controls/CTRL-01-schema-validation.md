# CTRL-01 — Schema Validation at Ingestion

**Status:** Partial (seeded with `WorkOrderType` in this PR; full rollout tracked by ETL-9)
**Owner:** ETL pipeline (`etl/schema_contract.py`, `etl/main.py`)
**Related policy:** `../policy.md` §2A/§2B

## Control objective

Prevent any row from entering the warehouse whose source schema has not been approved by the current contract.

## How the control operates

For each `(company, table)` pair in a nightly ETL run, **before any data is loaded**:

1. The ETL reads the governed SQLite extract and runs `PRAGMA table_info` to enumerate columns in source-order with types.
2. The ETL loads the canonical contract for that table from `docs/data-governance/contracts/<source>/<Table>.yml`.
3. The ETL computes two fingerprints:
   - **Source fingerprint** = stable hash of `[(name, type, ordinal)]` from SQLite.
   - **Contract fingerprint** = stable hash of the `columns:` list in the YAML.
4. The ETL compares them:
   - **Match** → proceed to load (CTRL-02 does not fire; CTRL-04 does not gate).
   - **Mismatch** → emit a drift event via CTRL-02, abort the load for this company+table, and gate the pipeline via CTRL-04.
5. Both fingerprints are persisted to `public.etl_schema_log` (CTRL-05 evidence) regardless of outcome. Log rows are tagged with the contract version SHA at run time.

## Scope

- **Governed tables** (listed in `contracts/<source>/_index.yml` with `status: governed`): full CTRL-01 enforcement.
- **Pre-governance tables** (not yet in the index): CTRL-01 is skipped; row-count checksum is the only change detector (legacy behavior). This is a transitional state — ETL-9 brings all tables under governance.

## Failure modes (expected)

| Case | Classification | Action |
|------|----------------|--------|
| Source has a column not in contract | Unapproved additive drift | CTRL-02 alert + CTRL-04 gate |
| Source is missing a column the contract requires | Unapproved subtractive drift | CTRL-02 alert + CTRL-04 gate |
| Source column has different type than contract | Unapproved type drift | CTRL-02 alert + CTRL-04 gate |
| Source column ordinal differs | Unapproved ordering drift | CTRL-02 alert + CTRL-04 gate |
| Contract file missing for a governed table | Misconfiguration | Pipeline error (not drift) — operator attention |
| Contract file malformed YAML | Misconfiguration | Pipeline error (not drift) — operator attention |

## Control strength

**Preventive.** Drift is caught before any data mutation.

## Evidence of operation

- `public.etl_schema_log` — one row per `(run_id, company, table)`, every run
- `public.etl_schema_drift` — one row per drift event (opened/closed)
- Pipeline log line: `CTRL-01: validated N/N governed tables, 0 drift events`

See `../evidence/schema-log-queries.md` for auditor queries.

## Test procedure

`etl/tests/test_schema_validation.py` covers:

1. Match case — source fingerprint equals contract fingerprint → no drift event, no alert.
2. Additive drift — inject an extra column in source → drift event emitted, pipeline gate fires.
3. Subtractive drift — remove a required column in source → drift event emitted.
4. Type drift — change column type in source → drift event emitted.
5. Ordering drift — reorder columns in source → drift event emitted.
6. Pre-governance table — not in `_index.yml` → CTRL-01 skipped, row-count checksum used.

## Amendment history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial definition. Seeded with `WorkOrderType`. |
