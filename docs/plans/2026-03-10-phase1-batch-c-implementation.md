# Phase 1 Batch C — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a clean-room React frontend and supporting API endpoints that replace the client-side SQLite app with an API-driven warehouse interface.

**Architecture:** Three Docker containers (postgres, api, frontend/nginx). React SPA served by Nginx, proxying `/api/*` to FastAPI. Four views: AI Query, Database Explorer, Data Explorer, Dashboard. All data comes from the Postgres warehouse via FastAPI.

**Tech Stack:** React 18 + TypeScript (strict), Vite, Tailwind CSS, Vitest, FastAPI, pytest, Nginx, Docker Compose, Cloudflare Tunnels.

**Design Doc:** `docs/plans/2026-03-10-phase1-batch-c-frontend-design.md`

---

## Task 1: Backend — `POST /api/query/raw` endpoint

Add an endpoint for executing user-written/edited SQL with the same guardrails as `/api/query`.

**Files:**
- Create: `api/models/requests.py` (add `RawQueryRequest`)
- Modify: `api/routers/query.py` (add route)
- Create: `api/tests/unit/test_raw_query_endpoint.py`

**Step 1: Write the failing test**

Create `api/tests/unit/test_raw_query_endpoint.py`:

```python
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_raw_query_valid_select():
    """Valid SELECT should return results."""
    mock_cols = ["id", "name"]
    mock_rows = [[1, "AQPS"], [2, "JOMO"]]

    with patch("api.routers.query.execute_query", return_value=(mock_cols, mock_rows)):
        resp = client.post("/api/query/raw", json={"sql": "SELECT id, name FROM public_warehouse.dim_company"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["columns"] == ["id", "name"]
    assert data["row_count"] == 2


def test_raw_query_rejects_drop():
    """DROP should be rejected by guardrails."""
    resp = client.post("/api/query/raw", json={"sql": "DROP TABLE public_warehouse.dim_customer"})
    assert resp.status_code == 400


def test_raw_query_rejects_insert():
    """INSERT should be rejected by guardrails."""
    resp = client.post("/api/query/raw", json={"sql": "INSERT INTO public_warehouse.dim_customer VALUES (1)"})
    assert resp.status_code == 400


def test_raw_query_rejects_delete():
    """DELETE should be rejected by guardrails."""
    resp = client.post("/api/query/raw", json={"sql": "DELETE FROM public_warehouse.dim_customer"})
    assert resp.status_code == 400


def test_raw_query_rejects_update():
    """UPDATE should be rejected by guardrails."""
    resp = client.post("/api/query/raw", json={"sql": "UPDATE public_warehouse.dim_customer SET name='x'"})
    assert resp.status_code == 400


def test_raw_query_rejects_multi_statement():
    """Multi-statement queries should be rejected."""
    resp = client.post("/api/query/raw", json={"sql": "SELECT 1; DROP TABLE public_warehouse.dim_customer"})
    assert resp.status_code == 400


def test_raw_query_rejects_empty():
    """Empty SQL should be rejected."""
    resp = client.post("/api/query/raw", json={"sql": ""})
    assert resp.status_code in (400, 422)


def test_raw_query_accepts_cte():
    """WITH (CTE) queries should be accepted."""
    mock_cols = ["cnt"]
    mock_rows = [[42]]

    with patch("api.routers.query.execute_query", return_value=(mock_cols, mock_rows)):
        resp = client.post("/api/query/raw", json={
            "sql": "WITH active AS (SELECT * FROM public_warehouse.dim_customer WHERE is_inactive = 0) SELECT count(*) AS cnt FROM active"
        })

    assert resp.status_code == 200
    assert resp.json()["row_count"] == 1
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/rosssivertsen/dev/clientwork/splashworks/Skimmer-AI-Query-Visualization && python -m pytest api/tests/unit/test_raw_query_endpoint.py -v`
Expected: FAIL — endpoint does not exist yet.

**Step 3: Add `RawQueryRequest` model**

Add to `api/models/requests.py`:

```python
class RawQueryRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=10000)
    layer: str = Field(default="warehouse", pattern="^(warehouse|staging)$")
```

**Step 4: Add the route**

Add to `api/routers/query.py`:

```python
from api.models.requests import QueryRequest, RawQueryRequest

@router.post("/api/query/raw", response_model=QueryResponse)
def query_raw(req: RawQueryRequest):
    """Execute user-written SQL with guardrails (SELECT-only, timeout, row limit)."""
    error = validate_sql(req.sql)
    if error:
        raise HTTPException(status_code=400, detail=error)

    try:
        columns, rows = execute_query(req.sql)
    except psycopg2.extensions.QueryCanceledError:
        raise HTTPException(status_code=408, detail=f"Query timed out")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query execution error: {e}")

    return QueryResponse(
        sql=req.sql,
        columns=columns,
        results=rows,
        row_count=len(rows),
        explanation="User-provided SQL query",
    )
```

**Step 5: Run tests to verify they pass**

Run: `python -m pytest api/tests/unit/test_raw_query_endpoint.py -v`
Expected: 8 PASSED

**Step 6: Run full backend test suite (regression check)**

Run: `python -m pytest api/tests/ -v`
Expected: All existing tests + new tests pass.

**Step 7: Commit**

```bash
git add api/models/requests.py api/routers/query.py api/tests/unit/test_raw_query_endpoint.py
git commit -m "feat: POST /api/query/raw endpoint — user-edited SQL with guardrails"
```

---

## Task 2: Backend — `GET /api/schema` endpoint

Returns table/column metadata from the warehouse for the Database Explorer and Data Explorer views.

**Files:**
- Create: `api/routers/schema.py`
- Modify: `api/main.py` (register router)
- Create: `api/tests/unit/test_schema_endpoint.py`
- Modify: `api/models/responses.py` (add response models)

**Step 1: Write the failing test**

Create `api/tests/unit/test_schema_endpoint.py`:

```python
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_schema_returns_tables():
    """GET /api/schema should return table metadata."""
    mock_rows = [
        ("public_warehouse", "dim_customer", "id", "integer", "NO", 1),
        ("public_warehouse", "dim_customer", "first_name", "text", "YES", 2),
        ("public_warehouse", "dim_customer", "last_name", "text", "YES", 3),
        ("public_warehouse", "fact_labor", "id", "integer", "NO", 1),
        ("public_warehouse", "fact_labor", "customer_id", "integer", "YES", 2),
    ]

    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    mock_cur.fetchall.return_value = mock_rows

    with patch("api.routers.schema.psycopg2.connect", return_value=mock_conn):
        resp = client.get("/api/schema")

    assert resp.status_code == 200
    data = resp.json()
    assert "tables" in data
    # Should have 2 tables
    assert len(data["tables"]) == 2
    # dim_customer should have 3 columns
    customer = next(t for t in data["tables"] if t["table_name"] == "dim_customer")
    assert len(customer["columns"]) == 3
    assert customer["schema_name"] == "public_warehouse"


def test_schema_with_staging_layer():
    """GET /api/schema?layer=staging should query staging schemas."""
    mock_rows = [
        ("public_staging", "stg_customer", "id", "integer", "NO", 1),
    ]

    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    mock_cur.fetchall.return_value = mock_rows

    with patch("api.routers.schema.psycopg2.connect", return_value=mock_conn):
        resp = client.get("/api/schema?layer=staging")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["tables"]) == 1
    assert data["tables"][0]["schema_name"] == "public_staging"


def test_schema_invalid_layer():
    """Invalid layer parameter should return 422."""
    resp = client.get("/api/schema?layer=invalid")
    assert resp.status_code == 422
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest api/tests/unit/test_schema_endpoint.py -v`
Expected: FAIL — endpoint/router does not exist.

**Step 3: Add response models**

Add to `api/models/responses.py`:

```python
class ColumnInfo(BaseModel):
    column_name: str
    data_type: str
    is_nullable: bool
    ordinal_position: int


class TableInfo(BaseModel):
    schema_name: str
    table_name: str
    columns: list[ColumnInfo]


class SchemaResponse(BaseModel):
    layer: str
    tables: list[TableInfo]
```

**Step 4: Create the schema router**

Create `api/routers/schema.py`:

```python
from enum import Enum

import psycopg2
from fastapi import APIRouter, Query

from api.config import DATABASE_URL
from api.models.responses import ColumnInfo, SchemaResponse, TableInfo
from api.services.schema_context import LAYER_SCHEMAS

router = APIRouter()


class LayerParam(str, Enum):
    warehouse = "warehouse"
    staging = "staging"


@router.get("/api/schema", response_model=SchemaResponse)
def get_schema(layer: LayerParam = LayerParam.warehouse):
    """Return table and column metadata from the warehouse."""
    schemas = LAYER_SCHEMAS.get(layer.value, LAYER_SCHEMAS["warehouse"])
    placeholders = ",".join(["%s"] * len(schemas))

    conn = psycopg2.connect(DATABASE_URL)
    try:
        cur = conn.cursor()
        cur.execute(f"""
            SELECT table_schema, table_name, column_name, data_type, is_nullable, ordinal_position
            FROM information_schema.columns
            WHERE table_schema IN ({placeholders})
            ORDER BY table_schema, table_name, ordinal_position
        """, schemas)
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    # Group into tables
    tables_map: dict[tuple[str, str], list[ColumnInfo]] = {}
    for schema_name, table_name, col_name, data_type, nullable, ordinal in rows:
        key = (schema_name, table_name)
        tables_map.setdefault(key, []).append(
            ColumnInfo(
                column_name=col_name,
                data_type=data_type,
                is_nullable=nullable == "YES",
                ordinal_position=ordinal,
            )
        )

    tables = [
        TableInfo(schema_name=k[0], table_name=k[1], columns=cols)
        for k, cols in tables_map.items()
    ]

    return SchemaResponse(layer=layer.value, tables=tables)
```

**Step 5: Register the router**

Add to `api/main.py`:

```python
from api.routers import health, query, schema

app.include_router(schema.router)
```

**Step 6: Run tests to verify they pass**

Run: `python -m pytest api/tests/unit/test_schema_endpoint.py -v`
Expected: 3 PASSED

**Step 7: Run full backend test suite**

Run: `python -m pytest api/tests/ -v`
Expected: All tests pass.

**Step 8: Commit**

```bash
git add api/routers/schema.py api/models/responses.py api/main.py api/tests/unit/test_schema_endpoint.py
git commit -m "feat: GET /api/schema endpoint — table and column metadata"
```

---

## Task 3: Backend — `GET /api/schema/dictionary` endpoint

Returns semantic descriptions and business terms from the YAML semantic layer and data dictionary.

**Files:**
- Modify: `api/routers/schema.py` (add route)
- Modify: `api/models/responses.py` (add response model)
- Create: `api/tests/unit/test_dictionary_endpoint.py`
- Reference: `docs/skimmer-semantic-layer.yaml`

**Step 1: Write the failing test**

Create `api/tests/unit/test_dictionary_endpoint.py`:

```python
from unittest.mock import patch
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_dictionary_returns_business_terms():
    """GET /api/schema/dictionary should return business terms from semantic layer."""
    mock_semantic = {
        "business_terms": {
            "active_customer": {
                "description": "Customer with IsInactive=0 and Deleted=0",
                "synonyms": ["current customer"],
            },
            "lsi": {
                "description": "Langelier Saturation Index",
                "synonyms": ["saturation index"],
            },
        },
        "relationships": {
            "customer_to_pool": {
                "description": "Customer → ServiceLocation → Pool",
            },
        },
    }

    with patch("api.routers.schema.load_semantic_layer", return_value=mock_semantic):
        resp = client.get("/api/schema/dictionary")

    assert resp.status_code == 200
    data = resp.json()
    assert "business_terms" in data
    assert len(data["business_terms"]) == 2
    assert data["business_terms"][0]["term"] == "active_customer"
    assert "relationships" in data
    assert len(data["relationships"]) == 1


def test_dictionary_handles_missing_yaml():
    """Should return empty lists if semantic layer YAML is missing."""
    with patch("api.routers.schema.load_semantic_layer", return_value={}):
        resp = client.get("/api/schema/dictionary")

    assert resp.status_code == 200
    data = resp.json()
    assert data["business_terms"] == []
    assert data["relationships"] == []


def test_dictionary_includes_verified_queries():
    """Should include verified query examples if present."""
    mock_semantic = {
        "business_terms": {},
        "verified_queries": [
            {"question": "How many active customers?", "sql": "SELECT count(*)..."},
        ],
    }

    with patch("api.routers.schema.load_semantic_layer", return_value=mock_semantic):
        resp = client.get("/api/schema/dictionary")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["verified_queries"]) == 1
    assert data["verified_queries"][0]["question"] == "How many active customers?"
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest api/tests/unit/test_dictionary_endpoint.py -v`
Expected: FAIL — endpoint does not exist.

**Step 3: Add response models**

Add to `api/models/responses.py`:

```python
class BusinessTerm(BaseModel):
    term: str
    description: str
    synonyms: list[str] = []


class Relationship(BaseModel):
    name: str
    description: str


class VerifiedQuery(BaseModel):
    question: str
    sql: str | None = None


class DictionaryResponse(BaseModel):
    business_terms: list[BusinessTerm]
    relationships: list[Relationship]
    verified_queries: list[VerifiedQuery]
```

**Step 4: Add the route**

Add to `api/routers/schema.py`:

```python
from api.models.responses import (
    BusinessTerm, ColumnInfo, DictionaryResponse, Relationship,
    SchemaResponse, TableInfo, VerifiedQuery,
)
from api.services.schema_context import LAYER_SCHEMAS, load_semantic_layer


@router.get("/api/schema/dictionary", response_model=DictionaryResponse)
def get_dictionary():
    """Return semantic descriptions, business terms, and relationships."""
    sl = load_semantic_layer()

    business_terms = []
    for term, info in (sl.get("business_terms") or {}).items():
        business_terms.append(BusinessTerm(
            term=term,
            description=info.get("description", ""),
            synonyms=info.get("synonyms", []),
        ))

    relationships = []
    for name, info in (sl.get("relationships") or {}).items():
        relationships.append(Relationship(
            name=name,
            description=info.get("description", ""),
        ))

    verified_queries = []
    for vq in (sl.get("verified_queries") or []):
        verified_queries.append(VerifiedQuery(
            question=vq.get("question", ""),
            sql=vq.get("sql"),
        ))

    return DictionaryResponse(
        business_terms=business_terms,
        relationships=relationships,
        verified_queries=verified_queries,
    )
```

**Step 5: Run tests to verify they pass**

Run: `python -m pytest api/tests/unit/test_dictionary_endpoint.py -v`
Expected: 3 PASSED

**Step 6: Run full backend test suite**

Run: `python -m pytest api/tests/ -v`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add api/routers/schema.py api/models/responses.py api/tests/unit/test_dictionary_endpoint.py
git commit -m "feat: GET /api/schema/dictionary — semantic layer and business terms"
```

---

## Task 4: Frontend — Clean room setup and ApiClient

Replace the existing `src/` contents with the clean-room frontend foundation.

**Files:**
- Create: `src-warehouse/` directory (build alongside `src/`, swap at end)
  - **Note:** We build in `src-warehouse/` to avoid breaking the existing app during development. At the end of the batch, we swap `src/` → `src-legacy/` and `src-warehouse/` → `src/`.
- Create: `src-warehouse/main.tsx`
- Create: `src-warehouse/App.tsx`
- Create: `src-warehouse/services/ApiClient.ts`
- Create: `src-warehouse/types/api.ts`
- Create: `src-warehouse/services/__tests__/ApiClient.test.ts`

**Step 1: Create the API types**

Create `src-warehouse/types/api.ts`:

```typescript
// Response types matching FastAPI models

export interface HealthResponse {
  status: string;
  postgres: string;
  last_etl_date: string | null;
  last_etl_rows: number | null;
  schemas: Record<string, number>;
}

export interface QueryResponse {
  sql: string;
  columns: string[];
  results: (string | number | boolean | null)[][];
  row_count: number;
  explanation: string;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  ordinal_position: number;
}

export interface TableInfo {
  schema_name: string;
  table_name: string;
  columns: ColumnInfo[];
}

export interface SchemaResponse {
  layer: string;
  tables: TableInfo[];
}

export interface BusinessTerm {
  term: string;
  description: string;
  synonyms: string[];
}

export interface Relationship {
  name: string;
  description: string;
}

export interface VerifiedQuery {
  question: string;
  sql: string | null;
}

export interface DictionaryResponse {
  business_terms: BusinessTerm[];
  relationships: Relationship[];
  verified_queries: VerifiedQuery[];
}

// Request types

export interface QueryRequest {
  question: string;
  layer?: "warehouse" | "staging";
}

export interface RawQueryRequest {
  sql: string;
  layer?: "warehouse" | "staging";
}

// Error type

export interface ApiError {
  detail: string;
}
```

**Step 2: Write the failing ApiClient test**

Create `src-warehouse/services/__tests__/ApiClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient } from "../ApiClient";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("/api");
    mockFetch.mockReset();
  });

  describe("health", () => {
    it("returns health data on success", async () => {
      const mockHealth = {
        status: "healthy",
        postgres: "connected",
        last_etl_date: "2026-03-10",
        last_etl_rows: 712267,
        schemas: { public_warehouse: 12 },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealth),
      });

      const result = await client.health();
      expect(result).toEqual(mockHealth);
      expect(mockFetch).toHaveBeenCalledWith("/api/health", expect.any(Object));
    });
  });

  describe("query", () => {
    it("sends NL question and returns results", async () => {
      const mockResponse = {
        sql: "SELECT count(*) FROM public_warehouse.dim_customer",
        columns: ["count"],
        results: [[859]],
        row_count: 1,
        explanation: "Counting active customers",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.query("How many active customers?");
      expect(result.sql).toContain("SELECT");
      expect(result.row_count).toBe(1);
    });
  });

  describe("queryRaw", () => {
    it("sends raw SQL and returns results", async () => {
      const mockResponse = {
        sql: "SELECT 1 AS test",
        columns: ["test"],
        results: [[1]],
        row_count: 1,
        explanation: "User-provided SQL query",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.queryRaw("SELECT 1 AS test");
      expect(result.columns).toEqual(["test"]);
    });
  });

  describe("getSchema", () => {
    it("returns table metadata", async () => {
      const mockSchema = {
        layer: "warehouse",
        tables: [
          {
            schema_name: "public_warehouse",
            table_name: "dim_customer",
            columns: [{ column_name: "id", data_type: "integer", is_nullable: false, ordinal_position: 1 }],
          },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSchema),
      });

      const result = await client.getSchema();
      expect(result.tables).toHaveLength(1);
    });
  });

  describe("getDictionary", () => {
    it("returns business terms and relationships", async () => {
      const mockDict = {
        business_terms: [{ term: "active_customer", description: "Customer with IsInactive=0", synonyms: [] }],
        relationships: [{ name: "customer_to_pool", description: "Customer → Pool" }],
        verified_queries: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDict),
      });

      const result = await client.getDictionary();
      expect(result.business_terms).toHaveLength(1);
    });
  });

  describe("error handling", () => {
    it("throws on HTTP error with detail message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: "Prohibited keyword detected" }),
      });

      await expect(client.queryRaw("DROP TABLE x")).rejects.toThrow("Prohibited keyword detected");
    });

    it("throws on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(client.health()).rejects.toThrow("Network error");
    });
  });
});
```

**Step 3: Run the test to verify it fails**

Run: `npx vitest run src-warehouse/services/__tests__/ApiClient.test.ts`
Expected: FAIL — ApiClient module does not exist.

**Step 4: Implement ApiClient**

Create `src-warehouse/services/ApiClient.ts`:

```typescript
import type {
  DictionaryResponse,
  HealthResponse,
  QueryResponse,
  SchemaResponse,
} from "../types/api";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "/api") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
      throw new Error(errorBody.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  async query(question: string, layer: string = "warehouse"): Promise<QueryResponse> {
    return this.request<QueryResponse>("/query", {
      method: "POST",
      body: JSON.stringify({ question, layer }),
    });
  }

  async queryRaw(sql: string, layer: string = "warehouse"): Promise<QueryResponse> {
    return this.request<QueryResponse>("/query/raw", {
      method: "POST",
      body: JSON.stringify({ sql, layer }),
    });
  }

  async getSchema(layer: string = "warehouse"): Promise<SchemaResponse> {
    return this.request<SchemaResponse>(`/schema?layer=${layer}`);
  }

  async getDictionary(): Promise<DictionaryResponse> {
    return this.request<DictionaryResponse>("/schema/dictionary");
  }
}

// Singleton instance for the app
export const apiClient = new ApiClient("/api");
```

**Step 5: Run the test to verify it passes**

Run: `npx vitest run src-warehouse/services/__tests__/ApiClient.test.ts`
Expected: 7 PASSED

**Step 6: Create the app shell**

Create `src-warehouse/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../src/index.css"; // Reuse existing Tailwind styles

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src-warehouse/App.tsx`:

```tsx
import { useState } from "react";

type ViewId = "query" | "explore" | "data" | "dashboard";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "query", label: "AI Query" },
  { id: "explore", label: "Database Explorer" },
  { id: "data", label: "Data Explorer" },
  { id: "dashboard", label: "Dashboard" },
];

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("query");

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-container">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-neutral-900">
                Splashworks Warehouse
              </h1>
              <p className="text-sm text-neutral-500">
                AI-powered Business Intelligence
              </p>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b border-neutral-200 sticky top-0 z-10">
          <div className="flex px-6 h-12">
            {VIEWS.map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeView === view.id
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </nav>

        {/* View content — placeholder */}
        <main className="p-6">
          <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center text-neutral-500">
            <p className="text-lg font-medium">{VIEWS.find((v) => v.id === activeView)?.label}</p>
            <p className="text-sm mt-1">View not yet implemented</p>
          </div>
        </main>
      </div>
    </div>
  );
}
```

**Step 7: Commit**

```bash
git add src-warehouse/
git commit -m "feat: clean-room frontend scaffold — ApiClient, types, app shell"
```

---

## Task 5: Frontend — ResultsTable component

Reusable paginated table for query results, used across AI Query, Data Explorer, and Dashboard views.

**Files:**
- Create: `src-warehouse/components/ResultsTable.tsx`
- Create: `src-warehouse/components/__tests__/ResultsTable.test.tsx`

**Step 1: Write the failing test**

Create `src-warehouse/components/__tests__/ResultsTable.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsTable } from "../ResultsTable";

describe("ResultsTable", () => {
  const columns = ["id", "name", "city"];
  const rows = [
    [1, "Alice", "Orlando"],
    [2, "Bob", "Tampa"],
    [3, "Charlie", "Miami"],
  ];

  it("renders column headers", () => {
    render(<ResultsTable columns={columns} rows={rows} />);
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("city")).toBeInTheDocument();
  });

  it("renders row data", () => {
    render(<ResultsTable columns={columns} rows={rows} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Tampa")).toBeInTheDocument();
  });

  it("shows row count", () => {
    render(<ResultsTable columns={columns} rows={rows} />);
    expect(screen.getByText(/3 rows/)).toBeInTheDocument();
  });

  it("shows empty state when no rows", () => {
    render(<ResultsTable columns={columns} rows={[]} />);
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it("paginates when rows exceed page size", async () => {
    const manyRows = Array.from({ length: 75 }, (_, i) => [i, `Name${i}`, `City${i}`]);
    render(<ResultsTable columns={columns} rows={manyRows} pageSize={50} />);

    // Should show first page
    expect(screen.getByText("Name0")).toBeInTheDocument();
    expect(screen.queryByText("Name50")).not.toBeInTheDocument();

    // Click next page
    const nextButton = screen.getByRole("button", { name: /next/i });
    await userEvent.click(nextButton);

    // Should show second page
    expect(screen.getByText("Name50")).toBeInTheDocument();
    expect(screen.queryByText("Name0")).not.toBeInTheDocument();
  });

  it("handles null values gracefully", () => {
    render(<ResultsTable columns={["a", "b"]} rows={[[1, null]]} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    // null rendered as empty or "null"
    expect(screen.getByText(/null/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src-warehouse/components/__tests__/ResultsTable.test.tsx`
Expected: FAIL — component does not exist.

**Step 3: Implement ResultsTable**

Create `src-warehouse/components/ResultsTable.tsx`:

```tsx
import { useState } from "react";

interface ResultsTableProps {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  pageSize?: number;
}

export function ResultsTable({ columns, rows, pageSize = 50 }: ResultsTableProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const start = page * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        <p>No results returned.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left font-medium text-neutral-700 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {pageRows.map((row, rowIdx) => (
              <tr key={start + rowIdx} className="hover:bg-neutral-50">
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="px-4 py-2 text-neutral-800 whitespace-nowrap">
                    {cell === null ? (
                      <span className="text-neutral-400 italic">null</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: row count + pagination */}
      <div className="flex items-center justify-between mt-3 text-sm text-neutral-600">
        <span>{rows.length} rows</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded border border-neutral-300 disabled:opacity-40 hover:bg-neutral-50"
              aria-label="Previous page"
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded border border-neutral-300 disabled:opacity-40 hover:bg-neutral-50"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src-warehouse/components/__tests__/ResultsTable.test.tsx`
Expected: 6 PASSED

**Step 5: Commit**

```bash
git add src-warehouse/components/ResultsTable.tsx src-warehouse/components/__tests__/ResultsTable.test.tsx
git commit -m "feat: ResultsTable component — paginated table with empty/null handling"
```

---

## Task 6: Frontend — SqlEditor component

Editable SQL code editor used by AI Query (to edit generated SQL) and Data Explorer (to write raw SQL).

**Files:**
- Create: `src-warehouse/components/SqlEditor.tsx`
- Create: `src-warehouse/components/__tests__/SqlEditor.test.tsx`

**Step 1: Write the failing test**

Create `src-warehouse/components/__tests__/SqlEditor.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SqlEditor } from "../SqlEditor";

describe("SqlEditor", () => {
  it("renders with initial value", () => {
    render(<SqlEditor value="SELECT 1" onChange={() => {}} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("SELECT 1");
  });

  it("calls onChange when user types", async () => {
    const onChange = vi.fn();
    render(<SqlEditor value="" onChange={onChange} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "S");
    expect(onChange).toHaveBeenCalled();
  });

  it("calls onRun when Ctrl+Enter is pressed", async () => {
    const onRun = vi.fn();
    render(<SqlEditor value="SELECT 1" onChange={() => {}} onRun={onRun} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.click(textarea);
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("shows read-only state", () => {
    render(<SqlEditor value="SELECT 1" onChange={() => {}} readOnly />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("readOnly");
  });

  it("renders placeholder when empty", () => {
    render(<SqlEditor value="" onChange={() => {}} placeholder="Write SQL..." />);
    expect(screen.getByPlaceholderText("Write SQL...")).toBeInTheDocument();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src-warehouse/components/__tests__/SqlEditor.test.tsx`
Expected: FAIL — component does not exist.

**Step 3: Implement SqlEditor**

Create `src-warehouse/components/SqlEditor.tsx`:

```tsx
import { useRef, type KeyboardEvent } from "react";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  readOnly?: boolean;
  placeholder?: string;
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  readOnly = false,
  placeholder = "SELECT * FROM ...",
}: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && onRun) {
      e.preventDefault();
      onRun();
    }

    // Tab inserts 2 spaces instead of moving focus
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea && !readOnly) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.substring(0, start) + "  " + value.substring(end);
        onChange(newValue);
        // Reset cursor position after React re-render
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        className={`w-full min-h-[120px] p-4 font-mono text-sm rounded-lg border border-neutral-300
          bg-neutral-900 text-neutral-100 placeholder-neutral-500
          focus:ring-2 focus:ring-primary-500 focus:border-transparent
          resize-y ${readOnly ? "opacity-75 cursor-default" : ""}`}
      />
      {onRun && (
        <div className="absolute bottom-3 right-3 text-xs text-neutral-500">
          Ctrl+Enter to run
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src-warehouse/components/__tests__/SqlEditor.test.tsx`
Expected: 5 PASSED

**Step 5: Commit**

```bash
git add src-warehouse/components/SqlEditor.tsx src-warehouse/components/__tests__/SqlEditor.test.tsx
git commit -m "feat: SqlEditor component — monospace textarea with Ctrl+Enter run"
```

---

## Task 7: Frontend — ExportButton component

CSV and Excel export from any query result set.

**Files:**
- Create: `src-warehouse/components/ExportButton.tsx`
- Create: `src-warehouse/components/__tests__/ExportButton.test.tsx`
- Note: Excel export uses the `xlsx` package (already in `package.json` as a dependency — if not, add `xlsx`).

**Step 1: Check if xlsx is in dependencies**

Run: `cat package.json | grep xlsx`
If missing, run: `npm install xlsx`

**Step 2: Write the failing test**

Create `src-warehouse/components/__tests__/ExportButton.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportButton, generateCsv } from "../ExportButton";

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:mock");
global.URL.revokeObjectURL = vi.fn();

describe("generateCsv", () => {
  it("generates correct CSV from columns and rows", () => {
    const csv = generateCsv(["name", "city"], [["Alice", "Orlando"], ["Bob", "Tampa"]]);
    expect(csv).toBe("name,city\nAlice,Orlando\nBob,Tampa");
  });

  it("quotes values containing commas", () => {
    const csv = generateCsv(["note"], [["hello, world"]]);
    expect(csv).toBe('note\n"hello, world"');
  });

  it("quotes values containing double quotes", () => {
    const csv = generateCsv(["note"], [['say "hi"']]);
    expect(csv).toBe('note\n"say ""hi"""');
  });

  it("handles null values", () => {
    const csv = generateCsv(["a"], [[null]]);
    expect(csv).toBe("a\n");
  });

  it("handles empty data", () => {
    const csv = generateCsv(["a", "b"], []);
    expect(csv).toBe("a,b");
  });
});

describe("ExportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders export button", () => {
    render(<ExportButton columns={["a"]} rows={[[1]]} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("is disabled when no data", () => {
    render(<ExportButton columns={[]} rows={[]} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

**Step 3: Run the test to verify it fails**

Run: `npx vitest run src-warehouse/components/__tests__/ExportButton.test.tsx`
Expected: FAIL — component does not exist.

**Step 4: Implement ExportButton**

Create `src-warehouse/components/ExportButton.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";

interface ExportButtonProps {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  filename?: string;
}

/** Generate RFC 4180 compliant CSV string. */
export function generateCsv(
  columns: string[],
  rows: (string | number | boolean | null)[][]
): string {
  const escapeCell = (val: string | number | boolean | null): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const header = columns.map(escapeCell).join(",");
  const body = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
  return rows.length > 0 ? `${header}\n${body}` : header;
}

export function ExportButton({
  columns,
  rows,
  filename = "query-results",
}: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasData = columns.length > 0 && rows.length > 0;

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const downloadCsv = () => {
    const csv = generateCsv(columns, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${filename}.csv`);
    setShowMenu(false);
  };

  const downloadExcel = async () => {
    const { utils, writeFile } = await import("xlsx");
    const wsData = [columns, ...rows];
    const ws = utils.aoa_to_sheet(wsData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Results");
    writeFile(wb, `${filename}.xlsx`);
    setShowMenu(false);
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={!hasData}
        className="px-3 py-1.5 text-sm font-medium rounded border border-neutral-300
          text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Export
      </button>
      {showMenu && (
        <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-neutral-200 z-20">
          <button
            onClick={downloadCsv}
            className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded-t-lg"
          >
            Download CSV
          </button>
          <button
            onClick={downloadExcel}
            className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded-b-lg"
          >
            Download Excel
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 5: Run the test to verify it passes**

Run: `npx vitest run src-warehouse/components/__tests__/ExportButton.test.tsx`
Expected: 7 PASSED

**Step 6: Install xlsx if needed**

Run: `npm list xlsx 2>/dev/null || npm install xlsx`

**Step 7: Commit**

```bash
git add src-warehouse/components/ExportButton.tsx src-warehouse/components/__tests__/ExportButton.test.tsx
git commit -m "feat: ExportButton component — CSV and Excel download"
```

---

## Task 8: Frontend — StatusBar component

Shows warehouse health: connected/disconnected, last ETL timestamp, polling every 30s.

**Files:**
- Create: `src-warehouse/components/StatusBar.tsx`
- Create: `src-warehouse/components/__tests__/StatusBar.test.tsx`

**Step 1: Write the failing test**

Create `src-warehouse/components/__tests__/StatusBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StatusBar } from "../StatusBar";
import { ApiClient } from "../../services/ApiClient";

vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    health: vi.fn(),
  },
}));

const mockHealth = vi.mocked((await import("../../services/ApiClient")).apiClient.health);

describe("StatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows connected state when healthy", async () => {
    mockHealth.mockResolvedValueOnce({
      status: "healthy",
      postgres: "connected",
      last_etl_date: "2026-03-10",
      last_etl_rows: 712267,
      schemas: {},
    });

    render(<StatusBar />);
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });

  it("shows disconnected state on error", async () => {
    mockHealth.mockRejectedValueOnce(new Error("Connection refused"));

    render(<StatusBar />);
    await waitFor(() => {
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    });
  });

  it("shows last ETL date", async () => {
    mockHealth.mockResolvedValueOnce({
      status: "healthy",
      postgres: "connected",
      last_etl_date: "2026-03-10",
      last_etl_rows: 712267,
      schemas: {},
    });

    render(<StatusBar />);
    await waitFor(() => {
      expect(screen.getByText(/2026-03-10/)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src-warehouse/components/__tests__/StatusBar.test.tsx`
Expected: FAIL — component does not exist.

**Step 3: Implement StatusBar**

Create `src-warehouse/components/StatusBar.tsx`:

```tsx
import { useEffect, useState } from "react";
import { apiClient } from "../services/ApiClient";
import type { HealthResponse } from "../types/api";

export function StatusBar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);

  const fetchHealth = async () => {
    try {
      const data = await apiClient.health();
      setHealth(data);
      setError(false);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = health?.status === "healthy" && !error;

  return (
    <div className="flex items-center gap-3 text-xs text-neutral-500 px-6 py-2 bg-white border-t border-neutral-200">
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${isConnected ? "bg-success-500" : "bg-error-500"}`}
        />
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>
      {health?.last_etl_date && (
        <span className="text-neutral-400">
          Last ETL: {health.last_etl_date}
          {health.last_etl_rows != null && ` (${health.last_etl_rows.toLocaleString()} rows)`}
        </span>
      )}
    </div>
  );
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src-warehouse/components/__tests__/StatusBar.test.tsx`
Expected: 3 PASSED

**Step 5: Commit**

```bash
git add src-warehouse/components/StatusBar.tsx src-warehouse/components/__tests__/StatusBar.test.tsx
git commit -m "feat: StatusBar component — warehouse health with 30s polling"
```

---

## Task 9: Frontend — QueryView (AI Query)

The landing page. Natural language input → AI generates SQL → editable → run → results → export.

**Files:**
- Create: `src-warehouse/views/QueryView.tsx`
- Create: `src-warehouse/views/__tests__/QueryView.test.tsx`

**Step 1: Write the failing test**

Create `src-warehouse/views/__tests__/QueryView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryView } from "../QueryView";
import { ApiClient } from "../../services/ApiClient";

vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    query: vi.fn(),
    queryRaw: vi.fn(),
  },
}));

const { apiClient } = await import("../../services/ApiClient");
const mockQuery = vi.mocked(apiClient.query);
const mockQueryRaw = vi.mocked(apiClient.queryRaw);

describe("QueryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders NL input and submit button", () => {
    render(<QueryView />);
    expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask/i })).toBeInTheDocument();
  });

  it("submits NL query and shows results", async () => {
    mockQuery.mockResolvedValueOnce({
      sql: "SELECT count(*) AS cnt FROM public_warehouse.dim_customer WHERE is_inactive = 0",
      columns: ["cnt"],
      results: [[859]],
      row_count: 1,
      explanation: "Counting active customers in AQPS",
    });

    render(<QueryView />);
    const input = screen.getByPlaceholderText(/ask a question/i);
    await userEvent.type(input, "How many active customers?");
    await userEvent.click(screen.getByRole("button", { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText("859")).toBeInTheDocument();
    });
    // SQL should be visible
    expect(screen.getByDisplayValue(/SELECT count/)).toBeInTheDocument();
  });

  it("shows error message on API failure", async () => {
    mockQuery.mockRejectedValueOnce(new Error("AI service error"));

    render(<QueryView />);
    const input = screen.getByPlaceholderText(/ask a question/i);
    await userEvent.type(input, "bad query");
    await userEvent.click(screen.getByRole("button", { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText(/AI service error/i)).toBeInTheDocument();
    });
  });

  it("allows editing SQL and re-running", async () => {
    mockQuery.mockResolvedValueOnce({
      sql: "SELECT 1",
      columns: ["result"],
      results: [[1]],
      row_count: 1,
      explanation: "Test",
    });

    mockQueryRaw.mockResolvedValueOnce({
      sql: "SELECT 2",
      columns: ["result"],
      results: [[2]],
      row_count: 1,
      explanation: "User-provided SQL query",
    });

    render(<QueryView />);
    const input = screen.getByPlaceholderText(/ask a question/i);
    await userEvent.type(input, "test");
    await userEvent.click(screen.getByRole("button", { name: /ask/i }));

    // Wait for SQL editor to appear
    await waitFor(() => {
      expect(screen.getByDisplayValue("SELECT 1")).toBeInTheDocument();
    });

    // Click Run SQL button
    const runButton = screen.getByRole("button", { name: /run sql/i });
    await userEvent.click(runButton);

    await waitFor(() => {
      expect(mockQueryRaw).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src-warehouse/views/__tests__/QueryView.test.tsx`
Expected: FAIL — component does not exist.

**Step 3: Implement QueryView**

Create `src-warehouse/views/QueryView.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { apiClient } from "../services/ApiClient";
import { SqlEditor } from "../components/SqlEditor";
import { ResultsTable } from "../components/ResultsTable";
import { ExportButton } from "../components/ExportButton";
import type { QueryResponse } from "../types/api";

export function QueryView() {
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.query(question);
      setSql(response.sql);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleRunSql = async () => {
    if (!sql.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.queryRaw(sql);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* NL Input */}
      <form onSubmit={handleAsk} className="flex gap-3">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your data..."
          className="flex-1 px-4 py-3 rounded-lg border border-neutral-300 text-sm
            focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg text-sm font-medium
            hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Ask"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="p-4 bg-error-50 border border-error-200 rounded-lg text-sm text-error-700">
          {error}
        </div>
      )}

      {/* Explanation */}
      {result?.explanation && (
        <div className="p-4 bg-info-50 border border-info-200 rounded-lg text-sm text-info-800">
          {result.explanation}
        </div>
      )}

      {/* SQL Editor */}
      {sql && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-700">Generated SQL</h3>
            <button
              onClick={handleRunSql}
              disabled={!sql.trim() || loading}
              className="px-4 py-1.5 bg-success-600 text-white rounded text-sm font-medium
                hover:bg-success-700 disabled:opacity-40"
              aria-label="Run SQL"
            >
              Run SQL
            </button>
          </div>
          <SqlEditor value={sql} onChange={setSql} onRun={handleRunSql} />
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-700">Results</h3>
            <ExportButton columns={result.columns} rows={result.results} />
          </div>
          <ResultsTable columns={result.columns} rows={result.results} />
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src-warehouse/views/__tests__/QueryView.test.tsx`
Expected: 4 PASSED

**Step 5: Commit**

```bash
git add src-warehouse/views/QueryView.tsx src-warehouse/views/__tests__/QueryView.test.tsx
git commit -m "feat: QueryView — NL query, editable SQL, results table, export"
```

---

## Task 10: Frontend — ExplorerView (Database Explorer)

Browse tables, columns, types, semantic descriptions, and preview data.

**Files:**
- Create: `src-warehouse/views/ExplorerView.tsx`
- Create: `src-warehouse/views/__tests__/ExplorerView.test.tsx`

**Step 1: Write the failing test**

Create `src-warehouse/views/__tests__/ExplorerView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorerView } from "../ExplorerView";

vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    getSchema: vi.fn(),
    getDictionary: vi.fn(),
    queryRaw: vi.fn(),
  },
}));

const { apiClient } = await import("../../services/ApiClient");
const mockGetSchema = vi.mocked(apiClient.getSchema);
const mockGetDictionary = vi.mocked(apiClient.getDictionary);
const mockQueryRaw = vi.mocked(apiClient.queryRaw);

describe("ExplorerView", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSchema.mockResolvedValue({
      layer: "warehouse",
      tables: [
        {
          schema_name: "public_warehouse",
          table_name: "dim_customer",
          columns: [
            { column_name: "id", data_type: "integer", is_nullable: false, ordinal_position: 1 },
            { column_name: "first_name", data_type: "text", is_nullable: true, ordinal_position: 2 },
          ],
        },
        {
          schema_name: "public_warehouse",
          table_name: "fact_labor",
          columns: [
            { column_name: "id", data_type: "integer", is_nullable: false, ordinal_position: 1 },
          ],
        },
      ],
    });

    mockGetDictionary.mockResolvedValue({
      business_terms: [
        { term: "active_customer", description: "Customer with IsInactive=0 and Deleted=0", synonyms: ["current customer"] },
      ],
      relationships: [
        { name: "customer_to_pool", description: "Customer → ServiceLocation → Pool" },
      ],
      verified_queries: [],
    });
  });

  it("loads and displays table list", async () => {
    render(<ExplorerView />);
    await waitFor(() => {
      expect(screen.getByText("dim_customer")).toBeInTheDocument();
      expect(screen.getByText("fact_labor")).toBeInTheDocument();
    });
  });

  it("shows columns when table is selected", async () => {
    render(<ExplorerView />);
    await waitFor(() => {
      expect(screen.getByText("dim_customer")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("dim_customer"));

    await waitFor(() => {
      expect(screen.getByText("first_name")).toBeInTheDocument();
      expect(screen.getByText("text")).toBeInTheDocument();
    });
  });

  it("shows business terms from dictionary", async () => {
    render(<ExplorerView />);
    await waitFor(() => {
      expect(screen.getByText("active_customer")).toBeInTheDocument();
      expect(screen.getByText(/IsInactive=0/)).toBeInTheDocument();
    });
  });

  it("shows relationships from dictionary", async () => {
    render(<ExplorerView />);
    await waitFor(() => {
      expect(screen.getByText("customer_to_pool")).toBeInTheDocument();
    });
  });

  it("previews table data when Preview is clicked", async () => {
    mockQueryRaw.mockResolvedValueOnce({
      sql: "SELECT * FROM public_warehouse.dim_customer LIMIT 100",
      columns: ["id", "first_name"],
      results: [[1, "Alice"], [2, "Bob"]],
      row_count: 2,
      explanation: "",
    });

    render(<ExplorerView />);
    await waitFor(() => {
      expect(screen.getByText("dim_customer")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("dim_customer"));

    const previewBtn = await screen.findByRole("button", { name: /preview/i });
    await userEvent.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src-warehouse/views/__tests__/ExplorerView.test.tsx`
Expected: FAIL — component does not exist.

**Step 3: Implement ExplorerView**

Create `src-warehouse/views/ExplorerView.tsx`:

```tsx
import { useEffect, useState } from "react";
import { apiClient } from "../services/ApiClient";
import { ResultsTable } from "../components/ResultsTable";
import type {
  TableInfo,
  DictionaryResponse,
  QueryResponse,
} from "../types/api";

export function ExplorerView() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryResponse | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [preview, setPreview] = useState<QueryResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    apiClient.getSchema().then((res) => setTables(res.tables));
    apiClient.getDictionary().then(setDictionary);
  }, []);

  const handlePreview = async (table: TableInfo) => {
    setPreviewLoading(true);
    try {
      const fq = `${table.schema_name}.${table.table_name}`;
      const result = await apiClient.queryRaw(`SELECT * FROM ${fq} LIMIT 100`);
      setPreview(result);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="flex gap-6 min-h-[500px]">
      {/* Left: Table list */}
      <div className="w-64 flex-shrink-0 space-y-4">
        <h3 className="text-sm font-medium text-neutral-700">Tables</h3>
        <div className="space-y-1">
          {tables.map((t) => (
            <button
              key={`${t.schema_name}.${t.table_name}`}
              onClick={() => {
                setSelectedTable(t);
                setPreview(null);
              }}
              className={`block w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                selectedTable?.table_name === t.table_name
                  ? "bg-primary-50 text-primary-700 font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {t.table_name}
              <span className="text-xs text-neutral-400 ml-1">
                ({t.columns.length} cols)
              </span>
            </button>
          ))}
        </div>

        {/* Business Terms */}
        {dictionary && dictionary.business_terms.length > 0 && (
          <div className="pt-4 border-t border-neutral-200">
            <h3 className="text-sm font-medium text-neutral-700 mb-2">
              Business Terms
            </h3>
            <dl className="space-y-2">
              {dictionary.business_terms.map((bt) => (
                <div key={bt.term}>
                  <dt className="text-sm font-medium text-primary-700">
                    {bt.term}
                  </dt>
                  <dd className="text-xs text-neutral-500">{bt.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Relationships */}
        {dictionary && dictionary.relationships.length > 0 && (
          <div className="pt-4 border-t border-neutral-200">
            <h3 className="text-sm font-medium text-neutral-700 mb-2">
              Relationships
            </h3>
            <dl className="space-y-2">
              {dictionary.relationships.map((rel) => (
                <div key={rel.name}>
                  <dt className="text-sm font-medium text-secondary-700">
                    {rel.name}
                  </dt>
                  <dd className="text-xs text-neutral-500">
                    {rel.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* Right: Detail panel */}
      <div className="flex-1 space-y-4">
        {selectedTable ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  {selectedTable.table_name}
                </h2>
                <p className="text-sm text-neutral-500">
                  {selectedTable.schema_name} &middot;{" "}
                  {selectedTable.columns.length} columns
                </p>
              </div>
              <button
                onClick={() => handlePreview(selectedTable)}
                disabled={previewLoading}
                className="px-4 py-1.5 bg-primary-600 text-white rounded text-sm font-medium
                  hover:bg-primary-700 disabled:opacity-40"
                aria-label="Preview"
              >
                {previewLoading ? "Loading..." : "Preview"}
              </button>
            </div>

            {/* Column list */}
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-neutral-700">
                      Column
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-neutral-700">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-neutral-700">
                      Nullable
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {selectedTable.columns.map((col) => (
                    <tr key={col.column_name} className="hover:bg-neutral-50">
                      <td className="px-4 py-2 font-mono text-neutral-800">
                        {col.column_name}
                      </td>
                      <td className="px-4 py-2 text-neutral-600">
                        {col.data_type}
                      </td>
                      <td className="px-4 py-2 text-neutral-600">
                        {col.is_nullable ? "Yes" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Preview data */}
            {preview && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-neutral-700">
                  Preview (first 100 rows)
                </h3>
                <ResultsTable
                  columns={preview.columns}
                  rows={preview.results}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
            Select a table to view its structure
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src-warehouse/views/__tests__/ExplorerView.test.tsx`
Expected: 5 PASSED

**Step 5: Commit**

```bash
git add src-warehouse/views/ExplorerView.tsx src-warehouse/views/__tests__/ExplorerView.test.tsx
git commit -m "feat: ExplorerView — schema browser with dictionary and preview"
```

---

## Task 11: Frontend — DataView (Data Explorer)

Raw SQL workbench for practitioners.

**Files:**
- Create: `src-warehouse/views/DataView.tsx`
- Create: `src-warehouse/views/__tests__/DataView.test.tsx`

**Step 1: Write the failing test**

Create `src-warehouse/views/__tests__/DataView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataView } from "../DataView";

vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    queryRaw: vi.fn(),
  },
}));

const { apiClient } = await import("../../services/ApiClient");
const mockQueryRaw = vi.mocked(apiClient.queryRaw);

describe("DataView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders SQL editor and run button", () => {
    render(<DataView />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument();
  });

  it("executes SQL and shows results", async () => {
    mockQueryRaw.mockResolvedValueOnce({
      sql: "SELECT 1 AS test",
      columns: ["test"],
      results: [[1]],
      row_count: 1,
      explanation: "User-provided SQL query",
    });

    render(<DataView />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "SELECT 1 AS test");
    await userEvent.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("shows error on failed query", async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error("Prohibited keyword detected"));

    render(<DataView />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "DROP TABLE x");
    await userEvent.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => {
      expect(screen.getByText(/Prohibited keyword/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src-warehouse/views/__tests__/DataView.test.tsx`
Expected: FAIL — component does not exist.

**Step 3: Implement DataView**

Create `src-warehouse/views/DataView.tsx`:

```tsx
import { useState } from "react";
import { apiClient } from "../services/ApiClient";
import { SqlEditor } from "../components/SqlEditor";
import { ResultsTable } from "../components/ResultsTable";
import { ExportButton } from "../components/ExportButton";
import type { QueryResponse } from "../types/api";

export function DataView() {
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    if (!sql.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.queryRaw(sql);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Data Explorer</h2>
        <button
          onClick={handleRun}
          disabled={!sql.trim() || loading}
          className="px-4 py-1.5 bg-success-600 text-white rounded text-sm font-medium
            hover:bg-success-700 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Run"
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      <SqlEditor
        value={sql}
        onChange={setSql}
        onRun={handleRun}
        placeholder="Write your SQL query here..."
      />

      {/* Error */}
      {error && (
        <div className="p-4 bg-error-50 border border-error-200 rounded-lg text-sm text-error-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">
              {result.row_count} rows returned
            </span>
            <ExportButton columns={result.columns} rows={result.results} />
          </div>
          <ResultsTable columns={result.columns} rows={result.results} />
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src-warehouse/views/__tests__/DataView.test.tsx`
Expected: 3 PASSED

**Step 5: Commit**

```bash
git add src-warehouse/views/DataView.tsx src-warehouse/views/__tests__/DataView.test.tsx
git commit -m "feat: DataView — raw SQL workbench with export"
```

---

## Task 12: Frontend — DashboardView

Pin query results as visual cards. Minimal crawl version — localStorage persistence, basic table cards.

**Files:**
- Create: `src-warehouse/views/DashboardView.tsx`
- Create: `src-warehouse/views/__tests__/DashboardView.test.tsx`

**Step 1: Write the failing test**

Create `src-warehouse/views/__tests__/DashboardView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardView } from "../DashboardView";

vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    queryRaw: vi.fn(),
  },
}));

const { apiClient } = await import("../../services/ApiClient");
const mockQueryRaw = vi.mocked(apiClient.queryRaw);

describe("DashboardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows empty state when no cards pinned", () => {
    render(<DashboardView />);
    expect(screen.getByText(/no cards/i)).toBeInTheDocument();
  });

  it("renders add card form", () => {
    render(<DashboardView />);
    expect(screen.getByPlaceholderText(/card title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/sql query/i)).toBeInTheDocument();
  });

  it("adds a card and shows results", async () => {
    mockQueryRaw.mockResolvedValueOnce({
      sql: "SELECT count(*) AS cnt FROM public_warehouse.dim_customer",
      columns: ["cnt"],
      results: [[859]],
      row_count: 1,
      explanation: "",
    });

    render(<DashboardView />);

    await userEvent.type(screen.getByPlaceholderText(/card title/i), "Active Customers");
    await userEvent.type(
      screen.getByPlaceholderText(/sql query/i),
      "SELECT count(*) AS cnt FROM public_warehouse.dim_customer"
    );
    await userEvent.click(screen.getByRole("button", { name: /add card/i }));

    // Card title should appear
    expect(await screen.findByText("Active Customers")).toBeInTheDocument();
    // Result should appear
    expect(await screen.findByText("859")).toBeInTheDocument();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src-warehouse/views/__tests__/DashboardView.test.tsx`
Expected: FAIL — component does not exist.

**Step 3: Implement DashboardView**

Create `src-warehouse/views/DashboardView.tsx`:

```tsx
import { useState, useEffect } from "react";
import { apiClient } from "../services/ApiClient";
import { ResultsTable } from "../components/ResultsTable";
import { ExportButton } from "../components/ExportButton";
import type { QueryResponse } from "../types/api";

interface DashboardCard {
  id: string;
  title: string;
  sql: string;
}

const STORAGE_KEY = "splashworks_dashboard_cards";

function loadCards(): DashboardCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCards(cards: DashboardCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function DashboardView() {
  const [cards, setCards] = useState<DashboardCard[]>(loadCards);
  const [cardResults, setCardResults] = useState<Record<string, QueryResponse>>({});
  const [newTitle, setNewTitle] = useState("");
  const [newSql, setNewSql] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Persist cards
  useEffect(() => {
    saveCards(cards);
  }, [cards]);

  // Refresh all cards on mount
  useEffect(() => {
    cards.forEach((card) => refreshCard(card));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshCard = async (card: DashboardCard) => {
    try {
      const result = await apiClient.queryRaw(card.sql);
      setCardResults((prev) => ({ ...prev, [card.id]: result }));
    } catch {
      // Leave card without results
    }
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !newSql.trim()) return;

    setAddLoading(true);
    const card: DashboardCard = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      sql: newSql.trim(),
    };

    try {
      const result = await apiClient.queryRaw(card.sql);
      setCards((prev) => [...prev, card]);
      setCardResults((prev) => ({ ...prev, [card.id]: result }));
      setNewTitle("");
      setNewSql("");
    } catch {
      // Don't add card if query fails
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setCardResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Add card form */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">Add Dashboard Card</h3>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Card title"
          className="w-full px-3 py-2 rounded border border-neutral-300 text-sm
            focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <textarea
          value={newSql}
          onChange={(e) => setNewSql(e.target.value)}
          placeholder="SQL query for this card"
          className="w-full px-3 py-2 rounded border border-neutral-300 text-sm font-mono
            min-h-[80px] focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          onClick={handleAdd}
          disabled={!newTitle.trim() || !newSql.trim() || addLoading}
          className="px-4 py-1.5 bg-primary-600 text-white rounded text-sm font-medium
            hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Add card"
        >
          {addLoading ? "Adding..." : "Add Card"}
        </button>
      </div>

      {/* Cards grid */}
      {cards.length === 0 ? (
        <div className="text-center py-12 text-neutral-400 text-sm">
          No cards yet. Add a card above to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cards.map((card) => {
            const result = cardResults[card.id];
            return (
              <div
                key={card.id}
                className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-neutral-900">{card.title}</h3>
                  <div className="flex items-center gap-2">
                    {result && (
                      <ExportButton
                        columns={result.columns}
                        rows={result.results}
                        filename={card.title.replace(/\s+/g, "-").toLowerCase()}
                      />
                    )}
                    <button
                      onClick={() => refreshCard(card)}
                      className="text-xs text-neutral-400 hover:text-neutral-600"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={() => handleRemove(card.id)}
                      className="text-xs text-error-400 hover:text-error-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {result ? (
                  <ResultsTable columns={result.columns} rows={result.results} pageSize={10} />
                ) : (
                  <div className="text-sm text-neutral-400">Loading...</div>
                )}
                <details className="text-xs text-neutral-400">
                  <summary className="cursor-pointer hover:text-neutral-600">SQL</summary>
                  <pre className="mt-1 p-2 bg-neutral-50 rounded font-mono overflow-x-auto">
                    {card.sql}
                  </pre>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src-warehouse/views/__tests__/DashboardView.test.tsx`
Expected: 3 PASSED

**Step 5: Commit**

```bash
git add src-warehouse/views/DashboardView.tsx src-warehouse/views/__tests__/DashboardView.test.tsx
git commit -m "feat: DashboardView — pinnable SQL cards with localStorage persistence"
```

---

## Task 13: Frontend — Wire up App.tsx with all views and StatusBar

Connect all views into the app shell and add the StatusBar.

**Files:**
- Modify: `src-warehouse/App.tsx`
- Create: `src-warehouse/__tests__/App.test.tsx`

**Step 1: Write the failing test**

Create `src-warehouse/__tests__/App.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

// Mock all views and StatusBar to isolate App routing logic
vi.mock("../views/QueryView", () => ({
  QueryView: () => <div data-testid="query-view">QueryView</div>,
}));
vi.mock("../views/ExplorerView", () => ({
  ExplorerView: () => <div data-testid="explorer-view">ExplorerView</div>,
}));
vi.mock("../views/DataView", () => ({
  DataView: () => <div data-testid="data-view">DataView</div>,
}));
vi.mock("../views/DashboardView", () => ({
  DashboardView: () => <div data-testid="dashboard-view">DashboardView</div>,
}));
vi.mock("../components/StatusBar", () => ({
  StatusBar: () => <div data-testid="status-bar">StatusBar</div>,
}));

describe("App", () => {
  it("renders header and navigation", () => {
    render(<App />);
    expect(screen.getByText("Splashworks Warehouse")).toBeInTheDocument();
    expect(screen.getByText("AI Query")).toBeInTheDocument();
    expect(screen.getByText("Database Explorer")).toBeInTheDocument();
    expect(screen.getByText("Data Explorer")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows QueryView by default", () => {
    render(<App />);
    expect(screen.getByTestId("query-view")).toBeInTheDocument();
  });

  it("switches to Database Explorer on click", async () => {
    render(<App />);
    await userEvent.click(screen.getByText("Database Explorer"));
    expect(screen.getByTestId("explorer-view")).toBeInTheDocument();
  });

  it("renders StatusBar", () => {
    render(<App />);
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src-warehouse/__tests__/App.test.tsx`
Expected: FAIL — App doesn't render views yet.

**Step 3: Update App.tsx**

Replace `src-warehouse/App.tsx`:

```tsx
import { useState } from "react";
import { QueryView } from "./views/QueryView";
import { ExplorerView } from "./views/ExplorerView";
import { DataView } from "./views/DataView";
import { DashboardView } from "./views/DashboardView";
import { StatusBar } from "./components/StatusBar";

type ViewId = "query" | "explore" | "data" | "dashboard";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "query", label: "AI Query" },
  { id: "explore", label: "Database Explorer" },
  { id: "data", label: "Data Explorer" },
  { id: "dashboard", label: "Dashboard" },
];

const VIEW_COMPONENTS: Record<ViewId, React.FC> = {
  query: QueryView,
  explore: ExplorerView,
  data: DataView,
  dashboard: DashboardView,
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("query");

  const ActiveComponent = VIEW_COMPONENTS[activeView];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <div className="mx-auto max-w-container flex-1 flex flex-col w-full">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-neutral-900">
                Splashworks Warehouse
              </h1>
              <p className="text-sm text-neutral-500">
                AI-powered Business Intelligence
              </p>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b border-neutral-200 sticky top-0 z-10">
          <div className="flex px-6 h-12">
            {VIEWS.map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeView === view.id
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </nav>

        {/* View content */}
        <main className="p-6 flex-1">
          <ActiveComponent />
        </main>
      </div>

      {/* Status bar at bottom */}
      <StatusBar />
    </div>
  );
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src-warehouse/__tests__/App.test.tsx`
Expected: 4 PASSED

**Step 5: Commit**

```bash
git add src-warehouse/App.tsx src-warehouse/__tests__/App.test.tsx
git commit -m "feat: wire App.tsx — all views connected with StatusBar"
```

---

## Task 14: Frontend swap and Vite config update

Move `src/` to `src-legacy/`, move `src-warehouse/` to `src/`, update build config.

**Files:**
- Rename: `src/` → `src-legacy/`
- Rename: `src-warehouse/` → `src/`
- Modify: `vite.config.ts` (remove sql.js, Netlify proxy)
- Modify: `tsconfig.json` (tighten strictness)

**Step 1: Rename directories**

```bash
mv src src-legacy
mv src-warehouse src
```

**Step 2: Update vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
```

**Step 3: Update main.tsx import**

Update `src/main.tsx` to import styles correctly:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Now in the same directory

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 4: Copy index.css from legacy**

```bash
cp src-legacy/index.css src/index.css
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or only pre-existing ones from legacy code).

**Step 6: Verify Vite dev server starts**

Run: `npx vite --port 5173 &` then `curl -s http://localhost:5173 | head -5` then kill the server.
Expected: HTML response containing the React mount point.

**Step 7: Run all frontend tests**

Run: `npx vitest run`
Expected: All new tests pass. Old tests in `src-legacy/` are excluded by tsconfig `include: ["src"]`.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: swap frontend — src-warehouse becomes src, legacy preserved in src-legacy"
```

---

## Task 15: Nginx container and Docker Compose

Add the frontend container to Docker Compose.

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Modify: `docker-compose.yml`

**Step 1: Create Nginx config**

Create `frontend/nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;

    # SPA — all non-API, non-file routes serve index.html
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to FastAPI container
    location /api/ {
        proxy_pass http://api:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 15s;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|svg|ico|woff2?)$ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 256;
}
```

**Step 2: Create multi-stage Dockerfile**

Create `frontend/Dockerfile`:

```dockerfile
# Stage 1: Build the React app
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Step 3: Update docker-compose.yml**

Add the frontend service:

```yaml
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    container_name: splashworks-frontend
    ports:
      - "127.0.0.1:3001:80"
    depends_on:
      - api
    restart: unless-stopped
```

**Step 4: Build locally to verify**

Run: `docker compose build frontend`
Expected: Build succeeds, produces small Nginx image.

**Step 5: Commit**

```bash
git add frontend/ docker-compose.yml
git commit -m "feat: Nginx frontend container — multi-stage build, API proxy"
```

---

## Task 16: E2E Smoke Test (Tier 2A — Active Customer Count)

The simplest full-stack test: NL question → AI → SQL → Postgres → correct answer.

**Files:**
- Create: `api/tests/e2e/test_smoke.py`

**Step 1: Write the smoke test**

Create `api/tests/e2e/__init__.py` (empty) and `api/tests/e2e/test_smoke.py`:

```python
"""
E2E Smoke Test — Active Customer Count

Validates the full stack: FastAPI → AI (Claude) → SQL → Postgres → correct result.

Requirements:
- Postgres running with warehouse data loaded (ETL + dbt build completed)
- ANTHROPIC_API_KEY set
- DATABASE_URL pointing to the warehouse

Run: pytest api/tests/e2e/test_smoke.py -v
"""
import os

import pytest
import requests

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8080")


@pytest.fixture
def api_url():
    return BASE_URL


def requires_live_api():
    """Skip if API is not running."""
    try:
        resp = requests.get(f"{BASE_URL}/api/health", timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


@pytest.mark.skipif(not requires_live_api(), reason="Live API not available")
class TestSmokeActiveCustomerCount:
    """Tier 2A: Active customer count smoke test.

    Why this test: If the number is right, every layer worked — ETL extracted
    the data, dbt transformed it correctly, FastAPI queried it, and the AI
    generated valid SQL. If it's wrong, something in the pipeline broke.
    """

    def test_health_endpoint(self, api_url):
        """Warehouse should be healthy."""
        resp = requests.get(f"{api_url}/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["postgres"] == "connected"

    def test_schema_endpoint(self, api_url):
        """Schema endpoint should return warehouse tables."""
        resp = requests.get(f"{api_url}/api/schema")
        assert resp.status_code == 200
        data = resp.json()
        table_names = [t["table_name"] for t in data["tables"]]
        assert "dim_customer" in table_names

    def test_raw_query_active_customers(self, api_url):
        """Direct SQL should return known active customer count."""
        sql = """
            SELECT _company_name, count(*) AS active_count
            FROM public_warehouse.dim_customer
            WHERE is_inactive = 0
            GROUP BY _company_name
            ORDER BY _company_name
        """
        resp = requests.post(f"{api_url}/api/query/raw", json={"sql": sql})
        assert resp.status_code == 200
        data = resp.json()

        # Build a lookup from results
        results = dict(zip(
            [row[0] for row in data["results"]],
            [row[1] for row in data["results"]],
        ))
        assert results.get("AQPS") == 859, f"Expected AQPS=859, got {results.get('AQPS')}"
        assert results.get("JOMO") == 2402, f"Expected JOMO=2402, got {results.get('JOMO')}"

    def test_nl_query_active_customers(self, api_url):
        """NL query should return plausible active customer count.

        Note: AI-generated SQL may vary, so we check that the result
        is in a reasonable range rather than exact match.
        """
        resp = requests.post(
            f"{api_url}/api/query",
            json={"question": "How many active customers does AQPS have?"},
        )
        assert resp.status_code == 200
        data = resp.json()

        # The AI should generate SQL that returns a count
        assert data["sql"] is not None
        assert len(data["results"]) > 0

        # Check that the result is plausible (within 10% of known value)
        # AI may return slightly different counts depending on SQL generation
        flat_results = [cell for row in data["results"] for cell in row if isinstance(cell, (int, float))]
        assert any(770 <= v <= 950 for v in flat_results), (
            f"Expected a count near 859, got {flat_results}"
        )
```

**Step 2: Verify the test is discoverable**

Run: `python -m pytest api/tests/e2e/test_smoke.py --collect-only`
Expected: 4 tests collected (may be skipped if API isn't running locally).

**Step 3: Commit**

```bash
git add api/tests/e2e/
git commit -m "test: E2E smoke test — active customer count through full stack"
```

---

## Task 17: E2E Acid Test (Tier 2B — Chemical Reading Drill-Down)

The deeper test: exercises the full join path Customer → ServiceLocation → Pool → ServiceStop → ServiceStopEntry.

**Files:**
- Create: `api/tests/e2e/test_acid.py`

**Step 1: Write the acid test**

Create `api/tests/e2e/test_acid.py`:

```python
"""
E2E Acid Test — Chemical Reading Drill-Down

Validates the star schema joins work correctly by querying chemical readings
through the full join path: Customer → ServiceLocation → Pool → ServiceStop →
ServiceStopEntry → EntryDescription.

Why this test: The smoke test only proves simple counts work. The acid test
proves the star schema joins, the semantic layer's understanding of chemical
readings, and the AI's ability to generate multi-table SQL all work together.

Requirements: same as smoke test.
Run: pytest api/tests/e2e/test_acid.py -v
"""
import os

import pytest
import requests

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8080")


def requires_live_api():
    try:
        resp = requests.get(f"{BASE_URL}/api/health", timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


@pytest.mark.skipif(not requires_live_api(), reason="Live API not available")
class TestAcidChemicalReadings:
    """Tier 2B: Chemical reading drill-down acid test.

    Proves the full join path and semantic layer work together.
    """

    def test_dosage_fact_has_data(self):
        """fact_dosage should have rows (proves ETL + dbt transforms for the full join path)."""
        sql = "SELECT count(*) AS cnt FROM public_warehouse.fact_dosage"
        resp = requests.post(f"{BASE_URL}/api/query/raw", json={"sql": sql})
        assert resp.status_code == 200
        data = resp.json()
        count = data["results"][0][0]
        assert count > 0, "fact_dosage should have rows"

    def test_dosage_joins_customer(self):
        """fact_dosage should join to dim_customer via customer key."""
        sql = """
            SELECT c._company_name, count(*) AS readings
            FROM public_warehouse.fact_dosage d
            JOIN public_warehouse.dim_customer c ON d.customer_key = c.customer_key
            GROUP BY c._company_name
            ORDER BY c._company_name
        """
        resp = requests.post(f"{BASE_URL}/api/query/raw", json={"sql": sql})
        assert resp.status_code == 200
        data = resp.json()
        # Should have rows for both companies
        company_names = [row[0] for row in data["results"]]
        assert "AQPS" in company_names or "JOMO" in company_names, (
            f"Expected company names in results, got {company_names}"
        )

    def test_semantic_chemical_entries(self):
        """Semantic layer fact_chemical_entries should return chemical reading data."""
        sql = """
            SELECT entry_description, count(*) AS cnt
            FROM public_semantic.fact_chemical_entries
            GROUP BY entry_description
            ORDER BY cnt DESC
            LIMIT 5
        """
        resp = requests.post(f"{BASE_URL}/api/query/raw", json={"sql": sql})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) > 0, "Should have chemical entry types"

    def test_nl_chemical_reading_query(self):
        """NL query about chemical readings should generate valid multi-join SQL."""
        resp = requests.post(
            f"{BASE_URL}/api/query",
            json={"question": "Show me the most common chemical readings recorded across all customers"},
        )
        assert resp.status_code == 200
        data = resp.json()

        # AI should have generated SQL
        assert data["sql"] is not None
        assert len(data["results"]) > 0, "Should return chemical reading data"

        # The SQL should reference warehouse or semantic tables
        sql_lower = data["sql"].lower()
        assert "public_warehouse" in sql_lower or "public_semantic" in sql_lower, (
            f"SQL should reference warehouse/semantic schema: {data['sql']}"
        )
```

**Step 2: Verify the test is discoverable**

Run: `python -m pytest api/tests/e2e/test_acid.py --collect-only`
Expected: 4 tests collected.

**Step 3: Commit**

```bash
git add api/tests/e2e/test_acid.py
git commit -m "test: E2E acid test — chemical reading drill-down through full join path"
```

---

## Task 18: Update PROGRESS.md and update memory

Final housekeeping — update progress tracker and memory file.

**Files:**
- Modify: `docs/plans/PROGRESS.md`

**Step 1: Update PROGRESS.md**

Add step 1.9 substeps reflecting the actual work done:

```markdown
| 1.9a | New API endpoints | DONE | POST /api/query/raw, GET /api/schema, GET /api/schema/dictionary |
| 1.9b | Clean-room React frontend | DONE | 4 views, 6 shared components, all TypeScript |
| 1.9c | Nginx container | DONE | Multi-stage Docker build, API proxy, static serving |
| 1.9d | Frontend tests | DONE | Unit tests for all components + views |
| 1.9e | E2E tests | DONE | Smoke (active customer count) + Acid (chemical drill-down) |
```

Update current status to reflect Batch C completion.

**Step 2: Commit**

```bash
git add docs/plans/PROGRESS.md
git commit -m "docs: update progress — Phase 1 Batch C complete"
```

---

## Task 19: Deploy to VPS

Manual deploy following the established workflow.

**Step 1: SSH and deploy**

```bash
ssh root@76.13.29.44
cd /opt/splashworks
git pull
docker compose up -d --build
```

**Step 2: Verify health**

```bash
curl -s https://api.splshwrks.com/api/health | python3 -m json.tool
curl -s https://app.splshwrks.com/ | head -5
```

Expected: Health returns `"healthy"`, frontend returns HTML.

**Step 3: Run E2E tests against live API**

```bash
API_BASE_URL=https://api.splshwrks.com python -m pytest api/tests/e2e/ -v
```

Expected: All E2E tests pass against the live deployment.

**Step 4: Verify frontend in browser**

Open `https://app.splshwrks.com` and manually verify:
1. AI Query tab loads, can ask a question
2. Database Explorer shows tables and columns
3. Data Explorer can run raw SQL
4. Dashboard can add a card
5. Export downloads CSV/Excel
6. StatusBar shows "Connected"

---

## Summary

| Task | Deliverable | Tests |
|------|-------------|-------|
| 1 | `POST /api/query/raw` | 8 unit tests |
| 2 | `GET /api/schema` | 3 unit tests |
| 3 | `GET /api/schema/dictionary` | 3 unit tests |
| 4 | ApiClient + types + app shell | 7 unit tests |
| 5 | ResultsTable | 6 unit tests |
| 6 | SqlEditor | 5 unit tests |
| 7 | ExportButton | 7 unit tests |
| 8 | StatusBar | 3 unit tests |
| 9 | QueryView | 4 unit tests |
| 10 | ExplorerView | 5 unit tests |
| 11 | DataView | 3 unit tests |
| 12 | DashboardView | 3 unit tests |
| 13 | App.tsx wired up | 4 unit tests |
| 14 | Frontend swap + Vite config | Build verification |
| 15 | Nginx container + Docker Compose | Build verification |
| 16 | E2E Smoke Test | 4 tests |
| 17 | E2E Acid Test | 4 tests |
| 18 | Progress docs | — |
| 19 | VPS deploy | Manual verification |

**Total: 19 tasks, ~74 tests, 19 commits**
