# Procedure: Drift Incident Response

**Purpose.** Runbook for the operator on call when a CTRL-02 drift alert fires.
**Audience.** Data engineer (human or Sherpa agent).
**SLA.** Acknowledge within 24 hours (business day); resolve within 7 days.

## 1. Acknowledge (5 minutes)

- Read the Slack `#alerts` message. Capture `drift_id` and the diff.
- React with 👀 to acknowledge receipt to Ross and any other observer.

## 2. Diagnose (15–30 minutes)

Pull the full drift record:

```sql
SELECT * FROM public.etl_schema_drift WHERE drift_id = '<drift_id>';
```

Confirm the affected extract at the source:

```bash
# On VPS
cd /opt/splashworks/data/extracts
gunzip -kf <company-id>.db.gz -c > /tmp/<company>.db
sqlite3 /tmp/<company>.db "PRAGMA table_info('<TableName>');"
```

Classify:

| Observation | Likely cause | Action path |
|-------------|--------------|-------------|
| Extra column, reasonable name, present in both companies | Skimmer feature rollout | Approve (§3A) |
| Extra column, present in only one company | Skimmer phased rollout | Approve with `phased: true` (§3A) |
| Extra column, odd name, unexpected | Check Skimmer release notes; may be beta | Defer — annotate `ignore:` until clarity (§3B) |
| Missing column contract requires | Skimmer regression OR contract overspec | Escalate to Skimmer OR correct contract (§3C) |
| Type change | Schema migration in Skimmer | Usually approve; may need downstream dbt update (§3A) |
| Ordering change, same set | Skimmer refactor | Approve — update ordinals in contract (§3A) |

## 3. Resolve

### 3A. Approve and adopt

Follow `schema-change-approval.md`. Open a branch `contract/<source>/<table>-v<next>`, update the YAML, PR, merge. On merge:

```sql
UPDATE public.etl_schema_drift
   SET resolution       = 'approved',
       resolved_at      = now(),
       resolution_pr_url= 'https://github.com/rosssivertsen/splashworks-data-warehouse/pull/NNN',
       resolution_by    = '<github-handle>'
 WHERE drift_id = '<drift_id>';
```

### 3B. Annotate as ignored

Only for columns we deliberately don't want to ingest (beta features, deprecated fields).

```yaml
- name: SomeColumn
  type: TEXT
  required: false
  ignore: true
  since: v1.X
  reason: "Beta feature, not surfacing in warehouse until GA"
```

Behavior: CTRL-01 tolerates source presence/absence; ETL loader skips the column entirely (not read, not written).

### 3C. Source-side rollback

If the drift is a source-side mistake (rare), notify Skimmer support with the diff. When they confirm rollback:

```sql
UPDATE public.etl_schema_drift
   SET resolution = 'reverted_at_source',
       resolved_at = now(),
       resolution_by = '<github-handle>',
       notes = 'Confirmed rollback per Skimmer support ticket #NNNNN'
 WHERE drift_id = '<drift_id>';
```

## 4. Resume the pipeline

After the resolving PR merges, the next nightly cron will succeed automatically. For faster recovery:

```bash
ssh splashworks-vps "cd /opt/splashworks && git pull && docker compose up -d --build api && /opt/splashworks/etl/scripts/nightly-pipeline.sh --skip-sync"
```

(`--skip-sync` reuses already-synced extracts; only re-runs validation + load + dbt + reconcile.)

Verify:

```sql
-- Pipeline status
SELECT pipeline_status FROM public.etl_schema_log ORDER BY detected_at DESC LIMIT 1;
-- Expected: 'healthy'

-- Drift cleared
SELECT COUNT(*) FROM public.etl_schema_drift WHERE resolution = 'unresolved';
-- Expected: 0
```

## 5. Close the loop

- Post a resolution note in Slack `#alerts` citing the PR URL and closed `drift_id`.
- If the incident was educational (non-trivial classification decision, new tooling need, etc.), append a note to the next sherpa-vault daily log under "lessons".

## Amendment history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial procedure. |
