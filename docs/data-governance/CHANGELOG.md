# Data Governance — Changelog

Cross-source history of contract changes. Each entry cites the PR that effected the change.

## 2026-04-20 — Initial governance scaffold

**PR:** `hotfix/etl-schema-governance-seed` (this PR)
**Scope:** Establish the `docs/data-governance/` directory and the *Lex Immutabilis* policy. Seed governance with the first contract.
**Contracts added:**
- `contracts/skimmer/WorkOrderType.yml` at `v1.1` (includes the `SetCustomerActiveWhenScheduled` column Skimmer added circa 2026-04-15).
**Tables brought under governance:** 1 of 45 Skimmer tables. Remaining 44 stay pre-governance until migrated (tracked by ETL-9 in `docs/plans/BACKLOG.md`).
**Controls referenced:** CTRL-01 partial (seeded for 1 table), CTRL-02/04/05 planned, CTRL-03 already in production (ETL-5, 2026-03-26).
**Incident closed:** The 2026-04-15 → 2026-04-20 outage where AQPS `WorkOrderType` was frozen at 28 cols while JOMO advanced to 29. Contract `v1.1` explicitly approves the new column for both companies.
