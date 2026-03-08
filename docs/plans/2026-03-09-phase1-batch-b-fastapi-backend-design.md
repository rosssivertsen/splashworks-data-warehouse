# Phase 1 Batch B: FastAPI Backend — Design Document

**Author:** Ross Sivertsen + Claude Opus 4.6
**Date:** 2026-03-09
**Status:** APPROVED
**Branch:** `feature/warehouse-etl`
**Prerequisite:** Phase 1 Batch A (data pipeline) — COMPLETE

---

## Goal

Get a minimal FastAPI backend serving NL→SQL→results against the Postgres warehouse, verified with curl on the VPS. One happy path, fully tested, end-to-end.

## Scope

**In scope:**
- `POST /api/query` — question in, SQL + results out (Anthropic/Claude only)
- `GET /api/health` — database alive, last ETL timestamp, row counts
- Query guardrails: SELECT-only validation, 10s timeout, 10K row limit
- Layer switching (`warehouse` default, `staging` for diagnostics)
- Docker container on VPS behind `api.splshwrks.com`
- Unit tests + integration tests

**Not in scope (future batches):**
- Frontend changes
- Multi-provider AI (OpenAI, Gemini)
- Dashboard CRUD
- Schema browser endpoint (`GET /api/schema`)
- Cloudflare Access auth

---

## Architecture

```
User (curl/Postman)
  → POST /api/query { "question": "...", "layer": "warehouse" }
  → FastAPI receives request
  → Builds system prompt (schema context for selected layer)
  → Calls Anthropic API → gets SQL back
  → Validates SQL (SELECT-only, no DML/DDL)
  → Executes against Postgres with timeout + row limit
  → Returns { "sql": "...", "results": [...], "columns": [...], "explanation": "..." }
```

### Query Pipeline (5 steps)

1. **Build context** — Load schema metadata (table names, columns, types) for the selected layer from Postgres `information_schema`. Combine with the semantic layer YAML (`docs/skimmer-semantic-layer.yaml`). Build a system prompt that tells Claude which tables exist, their relationships, and business terms.

2. **Call Anthropic** — Send user's question + system prompt to Claude. Parse SQL from the response.

3. **Validate** — Reject anything that isn't a SELECT. Check for prohibited keywords (DROP, ALTER, INSERT, UPDATE, DELETE). No multi-statement (semicolons outside quotes).

4. **Execute** — Run SQL against Postgres with two safety nets:
   - `SET statement_timeout = '10s'` (kill runaway queries)
   - Wrap in `SELECT * FROM (...) sub LIMIT 10000` (cap result size)

5. **Return** — JSON response with generated SQL, column names, result rows, and Claude's explanation.

### Error Responses

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Validation rejection (DML, DDL) | 400 | `{ "error": "DML not allowed", "sql": "..." }` |
| Query timeout | 408 | `{ "error": "Query timed out after 10s", "sql": "..." }` |
| Postgres error | 400 | `{ "error": "database error message", "sql": "..." }` |
| Anthropic API error | 502 | `{ "error": "upstream AI error message" }` |

### Layer Switching

The `layer` parameter controls which Postgres schemas the AI can see:

| Layer | Schemas in prompt | Use case |
|-------|-------------------|----------|
| `warehouse` (default) | `public_warehouse.*`, `public_semantic.*` | Business questions |
| `staging` | `public_staging.*` | Diagnostic / data triage |

Same endpoint, same guardrails, same execution path. Only the system prompt changes. If warehouse and staging return different results for the same question, the problem is in the dbt model. If they agree, the problem is in the source data.

---

## Project Structure

```
api/
  __init__.py
  main.py              -- FastAPI app, CORS, lifespan (DB pool)
  config.py            -- Settings from env vars: DB URL, Anthropic key, timeouts
  routers/
    query.py           -- POST /api/query
    health.py          -- GET /api/health
  services/
    ai_service.py      -- Anthropic call, SQL extraction from response
    query_executor.py  -- Validate SQL, execute against Postgres, format results
    schema_context.py  -- Build system prompt from live Postgres schema
  models/
    requests.py        -- Pydantic: QueryRequest(question, layer)
    responses.py       -- Pydantic: QueryResponse(sql, columns, results, explanation)
  Dockerfile
  requirements.txt
tests/
  unit/
    test_query_validator.py   -- SELECT-only, prohibited keywords, semicolons
    test_schema_context.py    -- Prompt builder produces valid context
    test_ai_service.py        -- SQL extraction from Claude response (mocked)
  integration/
    test_query_endpoint.py    -- Full pipeline: question → SQL → results (real Postgres)
    test_health_endpoint.py   -- Verify health response structure
```

### Key Dependencies

- `fastapi`, `uvicorn` — Web framework
- `psycopg2-binary` — Postgres connection (sync, simple)
- `anthropic` — Claude API client
- `pyyaml` — Semantic layer YAML loading
- `pytest`, `httpx` — Testing

### Secrets Handling

`config.py` reads from environment variables (`os.environ`), passed via Docker Compose `.env` file. No secrets in code or git. The `.env` file on VPS is currently readable by root — hardening (Docker secrets, file permissions) is a deferred post-validation step.

---

## Deployment

- Docker container added to `docker-compose.yml` as `api` service
- Binds to `127.0.0.1:8080`
- Existing Cloudflare tunnel routes `api.splshwrks.com` → `localhost:8080`
- No auth in this batch — Cloudflare Access added in a future batch

---

## Validation Criteria

- `curl https://api.splshwrks.com/api/health` returns DB status and ETL timestamp
- `curl -X POST https://api.splshwrks.com/api/query -d '{"question":"How many active customers does AQPS have?"}'` returns SQL + results
- Same query with `"layer": "staging"` returns comparable results from staging tables
- Unit tests pass locally (`pytest tests/unit/`)
- Integration tests pass against local Docker Postgres (`pytest tests/integration/`)
- All committed and pushed to `feature/warehouse-etl`
