# Audit Logging — Design Spec

**Date:** 2026-03-17
**Stream:** IN (Infrastructure)
**Backlog ID:** IN-4 (new)
**Effort:** S
**Status:** Approved

---

## Problem

The API has no record of query execution. There is no way to answer "what queries ran against customer data last week?" or "who is using the tool?" The only logging is Python `logger.warning/error` for failed queries, which is ephemeral (lost on container restart) and doesn't capture successful queries at all.

## Goal

Add a SQL-queryable audit trail for every query executed through `/api/query` and `/api/query/raw`. Capture who asked, what was generated, what executed, and what came back.

## Non-Goals

- Rate limiting (separate concern)
- Metabase dashboard over audit data (future layer)
- Alerting on anomalies (future layer)
- Docker log persistence / rotation (separate config change)
- Changes to existing Python logger calls

## Design

### New table: `public.query_audit_log`

```sql
CREATE TABLE IF NOT EXISTS public.query_audit_log (
    id              SERIAL PRIMARY KEY,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_ip       TEXT,
    cf_access_email TEXT,
    endpoint        TEXT NOT NULL,
    question        TEXT,
    layer           TEXT,
    rewriter_confidence TEXT,
    generated_sql   TEXT,
    executed_sql    TEXT,
    was_repaired    BOOLEAN NOT NULL DEFAULT FALSE,
    status          TEXT NOT NULL
        CONSTRAINT chk_status CHECK (status IN (
            'success', 'error', 'unanswerable', 'timeout',
            'validation_error', 'ai_error', 'connection_error'
        )),
    row_count       INTEGER,
    duration_ms     INTEGER,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_query_audit_log_requested_at ON public.query_audit_log(requested_at);
CREATE INDEX IF NOT EXISTS idx_query_audit_log_cf_access_email ON public.query_audit_log(cf_access_email);
CREATE INDEX IF NOT EXISTS idx_query_audit_log_status ON public.query_audit_log(status);
```

**Column notes:**

| Column | `/api/query` | `/api/query/raw` |
|--------|-------------|-----------------|
| `client_ip` | `X-Forwarded-For` header or `Request.client.host` | Same |
| `cf_access_email` | `Cf-Access-Authenticated-User-Email` header (injected by Cloudflare Access) | Same |
| `endpoint` | `'/api/query'` | `'/api/query/raw'` |
| `question` | `req.question` | NULL |
| `layer` | `req.layer` | `req.layer` |
| `rewriter_confidence` | From Haiku rewriter result | NULL |
| `generated_sql` | AI-generated SQL before repair | User-provided SQL |
| `executed_sql` | What actually ran (differs if repaired) | Same as `generated_sql` |
| `was_repaired` | `True` if `sql_repair` modified the query | Always `False` |
| `status` | See status mapping below | See status mapping below |
| `row_count` | Rows returned on success; NULL on error | Same |
| `duration_ms` | Full endpoint wall-clock time (schema lookup + Haiku rewrite + Sonnet SQL gen + execution + optional repair) | Full endpoint wall-clock time (validation + execution) |
| `error_message` | Sanitized error description; NOT raw Postgres exceptions | Same |

**Status mapping to `query.py` error paths:**

| Error path | HTTP status | `status` value |
|------------|-------------|---------------|
| DB connection failed (line 26) | 500 | `connection_error` |
| Unanswerable question (line 40) | 422 | `unanswerable` |
| AI service unavailable (line 62) | 502 | `ai_error` |
| AI returned no SQL (line 68) | 400 | `ai_error` |
| SQL validation failed (line 74) | 400 | `validation_error` |
| Query timeout (line 81) | 408 | `timeout` |
| Query error + repair failed (line 108) | 400 | `error` |
| Query error + repair succeeded (line 99) | 200 | `success` (with `was_repaired=True`) |
| Success (line 115) | 200 | `success` |

### Execution model: FastAPI `BackgroundTasks`

The audit INSERT runs **after** the response is sent using FastAPI's `BackgroundTasks` dependency. This means:

- Audit logging never adds latency to the API response
- Audit logging failures never cause a 500 on the query endpoint
- No second DB connection is held open during query execution

Both endpoints gain a `background_tasks: BackgroundTasks` parameter. At each exit path, the handler calls `background_tasks.add_task(log_query_audit, ...)` before returning.

### Implementation note: capture original SQL before repair

In `query.py`, the variable `sql` is overwritten after repair (line 100: `sql = repaired_sql`). The implementer must capture `original_sql = sql` before the repair block so `generated_sql` and `executed_sql` can differ in the audit log.

### New service: `api/services/audit_logger.py`

Single function `log_query_audit()` that:

1. Accepts all audit fields as keyword arguments
2. Opens a Postgres connection
3. INSERTs one row using **parameterized queries** (`%s` placeholders — never string interpolation, since `generated_sql` and `error_message` contain arbitrary text)
4. Commits and closes
5. On any exception: logs to stderr via Python logger, does NOT raise

```python
def log_query_audit(
    *,
    client_ip: str | None,
    cf_access_email: str | None,
    endpoint: str,
    question: str | None = None,
    layer: str | None = None,
    rewriter_confidence: str | None = None,
    generated_sql: str | None = None,
    executed_sql: str | None = None,
    was_repaired: bool = False,
    status: str,
    row_count: int | None = None,
    duration_ms: int | None = None,
    error_message: str | None = None,
) -> None:
```

### Modified file: `api/routers/query.py`

Both endpoints gain:

1. `request: Request` parameter from FastAPI (for IP and headers)
2. `background_tasks: BackgroundTasks` parameter from FastAPI
3. `time.time()` at entry for duration calculation
4. `background_tasks.add_task(log_query_audit, ...)` at every exit path

### Retention

The table will grow at ~50 rows/day at current usage (~18K rows/year). TEXT columns (`generated_sql`, `executed_sql`) are the largest. At this scale, no partitioning or pruning is needed. Revisit at 100K+ rows or if storage becomes a concern — a simple `DELETE WHERE requested_at < NOW() - INTERVAL '90 days'` cron would suffice.

## Files

| File | Action |
|------|--------|
| `infrastructure/postgres/init/02-create-audit-log.sql` | **New** — DDL for `query_audit_log` table + indexes |
| `api/services/audit_logger.py` | **New** — `log_query_audit()` function |
| `api/routers/query.py` | **Modify** — add `Request`, `BackgroundTasks`, timing, audit calls to both endpoints |

## Queries the audit log enables

```sql
-- What queries ran last week?
SELECT requested_at, cf_access_email, question, status, duration_ms
FROM public.query_audit_log
WHERE requested_at > NOW() - INTERVAL '7 days'
ORDER BY requested_at DESC;

-- Error rate by day
SELECT requested_at::date AS day,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'success') AS success,
       COUNT(*) FILTER (WHERE status != 'success') AS errors
FROM public.query_audit_log
GROUP BY 1 ORDER BY 1;

-- Did sql_repair help?
SELECT was_repaired, status, COUNT(*)
FROM public.query_audit_log
GROUP BY 1, 2;

-- Who's using it?
SELECT cf_access_email, COUNT(*), MAX(requested_at) AS last_query
FROM public.query_audit_log
GROUP BY 1 ORDER BY 2 DESC;
```

## Deployment

1. For existing VPS Postgres: run the DDL manually (`psql < 02-create-audit-log.sql`)
2. For fresh deploys: Docker `initdb.d` picks it up automatically (files run in alphabetical order)
3. Rebuild and restart API container: `docker compose up -d --build api`

## Testing

Test files: `api/tests/unit/test_audit_logger.py`

1. **Unit test — happy path:** `log_query_audit()` writes a row; read it back and verify all fields
2. **Unit test — failure mode:** Mock `psycopg2.connect` to raise inside `log_query_audit()`; verify it logs to stderr and does not raise
3. **Integration test:** Hit `/api/query` and verify an audit row exists with correct `endpoint`, `status`, and `cf_access_email`
