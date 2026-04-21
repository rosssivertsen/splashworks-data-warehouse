# Auditor Query Library — Schema Governance

**Purpose.** Copy-paste SQL queries that demonstrate each control has operated as designed over an arbitrary date range. These are the queries an auditor runs.

**Connection.** `auditor_ro` role via Cloudflare Access at `bi.splshwrks.com` (Metabase) or via the raw SQL interface at `api.splshwrks.com/api/query/raw`.

**Parameter convention.** Replace `:start_date` and `:end_date` with ISO literals (e.g., `'2026-04-01'`).

---

## CTRL-01 — Schema Validation

### Q1.1: Was every governed table validated on every run?

```sql
-- Distinct runs in the period:
SELECT COUNT(DISTINCT run_id) AS run_count,
       MIN(detected_at)       AS first_run,
       MAX(detected_at)       AS last_run
  FROM public.etl_schema_log
 WHERE detected_at >= :start_date
   AND detected_at <  :end_date;

-- Governed tables checked per run (should equal count in contracts/<source>/_index.yml with status='governed'):
SELECT run_id,
       source_name,
       COUNT(*) FILTER (WHERE contract_version IS NOT NULL) AS governed_tables_checked
  FROM public.etl_schema_log
 WHERE detected_at >= :start_date
   AND detected_at <  :end_date
 GROUP BY run_id, source_name
 ORDER BY run_id;
```

**Pass criterion:** `governed_tables_checked` equals the contract index count for each run. Any row with a lower count = a governed table was not validated — control failure.

### Q1.2: What was the contract version in force on date X?

```sql
SELECT DISTINCT source_name, table_name, contract_version
  FROM public.etl_schema_log
 WHERE detected_at::date = '2026-04-20'
   AND contract_version IS NOT NULL
 ORDER BY source_name, table_name;
```

Cross-reference against `git log docs/data-governance/contracts/` for that date to verify the contract version in Postgres matches the contract version in git at that commit.

---

## CTRL-02 — Drift Alerting

### Q2.1: All drift events in the period

```sql
SELECT drift_id, first_seen_at, resolved_at,
       source_name, company_id, table_name,
       drift_type, resolution, resolution_pr_url,
       EXTRACT(EPOCH FROM (resolved_at - first_seen_at))/3600.0 AS hours_to_resolve
  FROM public.etl_schema_drift
 WHERE first_seen_at >= :start_date
   AND first_seen_at <  :end_date
 ORDER BY first_seen_at DESC;
```

### Q2.2: Any drift event closed without an approving PR?

```sql
SELECT drift_id, source_name, table_name, resolution, resolution_pr_url, notes
  FROM public.etl_schema_drift
 WHERE resolution IN ('approved','ignored')
   AND (resolution_pr_url IS NULL OR resolution_pr_url = '')
   AND first_seen_at >= :start_date;
```

**Pass criterion:** Zero rows. An approved or ignored resolution without a PR URL is a governance failure.

### Q2.3: Any drift event that resolved as `false_positive`?

```sql
SELECT drift_id, source_name, table_name, notes, resolution_by
  FROM public.etl_schema_drift
 WHERE resolution = 'false_positive'
   AND first_seen_at >= :start_date;
```

False positives should be rare and specifically documented in `notes`. A pattern of false positives points to a flaw in fingerprint computation — investigate.

---

## CTRL-03 — Reconciliation

### Q3.1: Did reconciliation run every day the pipeline succeeded?

```sql
WITH runs AS (
  SELECT DATE(detected_at) AS run_date, MAX(pipeline_status) AS status
    FROM public.etl_schema_log
   WHERE detected_at >= :start_date
   GROUP BY DATE(detected_at)
)
SELECT run_date, status
  FROM runs
 WHERE status IN ('healthy','dbt_partial_failure_downstream','reconciliation_failed')
 ORDER BY run_date;
```

Cross-reference with `data/reconciliation-*.json` archive (on VPS) for per-check outcomes.

---

## CTRL-04 — Atomic Pipeline Gate

### Q4.1: Any day the pipeline proceeded past drift?

```sql
SELECT run_date, MAX(pipeline_status) AS status, COUNT(*) AS drift_count
  FROM public.etl_schema_log l
  LEFT JOIN public.etl_schema_drift d
    ON d.first_seen_at::date = l.detected_at::date
 WHERE l.matches_contract = false
   AND MAX(l.pipeline_status) NOT IN ('drift_detected')
 GROUP BY run_date;
```

**Pass criterion:** Zero rows. Any row = pipeline advanced past drift without the gate firing — control failure.

### Q4.2: Pipeline status distribution

```sql
SELECT pipeline_status, COUNT(DISTINCT run_id) AS runs
  FROM public.etl_schema_log
 WHERE detected_at >= :start_date
 GROUP BY pipeline_status
 ORDER BY runs DESC;
```

---

## CTRL-05 — Audit Evidence Integrity

### Q5.1: Any direct updates to evidence tables?

Postgres doesn't expose per-row update timestamps by default. Evidence is:

```sql
-- Column-level integrity check — etl_schema_log should have no columns that change after insert:
-- This is enforced by a BEFORE UPDATE trigger. Check the trigger exists:
SELECT tgname, tgrelid::regclass
  FROM pg_trigger
 WHERE tgrelid IN ('public.etl_schema_log'::regclass, 'public.etl_schema_drift'::regclass)
   AND tgname NOT LIKE 'RI_%';
```

**Pass criterion:** Triggers named `etl_schema_log_no_update` and `etl_schema_drift_no_column_update` exist.

### Q5.2: Role grants

```sql
SELECT grantee, privilege_type
  FROM information_schema.table_privileges
 WHERE table_schema = 'public'
   AND table_name   IN ('etl_schema_log','etl_schema_drift')
 ORDER BY grantee, table_name, privilege_type;
```

**Pass criterion:**
- `etl_writer` has `INSERT` only (no `UPDATE`/`DELETE` on `etl_schema_log`)
- `auditor_ro` has `SELECT` only
- `splashworks` (admin) has all

---

## Amendment history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial query library. |
