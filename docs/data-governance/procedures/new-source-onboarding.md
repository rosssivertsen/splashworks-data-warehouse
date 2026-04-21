# Procedure: Onboarding a New Source System

**Purpose.** How a net-new data source (e.g., QBO, Zoho CRM, Pool Deck, a new Skimmer-like SaaS) is brought under this governance model before it ingests a single row into the warehouse.

**Principle.** No source ingests production data without a signed contract. "Explore-first, govern-later" is a forbidden anti-pattern — it produces the class of outage this directory exists to prevent.

## Steps

### 1. Stakeholder alignment

- Identify the source-system owner at the vendor (contact, API docs, schema docs).
- Document the business rationale for ingestion in `docs/plans/` as a design doc.
- Confirm legal/compliance coverage (data classification, DPA, retention).

### 2. Schema discovery (sandbox only)

- Pull a sandbox or sample extract from the source.
- Enumerate every table and column with types.
- Identify which tables the warehouse will actually need (minimize surface area — contracts are a liability, not an asset; only govern what you ingest).

### 3. Contract authoring

- Create `docs/data-governance/contracts/<source>/` directory.
- Create `_index.yml` modeled on `skimmer/_index.yml`.
- For each table being ingested: create `<Table>.yml` following the template in `skimmer/WorkOrderType.yml`.
- Add an `initial_discovery:` metadata block to each contract noting sandbox fingerprint and observation date.

### 4. ETL integration

- Add source configuration to `etl/config.py` (company map if multi-tenant, credentials path, etc.).
- Extend the ETL loader to understand the source's extract format (SQLite, CSV, API pull — whatever it is).
- Fingerprint computation (CTRL-01) applies to every source identically — no new fingerprint code needed, just source-reader code.

### 5. Dbt source declaration

- Add a new `dbt/sources/<source>.yml` mirroring the contract. Every governed column appears as a dbt source column.
- Per-column `not_null` tests where `required: true`.
- dbt source `freshness` block pointing at the load timestamp column.

### 6. Reconciliation (CTRL-03) extension

- Identify which source tables have row-count or amount reconciliation checks appropriate for the new source.
- Add to `etl/reconcile.py`.
- CTRL-03 should fail if expected checks are absent (i.e., unreconciled sources are flagged).

### 7. First load in production

- Merge the onboarding PR. Contract is now live.
- Run an initial supervised ETL against production extracts.
- Verify CTRL-01 (match), CTRL-03 (clean), health check (healthy).
- Retain the supervised-load evidence in `../evidence/` (link from the onboarding PR).

### 8. Review and attest

- Document first successful governed load in `../CHANGELOG.md`.
- Add the new source to `../README.md` §Scope.
- Next quarterly review: attest that the source has been under governance continuously since the load date.

## Anti-patterns (do not do)

| Anti-pattern | Why it's forbidden |
|--------------|---------------------|
| "Land the data in `raw_<source>` first, governance later" | Creates a window where the warehouse contains ungoverned data. Retroactively drafting a contract against observed data rubber-stamps whatever was loaded — defeats the purpose. |
| "Just use `SELECT *` in the staging model for now" | Reproduces the exact pattern that caused the 2026-04-15 → 2026-04-20 outage. |
| "Skip CTRL-01 until we see how the source evolves" | CTRL-01 is precisely how we *know* how the source is evolving. Skipping it means evolving blind. |
| "We don't need a contract for low-value tables" | Low-value in a silo is high-risk when joined. Every ingested table is governed. If not ingested, skip it entirely — don't ingest ungoverned. |

## Amendment history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial procedure. |
