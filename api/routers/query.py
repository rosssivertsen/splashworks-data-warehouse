import logging
import time

import psycopg2
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from api.config import DATABASE_URL
from api.rate_limit import limiter
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
    """Extract client IP, preferring Cloudflare's verified header.

    CF-Connecting-IP is set by Cloudflare's edge and cannot be spoofed by clients.
    X-Forwarded-For is client-supplied and unreliable for attribution.
    """
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _cf_email(request: Request) -> str | None:
    """Extract Cloudflare Access authenticated user email from validated JWT."""
    return getattr(request.state, "cf_user_email", None)


def _elapsed_ms(start: float) -> int:
    return int((time.time() - start) * 1000)


@router.post("/api/query", response_model=QueryResponse)
@limiter.limit("20/minute")
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
@limiter.limit("30/minute")
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
