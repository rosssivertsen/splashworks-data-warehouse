# Data Governance Policy — *Lex Immutabilis*

**Version:** 1.0
**Effective:** 2026-04-20
**Owner:** Ross Sivertsen (CIO, Canyon Creek Enterprises)
**Applies to:** Every data source ingested into the Splashworks data warehouse.

---

## 1. Principle

The Splashworks data warehouse is a **governed data contract**, not a best-effort ingestion layer.

Source systems will evolve. That is normal and expected.

What is **not** acceptable is allowing unreviewed schema changes to silently pass through, be masked, or degrade the integrity of cross-company aggregation and reconciliation.

Every byte of data that lands in the warehouse is bound by a written, version-controlled contract. Any deviation from that contract is a governance event — never a silent adaptation.

## 2. The two states of schema change

Every observed difference between a source system and the warehouse's canonical contract is classified into exactly one of two states. There is no third state.

### 2A. Approved schema evolution

**Definition.** A source schema change that has been reviewed and explicitly accepted into the warehouse contract, via a merged pull request updating the relevant file in `contracts/`.

**Pipeline behavior.**

- Controlled migration: ETL rebuilds affected raw tables on the next run.
- Canonical schema definitions in `contracts/` are authoritative.
- Union logic, model contracts, and tests are updated as part of the approving PR.
- Downstream models and reconciliation re-run under the new approved contract.
- The git history of `contracts/` is the approval audit trail — immutable, attributable, timestamped.

### 2B. Unapproved drift

**Definition.** A source schema difference that has **not** been reviewed and approved. This includes additive drift (new columns in source), subtractive drift (missing columns the contract requires), and type drift (column type in source differs from contract).

**Pipeline behavior.**

- **Fail fast.** The pipeline does not proceed past schema validation.
- **Alert loudly.** A drift event is posted to Slack `#alerts` (channel `C0ARN4C5KPS`) with the exact source, company, table, and column/type diff.
- **No silent intersection.** The pipeline does not quietly drop divergent columns to keep the union working.
- **No partial progress.** No tables are loaded for the affected run until the drift is resolved, because cross-table reconciliation requires a consistent snapshot.
- **No reconciliation runs** against a warehouse whose schema state is unreviewed.

## 3. Forbidden operations

The following operations are prohibited by this policy, regardless of expedience:

1. **Silent column intersection.** Macros and loaders must not paper over source differences by unioning only common columns.
2. **Silent column drops.** The ETL must not skip columns to make a load succeed.
3. **Downstream transformations under unapproved schema.** dbt runs and reconciliation are gated on a clean schema validation phase.
4. **Destructive resolution without contract update.** `DROP TABLE` or equivalent as a workaround is disallowed unless preceded by an approved contract PR that documents why the change is legitimate.
5. **Manual edits to `etl_schema_log` or `etl_schema_drift`.** These tables are evidence. They are append-only operationally and protected by role-based grants.

## 4. Responsibilities

| Role | Responsibility |
|------|---------------|
| **Source system owner** (e.g., Skimmer) | Notifies Splashworks in advance of schema changes when possible. Absence of advance notice does not change the pipeline's response — drift is still unapproved until a contract PR merges. |
| **Data engineer (human or agent)** | Reviews drift events, proposes contract updates via PR, handles rebuild logistics, maintains `contracts/`. |
| **Approver (Ross)** | Reviews and merges contract PRs. Override authority. Owner of `policy.md`. |
| **Auditor** | Walks this directory top-to-bottom. Uses `evidence/` queries to verify controls operated as designed over a given period. |

## 5. Evidence & auditability

Three artifacts are the permanent audit record:

1. **`contracts/` git history.** Every column that has ever been canonical in the warehouse is attributable to a commit with author, timestamp, and rationale.
2. **`public.etl_schema_log` table.** Every ETL run records the observed source fingerprint, the contract version in force at that moment, and whether they matched. Retention: indefinite (no DELETE, no TRUNCATE, RLS).
3. **`public.etl_schema_drift` table.** Every drift event is a row, opened at detection, closed at resolution, with links to the resolving PR.

Together these answer the four audit questions:

- *What is the warehouse allowed to contain today?* → current `contracts/`
- *What did the warehouse actually ingest on date X?* → `etl_schema_log` for that run_id
- *Did the warehouse ever ingest something it wasn't allowed to?* → any row in `etl_schema_drift` where the resolution was not `approved` + a passing etl run afterward
- *Who approved the current state?* → git blame of `contracts/`

## 6. Changes to this policy

This document is amended only by a pull request with Ross's explicit approval. Amendments are numbered in §7.

## 7. Amendment history

| Version | Date | Change | PR |
|---------|------|--------|----|
| 1.0 | 2026-04-20 | Initial policy. | (this PR) |
