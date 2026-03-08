import psycopg2
from fastapi import APIRouter, HTTPException

from api.config import DATABASE_URL
from api.models.requests import QueryRequest, RawQueryRequest
from api.models.responses import ErrorResponse, QueryResponse
from api.services.ai_service import generate_sql
from api.services.query_executor import execute_query, validate_sql
from api.services.schema_context import build_system_prompt, get_schema_metadata

router = APIRouter()


@router.post("/api/query", response_model=QueryResponse)
def query(req: QueryRequest):
    # 1. Build schema context
    try:
        conn = psycopg2.connect(DATABASE_URL)
        schema = get_schema_metadata(conn, layer=req.layer)
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {e}")

    system_prompt = build_system_prompt(schema, layer=req.layer)

    # 2. Generate SQL via Claude
    try:
        sql, explanation = generate_sql(req.question, system_prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")

    if sql is None:
        raise HTTPException(
            status_code=400,
            detail="Could not generate SQL from the question. Try rephrasing.",
        )

    # 3. Validate SQL
    error = validate_sql(sql)
    if error:
        raise HTTPException(status_code=400, detail=error)

    # 4. Execute with guardrails
    try:
        columns, rows = execute_query(sql)
    except psycopg2.extensions.QueryCanceledError:
        raise HTTPException(status_code=408, detail=f"Query timed out: {sql}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query execution error: {e}")

    # 5. Return results
    return QueryResponse(
        sql=sql,
        columns=columns,
        results=rows,
        row_count=len(rows),
        explanation=explanation,
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
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query execution error: {e}")

    return QueryResponse(
        sql=req.sql,
        columns=columns,
        results=rows,
        row_count=len(rows),
        explanation="User-provided SQL query",
    )
