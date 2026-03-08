# Phase 1 Batch B: FastAPI Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Get a minimal FastAPI backend serving NL→SQL→results against the Postgres warehouse, verified with curl on the VPS.

**Architecture:** FastAPI receives a question, builds a schema-aware system prompt, calls Claude to generate SQL, validates the SQL is SELECT-only, executes it against Postgres with timeout/row-limit guardrails, and returns structured results. Two endpoints: POST /api/query and GET /api/health.

**Tech Stack:** FastAPI, uvicorn, psycopg2-binary, anthropic, pyyaml, pytest, httpx

**Design Doc:** `docs/plans/2026-03-09-phase1-batch-b-fastapi-backend-design.md`

---

## Task 1: Project Scaffold + Health Endpoint

**Files:**
- Create: `api/__init__.py`
- Create: `api/config.py`
- Create: `api/main.py`
- Create: `api/routers/__init__.py`
- Create: `api/routers/health.py`
- Create: `api/models/__init__.py`
- Create: `api/models/responses.py`
- Create: `api/requirements.txt`
- Create: `api/tests/__init__.py`
- Create: `api/tests/unit/__init__.py`
- Create: `api/tests/integration/__init__.py`
- Create: `api/tests/integration/test_health_endpoint.py`

**Step 1: Create `api/requirements.txt`**

```
fastapi>=0.115.0
uvicorn>=0.30.0
psycopg2-binary>=2.9.9
anthropic>=0.39.0
pyyaml>=6.0
pytest>=8.0.0
httpx>=0.27.0
```

**Step 2: Create `api/config.py`**

```python
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://splashworks:changeme@localhost:5432/splashworks",
)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
STATEMENT_TIMEOUT = os.environ.get("STATEMENT_TIMEOUT", "10s")
ROW_LIMIT = int(os.environ.get("ROW_LIMIT", "10000"))
```

**Step 3: Create `api/models/responses.py`**

```python
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    postgres: str
    last_etl_date: str | None
    last_etl_rows: int | None
    schemas: dict[str, int]
```

**Step 4: Create `api/routers/health.py`**

```python
import psycopg2
from fastapi import APIRouter

from api.config import DATABASE_URL
from api.models.responses import HealthResponse

router = APIRouter()


@router.get("/api/health", response_model=HealthResponse)
def health():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Last ETL run
        cur.execute("""
            SELECT extract_date, sum(row_count)
            FROM public.etl_load_log
            WHERE status = 'completed'
            GROUP BY extract_date
            ORDER BY extract_date DESC
            LIMIT 1
        """)
        row = cur.fetchone()
        last_date = str(row[0]) if row else None
        last_rows = int(row[1]) if row else None

        # Schema object counts
        cur.execute("""
            SELECT schemaname, count(*)
            FROM (
                SELECT schemaname FROM pg_tables
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                UNION ALL
                SELECT schemaname FROM pg_views
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ) x
            GROUP BY schemaname ORDER BY schemaname
        """)
        schemas = {r[0]: r[1] for r in cur.fetchall()}

        cur.close()
        conn.close()

        return HealthResponse(
            status="healthy",
            postgres="connected",
            last_etl_date=last_date,
            last_etl_rows=last_rows,
            schemas=schemas,
        )
    except Exception as e:
        return HealthResponse(
            status="unhealthy",
            postgres=str(e),
            last_etl_date=None,
            last_etl_rows=None,
            schemas={},
        )
```

**Step 5: Create `api/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import health

app = FastAPI(title="Splashworks Warehouse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
```

**Step 6: Create empty `__init__.py` files**

Create empty files at:
- `api/__init__.py`
- `api/routers/__init__.py`
- `api/models/__init__.py`
- `api/tests/__init__.py`
- `api/tests/unit/__init__.py`
- `api/tests/integration/__init__.py`

**Step 7: Write integration test**

`api/tests/integration/test_health_endpoint.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport

from api.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health_returns_200(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("healthy", "unhealthy")
    assert "postgres" in body
    assert "schemas" in body


@pytest.mark.asyncio
async def test_health_shows_etl_data(client):
    resp = await client.get("/api/health")
    body = resp.json()
    if body["status"] == "healthy":
        assert body["last_etl_date"] is not None
        assert body["last_etl_rows"] > 0
        assert "raw_skimmer" in body["schemas"]
```

**Step 8: Set up venv and run tests**

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install pytest-asyncio
```

Run integration test (requires local Postgres running):
```bash
DB_PASSWORD=$(grep DB_PASSWORD ../.env | cut -d= -f2)
DATABASE_URL="postgresql://splashworks:${DB_PASSWORD}@localhost:5432/splashworks" \
  pytest tests/integration/test_health_endpoint.py -v
```

Expected: 2 tests pass (or skip gracefully if no local Postgres).

**Step 9: Verify manually**

```bash
DB_PASSWORD=$(grep DB_PASSWORD ../.env | cut -d= -f2)
DATABASE_URL="postgresql://splashworks:${DB_PASSWORD}@localhost:5432/splashworks" \
  uvicorn api.main:app --host 0.0.0.0 --port 8080
```

In another terminal:
```bash
curl http://localhost:8080/api/health | python3 -m json.tool
```

**Step 10: Commit**

```bash
git add api/
git commit -m "feat: FastAPI scaffold with health endpoint"
```

---

## Task 2: Query Validator (TDD)

**Files:**
- Create: `api/services/__init__.py`
- Create: `api/services/query_executor.py`
- Create: `api/tests/unit/test_query_validator.py`

**Step 1: Write failing tests**

`api/tests/unit/test_query_validator.py`:
```python
from api.services.query_executor import validate_sql


def test_select_allowed():
    assert validate_sql("SELECT * FROM warehouse.dim_customer") is None


def test_select_with_whitespace():
    assert validate_sql("  select count(*) from warehouse.dim_customer  ") is None


def test_select_with_cte():
    sql = "WITH cte AS (SELECT 1) SELECT * FROM cte"
    assert validate_sql(sql) is None


def test_insert_rejected():
    result = validate_sql("INSERT INTO warehouse.dim_customer VALUES (1)")
    assert result is not None
    assert "prohibited" in result.lower() or "not allowed" in result.lower()


def test_update_rejected():
    result = validate_sql("UPDATE warehouse.dim_customer SET name = 'x'")
    assert result is not None


def test_delete_rejected():
    result = validate_sql("DELETE FROM warehouse.dim_customer")
    assert result is not None


def test_drop_rejected():
    result = validate_sql("DROP TABLE warehouse.dim_customer")
    assert result is not None


def test_alter_rejected():
    result = validate_sql("ALTER TABLE warehouse.dim_customer ADD COLUMN x TEXT")
    assert result is not None


def test_multi_statement_rejected():
    result = validate_sql("SELECT 1; DROP TABLE warehouse.dim_customer")
    assert result is not None


def test_semicolon_in_string_allowed():
    sql = "SELECT * FROM warehouse.dim_customer WHERE name = 'foo;bar'"
    assert validate_sql(sql) is None


def test_empty_rejected():
    result = validate_sql("")
    assert result is not None


def test_none_rejected():
    result = validate_sql(None)
    assert result is not None
```

**Step 2: Run tests to verify they fail**

```bash
cd api && source .venv/bin/activate
pytest tests/unit/test_query_validator.py -v
```

Expected: ImportError — `query_executor` doesn't exist yet.

**Step 3: Implement validator**

`api/services/query_executor.py`:
```python
import re

from api.config import DATABASE_URL, ROW_LIMIT, STATEMENT_TIMEOUT

PROHIBITED_KEYWORDS = re.compile(
    r'\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE)\b',
    re.IGNORECASE,
)


def validate_sql(sql: str | None) -> str | None:
    """Validate that SQL is a safe SELECT query.

    Returns None if valid, or an error message string if invalid.
    """
    if not sql or not sql.strip():
        return "Empty query"

    stripped = sql.strip().rstrip(";").strip()

    # Must start with SELECT or WITH (CTE)
    if not re.match(r'^(SELECT|WITH)\b', stripped, re.IGNORECASE):
        return "Only SELECT queries are allowed"

    # Check for prohibited keywords outside of string literals
    # Remove single-quoted strings first to avoid false positives
    no_strings = re.sub(r"'[^']*'", "''", stripped)

    if PROHIBITED_KEYWORDS.search(no_strings):
        return "Prohibited keyword detected — only SELECT queries are allowed"

    # Check for multi-statement (semicolons outside quotes)
    if ";" in no_strings:
        return "Multi-statement queries are not allowed"

    return None
```

Create `api/services/__init__.py` (empty file).

**Step 4: Run tests to verify they pass**

```bash
pytest tests/unit/test_query_validator.py -v
```

Expected: All 12 tests pass.

**Step 5: Commit**

```bash
git add api/services/ api/tests/unit/test_query_validator.py
git commit -m "feat: SQL query validator with TDD (SELECT-only, no DML/DDL)"
```

---

## Task 3: Schema Context Builder

**Files:**
- Create: `api/services/schema_context.py`
- Create: `api/tests/unit/test_schema_context.py`

The schema context builder reads live table/column metadata from Postgres and combines it with the semantic layer YAML to produce a system prompt for Claude.

**Step 1: Write failing tests**

`api/tests/unit/test_schema_context.py`:
```python
from api.services.schema_context import build_system_prompt, load_semantic_layer


def test_load_semantic_layer():
    """Semantic layer YAML loads without error."""
    sl = load_semantic_layer()
    assert "business_terms" in sl
    assert "relationships" in sl


def test_build_prompt_warehouse_layer():
    """Prompt for warehouse layer mentions warehouse tables."""
    # Use a fake schema dict to avoid needing Postgres
    schema = {
        "public_warehouse": {
            "dim_customer": ["company_id", "customer_id", "clean_customer_name"],
            "fact_labor": ["company_id", "service_stop_id", "minutes_at_stop"],
        },
        "public_semantic": {
            "service_completion": ["company_id", "service_date", "service_status"],
        },
    }
    prompt = build_system_prompt(schema, layer="warehouse")
    assert "dim_customer" in prompt
    assert "fact_labor" in prompt
    assert "service_completion" in prompt
    assert "SELECT" in prompt  # instructs AI to generate SELECT


def test_build_prompt_staging_layer():
    """Prompt for staging layer mentions staging tables, not warehouse."""
    schema = {
        "public_staging": {
            "stg_customer": ["_company_name", "customer_id", "first_name"],
        },
    }
    prompt = build_system_prompt(schema, layer="staging")
    assert "stg_customer" in prompt
    assert "dim_customer" not in prompt


def test_build_prompt_includes_semantic_context():
    """Prompt includes business terms from semantic layer."""
    schema = {
        "public_warehouse": {
            "dim_customer": ["customer_id"],
        },
    }
    prompt = build_system_prompt(schema, layer="warehouse")
    # Should include semantic layer context if YAML exists
    assert "chlorine" in prompt.lower() or "business" in prompt.lower()
```

**Step 2: Run tests to verify they fail**

```bash
pytest tests/unit/test_schema_context.py -v
```

Expected: ImportError.

**Step 3: Implement schema context builder**

`api/services/schema_context.py`:
```python
from pathlib import Path

import yaml

SEMANTIC_LAYER_PATH = Path(__file__).resolve().parent.parent.parent / "docs" / "skimmer-semantic-layer.yaml"

LAYER_SCHEMAS = {
    "warehouse": ["public_warehouse", "public_semantic"],
    "staging": ["public_staging"],
}


def load_semantic_layer() -> dict:
    """Load the semantic layer YAML file."""
    if not SEMANTIC_LAYER_PATH.exists():
        return {}
    with open(SEMANTIC_LAYER_PATH) as f:
        return yaml.safe_load(f) or {}


def get_schema_metadata(conn, layer: str = "warehouse") -> dict[str, dict[str, list[str]]]:
    """Query Postgres information_schema for table/column metadata.

    Returns: {schema_name: {table_name: [col1, col2, ...]}}
    """
    schemas = LAYER_SCHEMAS.get(layer, LAYER_SCHEMAS["warehouse"])
    placeholders = ",".join(["%s"] * len(schemas))

    cur = conn.cursor()
    cur.execute(f"""
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE table_schema IN ({placeholders})
        ORDER BY table_schema, table_name, ordinal_position
    """, schemas)

    result: dict[str, dict[str, list[str]]] = {}
    for schema, table, column in cur.fetchall():
        result.setdefault(schema, {}).setdefault(table, []).append(column)
    cur.close()
    return result


def build_system_prompt(schema: dict[str, dict[str, list[str]]], layer: str = "warehouse") -> str:
    """Build the system prompt for Claude with schema + semantic context."""
    lines = [
        "You are a SQL query generator for a pool service data warehouse (PostgreSQL).",
        "Generate ONLY a SELECT query. Do not include any explanation before or after the SQL.",
        "Wrap the SQL in ```sql and ``` markers.",
        "",
        f"You are querying the {'warehouse and semantic' if layer == 'warehouse' else 'staging'} layer.",
        "",
        "## Available Tables and Columns",
        "",
    ]

    for schema_name, tables in schema.items():
        for table_name, columns in tables.items():
            fq = f'{schema_name}.{table_name}'
            cols = ", ".join(columns)
            lines.append(f"- **{fq}**: {cols}")

    # Add semantic layer context
    sl = load_semantic_layer()
    if sl:
        lines.append("")
        lines.append("## Business Context")
        lines.append("")

        if "business_terms" in sl:
            for term, info in sl["business_terms"].items():
                desc = info.get("description", "")
                lines.append(f"- **{term}**: {desc}")

        if "relationships" in sl:
            lines.append("")
            lines.append("## Key Relationships")
            lines.append("")
            for rel_name, info in sl["relationships"].items():
                desc = info.get("description", "")
                lines.append(f"- **{rel_name}**: {desc}")

        if "verified_queries" in sl:
            lines.append("")
            lines.append("## Example Verified Queries")
            lines.append("")
            for vq in sl["verified_queries"]:
                q = vq.get("question", "")
                lines.append(f"- Q: {q}")

    lines.append("")
    lines.append("## Important Rules")
    lines.append("- Service completion sentinel: '2010-01-01 12:00:00' means NOT completed")
    lines.append("- Active customer filter: is_inactive = 0")
    lines.append("- _company_name column distinguishes companies: 'AQPS' or 'JOMO'")
    lines.append("- Always qualify table names with schema (e.g., public_warehouse.dim_customer)")
    lines.append("- Use double quotes for column names only if they contain special characters")

    return "\n".join(lines)
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/unit/test_schema_context.py -v
```

Expected: All 4 tests pass.

**Step 5: Commit**

```bash
git add api/services/schema_context.py api/tests/unit/test_schema_context.py
git commit -m "feat: schema context builder for AI system prompt"
```

---

## Task 4: AI Service (Anthropic)

**Files:**
- Create: `api/services/ai_service.py`
- Create: `api/tests/unit/test_ai_service.py`

**Step 1: Write failing tests**

`api/tests/unit/test_ai_service.py`:
```python
from api.services.ai_service import extract_sql_from_response


def test_extract_sql_from_markdown_block():
    response = "Here's the query:\n```sql\nSELECT count(*) FROM dim_customer\n```"
    sql = extract_sql_from_response(response)
    assert sql == "SELECT count(*) FROM dim_customer"


def test_extract_sql_from_plain_text():
    response = "SELECT count(*) FROM dim_customer"
    sql = extract_sql_from_response(response)
    assert sql == "SELECT count(*) FROM dim_customer"


def test_extract_sql_multiline():
    response = """```sql
SELECT
    _company_name,
    count(*) as total
FROM public_warehouse.dim_customer
GROUP BY 1
```"""
    sql = extract_sql_from_response(response)
    assert "SELECT" in sql
    assert "GROUP BY" in sql


def test_extract_sql_with_explanation():
    response = """I'll query the customer dimension.

```sql
SELECT count(*) FROM public_warehouse.dim_customer
```

This counts all customers."""
    sql = extract_sql_from_response(response)
    assert sql == "SELECT count(*) FROM public_warehouse.dim_customer"


def test_extract_sql_empty_response():
    sql = extract_sql_from_response("")
    assert sql is None


def test_extract_sql_no_sql_in_response():
    sql = extract_sql_from_response("I don't understand the question.")
    assert sql is None
```

**Step 2: Run tests to verify they fail**

```bash
pytest tests/unit/test_ai_service.py -v
```

Expected: ImportError.

**Step 3: Implement AI service**

`api/services/ai_service.py`:
```python
import re

import anthropic

from api.config import ANTHROPIC_API_KEY


def extract_sql_from_response(text: str) -> str | None:
    """Extract SQL from Claude's response.

    Looks for ```sql ... ``` blocks first, then falls back to
    detecting a bare SELECT/WITH statement.
    """
    if not text or not text.strip():
        return None

    # Try to find SQL in markdown code block
    match = re.search(r'```(?:sql)?\s*\n?(.*?)```', text, re.DOTALL)
    if match:
        sql = match.group(1).strip()
        if sql:
            return sql

    # Fallback: look for a line starting with SELECT or WITH
    for line in text.split("\n"):
        stripped = line.strip()
        if re.match(r'^(SELECT|WITH)\b', stripped, re.IGNORECASE):
            # Grab from this line to end (multi-line SQL)
            idx = text.index(line)
            candidate = text[idx:].strip()
            # Stop at a blank line or non-SQL content
            lines = []
            for l in candidate.split("\n"):
                if not l.strip() and lines:
                    break
                lines.append(l)
            return "\n".join(lines).strip()

    return None


def generate_sql(question: str, system_prompt: str) -> tuple[str | None, str]:
    """Call Claude to generate SQL from a natural language question.

    Returns (sql, full_response_text).
    """
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=system_prompt,
        messages=[
            {"role": "user", "content": question},
        ],
    )

    response_text = message.content[0].text
    sql = extract_sql_from_response(response_text)
    return sql, response_text
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/unit/test_ai_service.py -v
```

Expected: All 6 tests pass (these only test `extract_sql_from_response`, not the API call).

**Step 5: Commit**

```bash
git add api/services/ai_service.py api/tests/unit/test_ai_service.py
git commit -m "feat: AI service with SQL extraction from Claude response"
```

---

## Task 5: Query Execution Service

**Files:**
- Modify: `api/services/query_executor.py` (add `execute_query` function)

**Step 1: Add execution function to `query_executor.py`**

Append to the existing file:

```python
import psycopg2
import psycopg2.extras


def execute_query(sql: str, database_url: str = None) -> tuple[list[str], list[list]]:
    """Execute a validated SELECT query against Postgres.

    Applies statement timeout and row limit guardrails.
    Returns (column_names, rows).
    """
    if database_url is None:
        database_url = DATABASE_URL

    conn = psycopg2.connect(database_url)
    try:
        cur = conn.cursor()
        cur.execute(f"SET statement_timeout = '{STATEMENT_TIMEOUT}'")

        # Wrap in row limit
        limited_sql = f"SELECT * FROM ({sql.rstrip(';')}) sub LIMIT {ROW_LIMIT}"
        cur.execute(limited_sql)

        columns = [desc[0] for desc in cur.description]
        rows = [list(row) for row in cur.fetchall()]

        cur.close()
        return columns, rows
    finally:
        conn.close()
```

**Step 2: Commit**

```bash
git add api/services/query_executor.py
git commit -m "feat: query execution with timeout and row limit guardrails"
```

---

## Task 6: Query Router (POST /api/query)

**Files:**
- Create: `api/models/requests.py`
- Modify: `api/models/responses.py` (add QueryResponse, ErrorResponse)
- Create: `api/routers/query.py`
- Modify: `api/main.py` (add query router)

**Step 1: Create `api/models/requests.py`**

```python
from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    layer: str = Field(default="warehouse", pattern="^(warehouse|staging)$")
```

**Step 2: Update `api/models/responses.py`**

Add to the existing file:

```python
class QueryResponse(BaseModel):
    sql: str
    columns: list[str]
    results: list[list]
    row_count: int
    explanation: str


class ErrorResponse(BaseModel):
    error: str
    sql: str | None = None
```

**Step 3: Create `api/routers/query.py`**

```python
import psycopg2
from fastapi import APIRouter, HTTPException

from api.config import DATABASE_URL
from api.models.requests import QueryRequest
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
```

**Step 4: Update `api/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import health, query

app = FastAPI(title="Splashworks Warehouse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(query.router)
```

**Step 5: Commit**

```bash
git add api/models/ api/routers/query.py api/main.py
git commit -m "feat: POST /api/query endpoint — NL to SQL to results"
```

---

## Task 7: Integration Test (Happy Path)

**Files:**
- Create: `api/tests/integration/test_query_endpoint.py`

This is the soup-to-nuts test: question → Claude → SQL → Postgres → results.

**Step 1: Write integration test**

`api/tests/integration/test_query_endpoint.py`:
```python
import os

import pytest
from httpx import ASGITransport, AsyncClient

from api.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_query_happy_path(client):
    """Full pipeline: question → SQL → results."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")

    resp = await client.post("/api/query", json={
        "question": "How many active customers does each company have?",
        "layer": "warehouse",
    })
    assert resp.status_code == 200
    body = resp.json()

    assert "sql" in body
    assert "SELECT" in body["sql"].upper()
    assert len(body["columns"]) > 0
    assert body["row_count"] > 0
    assert len(body["results"]) == body["row_count"]


@pytest.mark.asyncio
async def test_query_staging_layer(client):
    """Same question against staging layer for diagnostic comparison."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")

    resp = await client.post("/api/query", json={
        "question": "How many active customers does each company have?",
        "layer": "staging",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["row_count"] > 0


@pytest.mark.asyncio
async def test_query_empty_question(client):
    """Empty question should return 422 (validation error)."""
    resp = await client.post("/api/query", json={
        "question": "",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_query_invalid_layer(client):
    """Invalid layer should return 422."""
    resp = await client.post("/api/query", json={
        "question": "How many customers?",
        "layer": "invalid",
    })
    assert resp.status_code == 422
```

**Step 2: Run integration tests**

```bash
DB_PASSWORD=$(grep DB_PASSWORD ../.env | cut -d= -f2)
DATABASE_URL="postgresql://splashworks:${DB_PASSWORD}@localhost:5432/splashworks" \
ANTHROPIC_API_KEY="$(grep ANTHROPIC_API_KEY ../.env | cut -d= -f2)" \
  pytest tests/integration/test_query_endpoint.py -v
```

Expected: 4 tests pass (2 happy path with real Claude, 2 validation).

**Step 3: Commit**

```bash
git add api/tests/integration/test_query_endpoint.py
git commit -m "test: integration tests for query endpoint (happy path + validation)"
```

---

## Task 8: Dockerfile + Docker Compose

**Files:**
- Create: `api/Dockerfile`
- Modify: `docker-compose.yml` (add api service)

**Step 1: Create `api/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY api/requirements.txt /app/api/requirements.txt
RUN pip install --no-cache-dir -r /app/api/requirements.txt

COPY api/ /app/api/
COPY docs/skimmer-semantic-layer.yaml /app/docs/skimmer-semantic-layer.yaml

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Step 2: Add api service to `docker-compose.yml`**

Add after the `postgres` service, before `volumes:`:

```yaml
  api:
    build:
      context: .
      dockerfile: api/Dockerfile
    container_name: splashworks-api
    environment:
      DATABASE_URL: postgresql://splashworks:${DB_PASSWORD}@postgres:5432/splashworks
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      STATEMENT_TIMEOUT: "10s"
      ROW_LIMIT: "10000"
    ports:
      - "127.0.0.1:8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
```

**Step 3: Add `ANTHROPIC_API_KEY` to VPS `.env`**

This will be done during VPS deployment (Task 9). The key needs to be added to `/opt/splashworks/.env`.

**Step 4: Add `api/.venv/` to `.gitignore`**

Append to `.gitignore`:
```
api/.venv/
```

**Step 5: Commit**

```bash
git add api/Dockerfile docker-compose.yml .gitignore
git commit -m "feat: Dockerfile and Docker Compose for API service"
```

---

## Task 9: Deploy to VPS + Verify with curl

**Step 1: Push all code**

```bash
git push origin feature/warehouse-etl
```

**Step 2: Add Anthropic API key to VPS .env**

```bash
ssh root@76.13.29.44 'echo "ANTHROPIC_API_KEY=sk-ant-..." >> /opt/splashworks/.env'
```

(Replace `sk-ant-...` with the actual key.)

**Step 3: Pull and deploy on VPS**

```bash
ssh root@76.13.29.44 'bash -s' << 'SCRIPT'
cd /opt/splashworks
git pull origin feature/warehouse-etl

# Build and start API container
docker compose up -d --build api
docker compose logs api --tail 20
SCRIPT
```

Expected: API container starts, uvicorn listening on port 8080.

**Step 4: Verify health endpoint**

```bash
ssh root@76.13.29.44 'curl -s http://localhost:8080/api/health | python3 -m json.tool'
```

Expected: JSON with `"status": "healthy"`, schemas, ETL date.

**Step 5: Verify query endpoint**

```bash
ssh root@76.13.29.44 'curl -s -X POST http://localhost:8080/api/query \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"How many active customers does each company have?\"}" \
  | python3 -m json.tool'
```

Expected: JSON with `sql`, `columns`, `results`, `row_count` > 0.

**Step 6: Verify via Cloudflare tunnel**

```bash
curl -s https://api.splshwrks.com/api/health | python3 -m json.tool
```

Expected: Same health response via public URL.

**Step 7: Test layer switching**

```bash
ssh root@76.13.29.44 'curl -s -X POST http://localhost:8080/api/query \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"How many active customers does each company have?\", \"layer\": \"staging\"}" \
  | python3 -m json.tool'
```

Expected: Results from staging layer (comparable to warehouse results).

**Step 8: Commit any deployment fixes**

If any fixes were needed during deployment, commit them.

**Step 9: Update PROGRESS.md**

Mark step 1.6 as DONE. Add session log entry.

```bash
git add docs/plans/PROGRESS.md
git commit -m "docs: update progress — step 1.6 FastAPI backend complete"
git push origin feature/warehouse-etl
```

---

## Validation Checklist — Batch B Complete

```
[ ] api/ project structure created with all files
[ ] Unit tests pass: query validator (12 tests)
[ ] Unit tests pass: SQL extraction (6 tests)
[ ] Unit tests pass: schema context builder (4 tests)
[ ] Integration test: health endpoint returns schema counts
[ ] Integration test: query endpoint returns SQL + results (real Claude + Postgres)
[ ] Health endpoint works via curl on VPS
[ ] Query endpoint works via curl on VPS (warehouse layer)
[ ] Query endpoint works via curl on VPS (staging layer)
[ ] Cloudflare tunnel routes api.splshwrks.com to FastAPI
[ ] Docker container healthy and restarting
[ ] All committed and pushed
[ ] PROGRESS.md updated
```
