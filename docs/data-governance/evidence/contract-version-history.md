# Reading the Contract Version History

**Purpose.** How an auditor reconstructs the warehouse's schema state on any given date.

## Primary artifact: git history

Every change to `docs/data-governance/contracts/` is a versioned, signed (if GPG is configured), attributable commit. This is the authoritative record of what the warehouse was allowed to contain at any moment.

### What was in force on date X?

```bash
# Clone the repo (auditor can use a read-only mirror)
git clone --filter=blob:none https://github.com/rosssivertsen/splashworks-data-warehouse.git
cd splashworks-data-warehouse

# Find the last commit to the contracts directory on or before date X:
git log --until="2026-04-20T23:59:59Z" --format="%H %ai %s" -- docs/data-governance/contracts/ | head -1

# Check out that state:
git checkout <commit-sha>

# Now docs/data-governance/contracts/ reflects what was law on 2026-04-20.
```

### What changed between dates X and Y?

```bash
git log --since="2026-04-01" --until="2026-05-01" --follow -p -- docs/data-governance/contracts/
```

### Who approved a specific change?

```bash
git blame docs/data-governance/contracts/skimmer/WorkOrderType.yml
# Line-by-line attribution. The Ross-approved PR merge commit is authoritative.

git show <commit-sha>
# Full commit including Ross's merge approval message.
```

## Secondary artifact: `amendments:` block in each contract YAML

Every contract YAML has an `amendments:` block that mirrors the git history for quick human reading. The two should always agree. A discrepancy (`amendments:` claims a v1.2 that git doesn't reflect, or vice versa) indicates tampering and should be investigated.

## Tertiary artifact: `public.etl_schema_log.contract_version`

Every ETL run records which contract version fingerprint was matched. Cross-reference:

```sql
SELECT DISTINCT source_name, table_name, contract_version, MIN(detected_at) AS first_seen
  FROM public.etl_schema_log
 GROUP BY source_name, table_name, contract_version
 ORDER BY source_name, table_name, MIN(detected_at);
```

Result: a timeline of "which contract version was in effect in Postgres for each table." Cross-check against `git log` to confirm no divergence.

## Answering audit questions

### "What was the warehouse allowed to ingest on 2026-04-20?"

1. `git log --until="2026-04-20T23:59:59Z" -- docs/data-governance/contracts/` → last commit SHA
2. `git show <sha>:docs/data-governance/contracts/skimmer/_index.yml` → list of governed tables
3. For each governed table: `git show <sha>:docs/data-governance/contracts/skimmer/<Table>.yml` → canonical columns
4. This is the complete authoritative answer.

### "Did the warehouse ingest anything it wasn't allowed to?"

```sql
-- Any run where matches_contract was false AND pipeline_status is not 'drift_detected':
SELECT run_id, source_name, company_name, table_name, detected_at, pipeline_status
  FROM public.etl_schema_log
 WHERE matches_contract = false
   AND pipeline_status <> 'drift_detected';
```

**Pass criterion:** Zero rows. Any row is a governance violation.

### "When did SetCustomerActiveWhenScheduled first appear in the warehouse?"

```bash
git log -G "SetCustomerActiveWhenScheduled" --follow -- docs/data-governance/contracts/skimmer/WorkOrderType.yml
```

Returns the commit that adopted it + the merger (Ross) + timestamp.

## Amendment history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial query library. |
