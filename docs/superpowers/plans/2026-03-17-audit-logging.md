# Audit Logging (IN-4) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Postgres-backed audit trail that records every `/api/query` and `/api/query/raw` request — who asked, what SQL was generated/executed, and the outcome.

**Architecture:** A new `query_audit_log` table in `public` schema, a `log_query_audit()` service function, and `BackgroundTasks` integration in both query router endpoints. The audit INSERT runs after the response is sent — zero added latency.

**Tech Stack:** psycopg2, FastAPI BackgroundTasks, pytest + unittest.mock

**Spec:** `docs/superpowers/specs/2026-03-17-audit-logging-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `infrastructure/postgres/init/02-create-audit-log.sql` | Create | DDL for `query_audit_log` table + indexes |
| `api/services/audit_logger.py` | Create | `log_query_audit()` — parameterized INSERT, fire-and-forget |
| `api/tests/unit/test_audit_logger.py` | Create | Unit tests for `log_query_audit()` |
| `api/routers/query.py` | Modify | Add `Request`, `BackgroundTasks`, timing, audit calls at every exit path |
| `api/tests/unit/test_raw_query_endpoint.py` | Modify | Update mocks for new `BackgroundTasks` parameter |

---

## Task 1: DDL — Create the audit table

**Files:**
- Create: `infrastructure/postgres/init/02-create-audit-log.sql`

- [ ] **Step 1: Write the DDL file**

```sql
-- Query audit log — records every /api/query and /api/query/raw request
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

CREATE INDEX IF NOT EXISTS idx_query_audit_log_requested_at
    ON public.query_audit_log(requested_at);
CREATE INDEX IF NOT EXISTS idx_query_audit_log_cf_access_email
    ON public.query_audit_log(cf_access_email);
CREATE INDEX IF NOT EXISTS idx_query_audit_log_status
    ON public.query_audit_log(status);
```

- [ ] **Step 2: Commit**

```bash
git add infrastructure/postgres/init/02-create-audit-log.sql
git commit -m "feat(IN-4): add query_audit_log DDL"
```

---

## Task 2: Audit logger service — tests first

**Files:**
- Create: `api/services/audit_logger.py`
- Create: `api/tests/unit/test_audit_logger.py`

- [ ] **Step 1: Write the failing tests**

Create `api/tests/unit/test_audit_logger.py`:

```python
from unittest.mock import MagicMock, patch, call
import logging

from api.services.audit_logger import log_query_audit


class TestLogQueryAudit:
    """Tests for the audit logger service."""

    @patch("api.services.audit_logger.psycopg2.connect")
    def test_inserts_row_with_all_fields(self, mock_connect):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur

        log_query_audit(
            client_ip="1.2.3.4",
            cf_access_email="ross@splashworks.com",
            endpoint="/api/query",
            question="How many customers?",
            layer="warehouse",
            rewriter_confidence="high",
            generated_sql="SELECT count(*) FROM dim_customer",
            executed_sql="SELECT count(*) FROM dim_customer",
            was_repaired=False,
            status="success",
            row_count=1,
            duration_ms=1500,
            error_message=None,
        )

        mock_cur.execute.assert_called_once()
        sql_arg = mock_cur.execute.call_args[0][0]
        params = mock_cur.execute.call_args[0][1]

        assert "INSERT INTO public.query_audit_log" in sql_arg
        assert "%s" in sql_arg  # parameterized, not f-string
        assert params[0] == "1.2.3.4"
        assert params[1] == "ross@splashworks.com"
        assert params[2] == "/api/query"
        assert params[3] == "How many customers?"
        assert params[10] == "success"

        mock_conn.commit.assert_called_once()
        mock_conn.close.assert_called_once()

    @patch("api.services.audit_logger.psycopg2.connect")
    def test_inserts_row_with_minimal_fields(self, mock_connect):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur

        log_query_audit(
            client_ip=None,
            cf_access_email=None,
            endpoint="/api/query/raw",
            status="success",
            row_count=5,
            duration_ms=200,
        )

        mock_cur.execute.assert_called_once()
        params = mock_cur.execute.call_args[0][1]
        assert params[0] is None  # client_ip
        assert params[1] is None  # cf_access_email
        assert params[2] == "/api/query/raw"

        mock_conn.commit.assert_called_once()
        mock_conn.close.assert_called_once()

    @patch("api.services.audit_logger.psycopg2.connect")
    def test_does_not_raise_on_db_failure(self, mock_connect, caplog):
        mock_connect.side_effect = Exception("Connection refused")

        # Must not raise
        log_query_audit(
            client_ip="1.2.3.4",
            cf_access_email=None,
            endpoint="/api/query",
            status="success",
        )

        assert any("Audit log failed" in r.message for r in caplog.records)

    @patch("api.services.audit_logger.psycopg2.connect")
    def test_closes_connection_on_insert_failure(self, mock_connect, caplog):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        mock_cur.execute.side_effect = Exception("INSERT failed")

        log_query_audit(
            client_ip="1.2.3.4",
            cf_access_email=None,
            endpoint="/api/query",
            status="error",
        )

        mock_conn.close.assert_called_once()
        assert any("Audit log failed" in r.message for r in caplog.records)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/rosssivertsen/dev/clientwork/splashworks/splashworks-data-warehouse && python -m pytest api/tests/unit/test_audit_logger.py -v`

Expected: `ModuleNotFoundError: No module named 'api.services.audit_logger'`

- [ ] **Step 3: Write the implementation**

Create `api/services/audit_logger.py`:

```python
import logging

import psycopg2

from api.config import DATABASE_URL

logger = logging.getLogger(__name__)

INSERT_SQL = """
    INSERT INTO public.query_audit_log (
        client_ip, cf_access_email, endpoint, question, layer,
        rewriter_confidence, generated_sql, executed_sql, was_repaired,
        status, row_count, duration_ms, error_message
    ) VALUES (
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s,
        %s, %s, %s, %s
    )
"""


def log_query_audit(
    *,
    client_ip: str | None = None,
    cf_access_email: str | None = None,
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
    """Write one row to query_audit_log. Never raises — logs errors to stderr."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        try:
            cur = conn.cursor()
            cur.execute(INSERT_SQL, (
                client_ip, cf_access_email, endpoint, question, layer,
                rewriter_confidence, generated_sql, executed_sql, was_repaired,
                status, row_count, duration_ms, error_message,
            ))
            conn.commit()
            cur.close()
        finally:
            conn.close()
    except Exception:
        logger.exception("Audit log failed")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/rosssivertsen/dev/clientwork/splashworks/splashworks-data-warehouse && python -m pytest api/tests/unit/test_audit_logger.py -v`

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add api/services/audit_logger.py api/tests/unit/test_audit_logger.py
git commit -m "feat(IN-4): add audit logger service with tests"
```

---

## Task 3: Wire audit logging into query endpoints

**Files:**
- Modify: `api/routers/query.py`
- Modify: `api/tests/unit/test_raw_query_endpoint.py`

- [ ] **Step 1: Modify `query.py` — add imports, Request, BackgroundTasks, timing, and audit calls**

The full replacement for `api/routers/query.py`:

```python
import logging
import time

import psycopg2
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from api.config import DATABASE_URL
from api.models.requests import QueryRequest, RawQueryRequest
from api.models.responses import QueryResponse
from api.services.ai_service import generate_sql
from api.services.audit_logger import log_query_audit
from api.services.query_executor import execute_query, validate_sql
from api.services.query_rewriter import rewrite_question
from api.services.schema_context import build_system_prompt, get_schema_metadata
from api.services.sql_repair import attempt_repair

logger = logging.getLogger(__name__)
router = APIRouter()


def _client_ip(request: Request) -> str | None:
    """Extract client IP from X-Forwarded-For header or connection info."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _cf_email(request: Request) -> str | None:
    """Extract Cloudflare Access authenticated user email."""
    return request.headers.get("cf-access-authenticated-user-email")


def _elapsed_ms(start: float) -> int:
    return int((time.time() - start) * 1000)


@router.post("/api/query", response_model=QueryResponse)
def query(req: QueryRequest, request: Request, background_tasks: BackgroundTasks):
    start = time.time()
    audit = dict(
        client_ip=_client_ip(request),
        cf_access_email=_cf_email(request),
        endpoint="/api/query",
        question=req.question,
        layer=req.layer,
    )

    # 1. Build schema context
    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception:
        background_tasks.add_task(
            log_query_audit, **audit, status="connection_error",
            duration_ms=_elapsed_ms(start),
            error_message="Database connection failed",
        )
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        schema = get_schema_metadata(conn, layer=req.layer)
    finally:
        conn.close()

    # 2. Rewrite question via Haiku
    rewriter_result = rewrite_question(req.question, schema)
    audit["rewriter_confidence"] = rewriter_result.confidence

    # Short-circuit unanswerable questions
    if rewriter_result.confidence == "unanswerable":
        reason = rewriter_result.unanswerable_reason or "This question requires data that isn't available in the warehouse yet."
        hint = rewriter_result.partial_answer_hint
        background_tasks.add_task(
            log_query_audit, **audit, status="unanswerable",
            duration_ms=_elapsed_ms(start),
            error_message=reason,
        )
        raise HTTPException(
            status_code=422,
            detail={
                "message": reason,
                "partial_answer_hint": hint,
                "confidence": "unanswerable",
            },
        )

    # 3. Build system prompt and generate SQL
    system_prompt = build_system_prompt(schema, layer=req.layer)
    question_for_sonnet = rewriter_result.rewritten_question or req.question

    try:
        sql, explanation = generate_sql(
            question_for_sonnet,
            system_prompt,
            technical_instructions=rewriter_result.technical_instructions,
        )
    except Exception:
        background_tasks.add_task(
            log_query_audit, **audit, status="ai_error",
            duration_ms=_elapsed_ms(start),
            error_message="AI service unavailable",
        )
        raise HTTPException(
            status_code=502,
            detail="The AI service is temporarily unavailable. Please try again in a moment.",
        )

    if sql is None:
        background_tasks.add_task(
            log_query_audit, **audit, status="ai_error",
            duration_ms=_elapsed_ms(start),
            error_message="AI returned no SQL",
        )
        raise HTTPException(
            status_code=400,
            detail="I wasn't sure how to translate that into a query. Try being more specific about what data you want.",
        )

    # 4. Validate SQL
    error = validate_sql(sql)
    if error:
        background_tasks.add_task(
            log_query_audit, **audit, status="validation_error",
            generated_sql=sql, duration_ms=_elapsed_ms(start),
            error_message=error,
        )
        raise HTTPException(status_code=400, detail=error)

    # 5. Execute with guardrails + auto-repair on failure
    original_sql = sql
    was_repaired = False

    try:
        columns, rows = execute_query(sql)
    except psycopg2.extensions.QueryCanceledError:
        background_tasks.add_task(
            log_query_audit, **audit, status="timeout",
            generated_sql=original_sql, executed_sql=original_sql,
            duration_ms=_elapsed_ms(start),
            error_message="Query timed out",
        )
        raise HTTPException(
            status_code=408,
            detail="This question requires a complex query that took too long. Try narrowing it — e.g., add a company name or date range.",
        )
    except Exception as exc:
        logger.warning("Query execution failed: %s | SQL: %s", exc, sql)

        # Attempt auto-repair and retry once
        repaired_sql = attempt_repair(sql, str(exc))
        if repaired_sql:
            repair_error = validate_sql(repaired_sql)
            if repair_error:
                background_tasks.add_task(
                    log_query_audit, **audit, status="error",
                    generated_sql=original_sql, executed_sql=repaired_sql,
                    was_repaired=True, duration_ms=_elapsed_ms(start),
                    error_message="Repair produced invalid SQL",
                )
                raise HTTPException(
                    status_code=400,
                    detail="The generated SQL had an error. Try rephrasing, or use a simpler question.",
                )
            try:
                columns, rows = execute_query(repaired_sql)
                sql = repaired_sql
                was_repaired = True
                logger.info("SQL repair succeeded")
            except Exception as retry_exc:
                logger.error("SQL repair retry failed: %s | SQL: %s", retry_exc, repaired_sql)
                background_tasks.add_task(
                    log_query_audit, **audit, status="error",
                    generated_sql=original_sql, executed_sql=repaired_sql,
                    was_repaired=True, duration_ms=_elapsed_ms(start),
                    error_message="Repair retry failed",
                )
                raise HTTPException(
                    status_code=400,
                    detail="The generated SQL had an error. Try rephrasing, or use a simpler question.",
                )
        else:
            background_tasks.add_task(
                log_query_audit, **audit, status="error",
                generated_sql=original_sql, executed_sql=original_sql,
                duration_ms=_elapsed_ms(start),
                error_message="Query execution failed",
            )
            raise HTTPException(
                status_code=400,
                detail="The generated SQL had an error. Try rephrasing, or use a simpler question.",
            )

    # 6. Return results with confidence
    background_tasks.add_task(
        log_query_audit, **audit, status="success",
        generated_sql=original_sql, executed_sql=sql,
        was_repaired=was_repaired,
        row_count=len(rows), duration_ms=_elapsed_ms(start),
    )
    return QueryResponse(
        sql=sql,
        columns=columns,
        results=rows,
        row_count=len(rows),
        explanation=explanation,
        confidence=rewriter_result.confidence,
        unanswerable_reason=rewriter_result.unanswerable_reason,
        partial_answer_hint=rewriter_result.partial_answer_hint,
    )


@router.post("/api/query/raw", response_model=QueryResponse)
def query_raw(req: RawQueryRequest, request: Request, background_tasks: BackgroundTasks):
    """Execute user-written SQL with guardrails (SELECT-only, timeout, row limit)."""
    start = time.time()
    audit = dict(
        client_ip=_client_ip(request),
        cf_access_email=_cf_email(request),
        endpoint="/api/query/raw",
        layer=req.layer,
        generated_sql=req.sql,
    )

    error = validate_sql(req.sql)
    if error:
        background_tasks.add_task(
            log_query_audit, **audit, status="validation_error",
            duration_ms=_elapsed_ms(start), error_message=error,
        )
        raise HTTPException(status_code=400, detail=error)

    try:
        columns, rows = execute_query(req.sql)
    except psycopg2.extensions.QueryCanceledError:
        background_tasks.add_task(
            log_query_audit, **audit, status="timeout",
            executed_sql=req.sql, duration_ms=_elapsed_ms(start),
            error_message="Query timed out",
        )
        raise HTTPException(status_code=408, detail="Query timed out")
    except Exception as exc:
        logger.error("Raw query execution failed: %s | SQL: %s", exc, req.sql)
        background_tasks.add_task(
            log_query_audit, **audit, status="error",
            executed_sql=req.sql, duration_ms=_elapsed_ms(start),
            error_message="Query execution error",
        )
        raise HTTPException(status_code=400, detail="Query execution error")

    background_tasks.add_task(
        log_query_audit, **audit, status="success",
        executed_sql=req.sql, row_count=len(rows),
        duration_ms=_elapsed_ms(start),
    )
    return QueryResponse(
        sql=req.sql,
        columns=columns,
        results=rows,
        row_count=len(rows),
        explanation="User-provided SQL query",
    )
```

- [ ] **Step 2: Update `test_raw_query_endpoint.py` — add audit logger mock**

The existing tests mock `execute_query` but now the endpoint also calls `log_query_audit` via `BackgroundTasks`. FastAPI's `TestClient` executes background tasks synchronously, so `log_query_audit` will try to connect to Postgres and fail with noisy log output. Fix: add an `autouse` fixture that silences audit calls for all tests in the file.

Add this fixture at the top of the file (after `client = TestClient(app)`):

```python
@pytest.fixture(autouse=True)
def _mock_audit(monkeypatch):
    monkeypatch.setattr("api.routers.query.log_query_audit", lambda **kwargs: None)
```

And add the `pytest` import:

```python
import pytest
```

No changes needed to individual test functions — the fixture applies to all tests automatically.

- [ ] **Step 3: Run the full test suite to verify nothing is broken**

Run: `cd /Users/rosssivertsen/dev/clientwork/splashworks/splashworks-data-warehouse && python -m pytest api/tests/unit/ -v`

Expected: All existing tests pass + the 4 new audit logger tests pass

- [ ] **Step 4: Commit**

```bash
git add api/routers/query.py api/tests/unit/test_raw_query_endpoint.py
git commit -m "feat(IN-4): wire audit logging into query endpoints"
```

---

## Task 4: Deploy to VPS

- [ ] **Step 1: Create the table on the existing VPS Postgres**

```bash
ssh root@76.13.29.44 "docker exec -i splashworks-postgres psql -U splashworks -d splashworks" < infrastructure/postgres/init/02-create-audit-log.sql
```

Expected: `CREATE TABLE` / `CREATE INDEX` output (no errors)

- [ ] **Step 2: Push to main and rebuild the API container**

```bash
git push origin main
ssh root@76.13.29.44 "cd /opt/splashworks && git pull && docker compose up -d --build api"
```

- [ ] **Step 3: Verify — make a test query and check the audit log**

```bash
# Hit the API
ssh root@76.13.29.44 'curl -s http://localhost:8080/api/query/raw -H "Content-Type: application/json" -d "{\"sql\": \"SELECT 1 AS test\"}" | python3 -m json.tool'

# Check the audit log
ssh root@76.13.29.44 "docker exec splashworks-postgres psql -U splashworks -d splashworks -c \"SELECT id, requested_at, endpoint, status, duration_ms FROM public.query_audit_log ORDER BY id DESC LIMIT 5;\""
```

Expected: One row with `endpoint='/api/query/raw'`, `status='success'`

- [ ] **Step 4: Commit any deployment fixes if needed, then tag**

```bash
git tag in-4-audit-logging
git push origin in-4-audit-logging
```
