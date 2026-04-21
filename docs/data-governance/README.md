# Splashworks Data Governance

**Purpose.** This directory is the single home for the governance model that controls how data enters, moves through, and is attested by the Splashworks data warehouse. It is designed to be handed to an auditor for a walkthrough of data-lineage process and controls without additional compilation work.

**Audience.**

- **Auditors (SOC 2, ISO 27001, COBIT, SOX):** `policy.md` → `controls/` → `procedures/` → `evidence/` gives you the full chain from principle to runnable query.
- **Data engineers:** `contracts/` is the canonical schema contract that ETL and dbt both read. Changes to a contract are changes to the warehouse's law.
- **Senior leadership:** Start with `policy.md` for the one-page principle; jump to `controls/` for the concrete checks in place.
- **AI agents (Sherpa, Codex, etc.):** Everything here is machine-readable. Contracts are YAML, controls are typed Markdown with stable headings.

## Directory map

```
docs/data-governance/
├── README.md                          # This file
├── policy.md                          # Lex Immutabilis — governing doctrine
├── contracts/                         # Canonical schema contracts, per source system
│   └── skimmer/
│       ├── _index.yml                 # Which Skimmer tables are under governance
│       └── WorkOrderType.yml          # One file per governed table
│   # future: qbo/, zoho/, pool-deck/
├── controls/                          # Automated controls (one file per CTRL-xx)
│   ├── CTRL-01-schema-validation.md   # Phase 1: validate source vs contract at ETL time
│   ├── CTRL-02-drift-alerting.md      # Loud failure on unapproved drift
│   ├── CTRL-03-reconciliation.md      # Raw↔warehouse row-count + amount checks (ETL-5)
│   ├── CTRL-04-atomic-pipeline-gate.md# Drift → skip downstream stages atomically
│   └── CTRL-05-audit-evidence.md      # etl_schema_log retention + read-only grant
├── procedures/                        # Human-in-the-loop workflows
│   ├── schema-change-approval.md      # How drift → approved contract PR
│   ├── drift-incident-response.md     # Runbook when an alert fires
│   └── new-source-onboarding.md       # How to bring a new source (e.g., QBO) under governance
├── evidence/                          # Where to find audit artifacts
│   ├── schema-log-queries.md          # SQL that produces evidence for auditors
│   └── contract-version-history.md    # How to read git log of contracts
└── CHANGELOG.md                       # Contract version history (cross-source)
```

## How changes to this directory work

**Any change to `policy.md`, `contracts/`, `controls/`, or `procedures/` requires a pull request.** The git history of this directory is the audit trail. No change is applied in production until the PR is merged to `main`. No contract change is silently absorbed.

**Any change to `contracts/` forces a rebuild** of the affected raw tables on the next ETL run. This is by design — a contract change is a warehouse-wide event.

## Scope

Governance applies to **every data source ingested into the warehouse**, regardless of system: Skimmer today, QBO and Zoho tomorrow. Source-agnosticism is a design requirement of the policy. See `procedures/new-source-onboarding.md` for how a new source enters governance.

## Version

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial scaffold. Skimmer `WorkOrderType` seeded. |
