# Procedure: Schema Change Approval

**Purpose.** How an unapproved drift event becomes an approved schema evolution, or is rejected.
**Trigger.** A row in `public.etl_schema_drift` with `resolution = 'unresolved'`.
**Actor.** Data engineer (human or Sherpa agent) + Approver (Ross).

## Decision tree

```
Drift detected (CTRL-01/02)
    │
    ▼
Is the change legitimate & intentional at the source?
    │
    ├── NO  → Likely source-side bug / regression
    │          → Escalate to source-system owner (Skimmer support)
    │          → Mark drift as 'reverted_at_source' once upstream confirms rollback
    │          → Pipeline resumes on next run after source matches prior contract
    │
    └── YES → Is the new shape something the warehouse needs?
               │
               ├── NO  → Irrelevant column for warehouse purposes
               │          → PR adds `ignore:` annotation to contract, excluding the column from fingerprint + load
               │          → Mark drift as 'ignored' when PR merges
               │          → Pipeline resumes
               │
               └── YES → Approve and adopt
                          → PR updates contract YAML (see "Approval PR template" below)
                          → Mark drift as 'approved' when PR merges, link to PR URL
                          → ETL re-runs; schema-aware checksum triggers rebuild of affected raw tables
                          → Pipeline resumes, CTRL-03 runs clean under new contract
```

## Approval PR template

Branch: `contract/<source>/<table>-v<next-version>` — e.g., `contract/skimmer/WorkOrderType-v1.2`.

Required content in the PR:

1. **Contract YAML change** — add/modify/remove columns, bump `contract_version`, add an `amendments:` entry with date, change description, and author.
2. **Rationale** (PR description):
   - What changed at the source and when it was first observed
   - Why the change is legitimate (link to Skimmer release notes if possible)
   - Whether any downstream staging / warehouse / semantic model needs to accommodate the new column (usually: no for additive; yes for subtractive or type)
   - Any reconciliation implications
3. **Drift record linkage** — cite `drift_id` so the audit trail is closed loop.
4. **Downstream dbt updates** — if the new column is surfaced in a `stg_*` model, include the update in the same PR. If not surfaced, note "new column is raw-only".

## Approver checklist (Ross)

- [ ] Does the rationale establish the change is legitimate (not a source-side mistake)?
- [ ] Is the new contract version monotonically incremented?
- [ ] Are all affected companies' sources confirmed to have the new shape (or is a phased rollout documented)?
- [ ] Does the amendments log in the YAML match the git commit message?
- [ ] Is the drift_id cited?

## Post-merge actions (automated where possible)

1. **ETL re-run** — the next nightly cron will detect the new contract version, rebuild affected raw tables, and continue normally. For same-day recovery, an operator can trigger `etl.main` manually (see `drift-incident-response.md` §Resume).
2. **Drift row close** — `resolution` column set to `approved`, `resolved_at` set, `resolution_pr_url` populated. Done via a one-line SQL from the operator or automated by a GitHub Action webhook listening to contract PR merges.
3. **Audit log entry** — the git commit + the closed drift row + the successful post-approval ETL run together form the evidence that the control operated as designed.

## Phased rollouts (`required: false` + `phased: true`)

When Skimmer rolls out a new column to only one of the two companies (AQPS before JOMO, or vice versa), the contract can accept it as optional + phased:

```yaml
- name: NewColumnName
  type: BOOLEAN
  required: false
  phased: true
  since: v1.2
```

Behavior:
- CTRL-01 accepts the column being present OR absent on any company.
- CTRL-01 rejects a type mismatch or an unknown column that is NOT declared in the contract.
- When `phased: true` is removed (all companies caught up), it becomes a normal optional column.

This is the **only** tolerance the governance model grants. It is explicit, version-tagged, and expires when Ross removes the flag.

## Amendment history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial procedure. |
