import logging

import psycopg2
from fastapi import APIRouter, HTTPException

from api.config import DATABASE_URL

logger = logging.getLogger(__name__)
from api.models.requests import QueryRequest, RawQueryRequest
from api.models.responses import ErrorResponse, QueryResponse
from api.services.ai_service import generate_sql
from api.services.query_executor import execute_query, validate_sql
from api.services.schema_context import build_system_prompt, get_schema_metadata
from api.services.query_rewriter import rewrite_question
from api.services.sql_repair import attempt_repair

router = APIRouter()


@router.post("/api/query", response_model=QueryResponse)
def query(req: QueryRequest):
    # 1. Build schema context
    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        schema = get_schema_metadata(conn, layer=req.layer)
    finally:
        conn.close()

    # 2. Rewrite question via Haiku
    rewriter_result = rewrite_question(req.question, schema)

    # Short-circuit unanswerable questions
    if rewriter_result.confidence == "unanswerable":
        reason = rewriter_result.unanswerable_reason or "This question requires data that isn't available in the warehouse yet."
        hint = rewriter_result.partial_answer_hint
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

    # Use enriched question if rewriter provided one, otherwise original
    question_for_sonnet = rewriter_result.rewritten_question or req.question

    try:
        sql, explanation = generate_sql(
            question_for_sonnet,
            system_prompt,
            technical_instructions=rewriter_result.technical_instructions,
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="The AI service is temporarily unavailable. Please try again in a moment.",
        )

    if sql is None:
        raise HTTPException(
            status_code=400,
            detail="I wasn't sure how to translate that into a query. Try being more specific about what data you want.",
        )

    # 4. Validate SQL
    error = validate_sql(sql)
    if error:
        raise HTTPException(status_code=400, detail=error)

    # 5. Execute with guardrails + auto-repair on failure
    try:
        columns, rows = execute_query(sql)
    except psycopg2.extensions.QueryCanceledError:
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
                raise HTTPException(
                    status_code=400,
                    detail="The generated SQL had an error. Try rephrasing, or use a simpler question.",
                )
            try:
                columns, rows = execute_query(repaired_sql)
                sql = repaired_sql
                logger.info("SQL repair succeeded")
            except Exception as retry_exc:
                logger.error("SQL repair retry failed: %s | SQL: %s", retry_exc, repaired_sql)
                raise HTTPException(
                    status_code=400,
                    detail="The generated SQL had an error. Try rephrasing, or use a simpler question.",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="The generated SQL had an error. Try rephrasing, or use a simpler question.",
            )

    # 6. Return results with confidence
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
def query_raw(req: RawQueryRequest):
    """Execute user-written SQL with guardrails (SELECT-only, timeout, row limit)."""
    error = validate_sql(req.sql)
    if error:
        raise HTTPException(status_code=400, detail=error)

    try:
        columns, rows = execute_query(req.sql)
    except psycopg2.extensions.QueryCanceledError:
        raise HTTPException(status_code=408, detail="Query timed out")
    except Exception as exc:
        logger.error("Raw query execution failed: %s | SQL: %s", exc, req.sql)
        raise HTTPException(status_code=400, detail="Query execution error")

    return QueryResponse(
        sql=req.sql,
        columns=columns,
        results=rows,
        row_count=len(rows),
        explanation="User-provided SQL query",
    )
