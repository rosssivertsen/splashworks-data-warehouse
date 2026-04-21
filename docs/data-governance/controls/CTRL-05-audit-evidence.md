# CTRL-05 — Audit Evidence Integrity

**Status:** Planned (DDL seeded in this PR; grants + triggers land with ETL-9)
**Owner:** Postgres DDL + role grants
**Related policy:** `../policy.md` §5

## Control objective

Ensure that the evidence produced by CTRL-01–04 cannot be modified or deleted after the fact, and can be inspected by auditors without granting write access to the database.

## Evidence tables

### `public.etl_schema_log` (append-only)

One row per `(run_id, source, company, table)`. Immutable after insert.

```sql
CREATE TABLE public.etl_schema_log (
  log_id              bigserial PRIMARY KEY,
  run_id              uuid NOT NULL,
  source_name         text NOT NULL,
  company_id          text NOT NULL,
  company_name        text NOT NULL,
  table_name          text NOT NULL,
  source_fingerprint  text NOT NULL,
  contract_version    text,              -- nullable for pre-governance tables
  contract_fingerprint text,             -- nullable for pre-governance tables
  matches_contract    boolean,           -- nullable for pre-governance tables
  column_list         jsonb NOT NULL,    -- [{name, type, ordinal}, ...]
  detected_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX etl_schema_log_run_idx ON public.etl_schema_log(run_id);
CREATE INDEX etl_schema_log_lookup_idx ON public.etl_schema_log(source_name, company_id, table_name, detected_at DESC);
```

### `public.etl_schema_drift` (append-only operationally, mutable fields are the open-state)

One row per drift event. Closed by a resolution update.

```sql
CREATE TABLE public.etl_schema_drift (
  drift_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  source_name         text NOT NULL,
  company_id          text NOT NULL,
  table_name          text NOT NULL,
  drift_type          text NOT NULL CHECK (drift_type IN
                        ('additive','subtractive','type_change','ordering','combined')),
  contract_version    text NOT NULL,
  contract_columns    jsonb NOT NULL,
  actual_columns      jsonb NOT NULL,
  diff                jsonb NOT NULL,
  resolution          text NOT NULL DEFAULT 'unresolved'
                        CHECK (resolution IN
                          ('unresolved','approved','ignored',
                           'reverted_at_source','false_positive')),
  resolution_pr_url   text,
  resolution_by       text,
  notes               text
);
CREATE INDEX etl_schema_drift_open_idx ON public.etl_schema_drift(resolution)
  WHERE resolution = 'unresolved';
```

## Integrity controls

Three layers enforce the append-only property:

1. **Role grants.** A dedicated role `etl_writer` has `INSERT` on both tables but NOT `UPDATE`/`DELETE`/`TRUNCATE`. The ETL runs as `etl_writer`. The superuser role retains admin access for emergencies but its use is logged.
2. **Row-level audit trigger.** Any UPDATE on `etl_schema_log` raises an exception (the table is strictly insert-only). `etl_schema_drift` allows UPDATE only on `last_seen_at`, `resolved_at`, `resolution`, `resolution_pr_url`, `resolution_by`, and `notes` — resolution fields — via a BEFORE UPDATE trigger that rejects changes to any other column.
3. **Backup retention.** `pg_dump` of both tables runs nightly into offsite storage. Retention: indefinite for `etl_schema_drift`, 7 years for `etl_schema_log` (aligned with typical SOX retention windows; adjustable via `policy.md` amendment).

## Auditor access

A read-only role `auditor_ro` has `SELECT` on:

- `public.etl_schema_log`
- `public.etl_schema_drift`
- `public.etl_load_log`
- `public.query_audit_log` (IN-4)
- `public_semantic.*` (read the warehouse)

The auditor connects through Cloudflare Access (IN-7) via the existing `bi.splshwrks.com` path with an auditor-specific policy. Query templates are in `../evidence/schema-log-queries.md`.

## Relationship to existing audit capability

- **IN-4 `query_audit_log`** (2026-03-26) captures every `/api/query` and `/api/query/raw` call. CTRL-05 extends this with schema-level events.
- **Cloudflare Access IN-7** (2026-03-26) provides the auth plumbing for `auditor_ro`.

## Evidence of operation

The control itself is proven by the schema — a successful UPDATE against `etl_schema_log` would be the failure mode. Nightly sentinel test (ETL-9): the ETL container attempts a disallowed UPDATE as a regression check; success = rejection.

## Amendment history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-20 | Initial DDL + design. Implementation pending in ETL-9. |
