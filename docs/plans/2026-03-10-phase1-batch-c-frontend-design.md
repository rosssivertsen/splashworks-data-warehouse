# Phase 1 Batch C — React Frontend & Full-Stack Integration

**Author:** Ross Sivertsen + Claude Opus 4.6
**Date:** 2026-03-10
**Status:** APPROVED
**Branch:** `feature/warehouse-etl`
**Parent design:** [2026-03-07-data-warehouse-mvp-design.md](./2026-03-07-data-warehouse-mvp-design.md)
**Predecessor:** Phase 1 Batch B (FastAPI backend — steps 1.6-1.8)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture](#2-architecture)
3. [New API Endpoints](#3-new-api-endpoints)
4. [Frontend Application](#4-frontend-application)
5. [Docker Compose & Deployment](#5-docker-compose--deployment)
6. [Testing Strategy](#6-testing-strategy)
7. [Backlog (with Rationale)](#7-backlog-with-rationale)
8. [Decisions Log](#8-decisions-log)

---

## 1. Executive Summary

Batch C completes Phase 1 ("Crawl") of the Splashworks Data Warehouse MVP by delivering a clean-room React frontend that replaces the original client-side SQLite application with an API-driven interface against the Postgres warehouse.

### What we're building

- **Three new FastAPI endpoints** for schema introspection and raw SQL execution
- **Clean-room React frontend** (TypeScript, Vite, Tailwind) with four views: AI Query, Database Explorer, Data Explorer, Dashboard
- **Nginx container** serving the SPA and proxying API calls
- **CSV/Excel export** from any query result
- **Editable SQL** — AI generates SQL, practitioners can inspect, tweak, and re-run
- **Unit tests** for every new component and endpoint
- **Two E2E tests** validating the full stack from ingestion to frontend

### What we're NOT building (deferred to backlog)

Power BI, Metabase, Cloudflare Access, CI/CD, security hardening, query workbench, source system traceability. Each is documented in Section 7 with rationale for deferral.

### Guiding principles (unchanged from parent design)

1. Build the data + knowledge foundation once, deploy agents on top many times
2. Don't paint into a corner — every choice has an upgrade path
3. Crawl, walk, run — simplest working version first
4. Rigorous self-testing at every step

---

## 2. Architecture

### System diagram

```
User (browser)
  │
  ├── app.splshwrks.com ──► Nginx container (port 3001)
  │                              │
  │                              ├── /api/* ──► FastAPI container (port 8080)
  │                              │                  │
  │                              │                  ├── POST /api/query       (NL → SQL → results)
  │                              │                  ├── POST /api/query/raw   (execute user-edited SQL)
  │                              │                  ├── GET  /api/schema      (tables, columns, types)
  │                              │                  ├── GET  /api/schema/dictionary  (semantic descriptions)
  │                              │                  ├── GET  /api/health      (warehouse status)
  │                              │                  │
  │                              │                  └── PostgreSQL 16 + pgvector (warehouse)
  │                              │
  │                              └── /* ──► React static build (index.html, JS, CSS)
  │
  └── api.splshwrks.com ──► FastAPI container (direct API access for future consumers)
```

### Container responsibilities

| Container | Responsibility | Handles |
|-----------|---------------|---------|
| **Nginx** (`frontend`) | Content delivery | HTML, JS, CSS, images, fonts. Proxies `/api/*` to FastAPI. Single origin — no CORS issues. |
| **FastAPI** (`api`) | Data I/O | All database interaction — NL→SQL, raw SQL execution, schema introspection, health checks. Pure data in, data out. |
| **Postgres** (`postgres`) | Data storage | The warehouse. Only FastAPI connects to it. |

### Why this separation

Nginx never touches the database. FastAPI never serves a webpage. Each container does one thing well. This means:
- Restart the API without dropping the frontend, and vice versa
- Tune static file caching/compression independently of API performance
- Future consumers (Power BI API layer, Lambda functions) connect to the API container without touching the frontend

### Network topology

All ports bind to `127.0.0.1` — no direct internet exposure. Cloudflare Tunnels provide the only ingress path:
- `app.splshwrks.com` → `localhost:3001` (Nginx — serves SPA, proxies API)
- `api.splshwrks.com` → `localhost:8080` (FastAPI — direct API access for future consumers)
- `bi.splshwrks.com` → reserved for Metabase (backlog)

---

## 3. New API Endpoints

### Existing endpoints (Batch B, unchanged)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Warehouse health check |
| `/api/query` | POST | Natural language → AI-generated SQL → results |

### New endpoints (Batch C)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/schema` | GET | Tables, columns, types, row counts from the warehouse |
| `/api/schema/dictionary` | GET | Semantic descriptions, business terms, relationships (from `skimmer-semantic-layer.yaml` + `DATA_DICTIONARY.md`) |
| `/api/query/raw` | POST | Execute user-written/edited SQL directly |

### Guardrails (applied to ALL query endpoints)

The existing `validate_sql()` function from Batch B enforces read-only access at the application level:

- **Keyword blocklist:** INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, EXEC/EXECUTE — all rejected
- **SELECT-only enforcement:** Query must start with SELECT
- **Multi-statement rejection:** Semicolons inside query body are blocked (prevents `SELECT 1; DROP TABLE`)
- **10-second statement timeout** at the Postgres connection level
- **10,000 row limit**

**Why application-level guardrails are sufficient for MVP:** The warehouse is internal-only with no external users. Postgres RBAC (read-only role for API queries) is on the backlog for security hardening before external access is enabled.

`POST /api/query/raw` uses the exact same `validate_sql()` function as `POST /api/query` — same guardrails, same code path. The only difference is the SQL source: user's editor vs. AI generation.

### Schema dictionary data sources

The `/api/schema/dictionary` endpoint aggregates context from two existing files:
- `docs/skimmer-semantic-layer.yaml` — business terms, SQL patterns, join paths, verified queries
- `docs/DATA_DICTIONARY.md` — field-level documentation for all 30+ tables

These are already used by the AI service's system prompt (Batch B). The dictionary endpoint makes the same information available to the Database Explorer UI.

---

## 4. Frontend Application

### Approach: Clean room

**Decision:** Build a fresh React frontend from scratch rather than incrementally rewiring the existing app.

**Why:** The existing app has 21 components, all wired to client-side sql.js. Every component receives a `database` object and runs queries in the browser. Rewiring each component carries legacy patterns (`.jsx`, no strict types, sql.js assumptions baked into state management). A clean room build starts with proper TypeScript, API-first architecture, and no dead code to clean up.

**What we preserve from the original:**
- Visual spirit (Tailwind design tokens, color palette, layout patterns)
- Domain knowledge (what tabs are useful, what users need to see)
- Vite + Tailwind build configuration

**What we shed:**
- sql.js and all WebAssembly database code
- Dropbox/cloud storage loaders
- Onboarding flow
- Netlify Functions for AI proxying
- Client-side API key management
- IndexedDB persistence layer

### Application structure

```
src/
  App.tsx                    -- Router, layout shell
  main.tsx                   -- Entry point

  views/
    QueryView.tsx            -- AI Query (default landing page)
    ExplorerView.tsx         -- Database Explorer (schema + dictionary)
    DataView.tsx             -- Data Explorer (raw SQL workbench)
    DashboardView.tsx        -- Dashboard (pinned query result cards)

  components/
    Layout.tsx               -- Header, navigation, status bar
    SqlEditor.tsx            -- SQL code editor (textarea for crawl, Monaco/CodeMirror for walk)
    ResultsTable.tsx         -- Paginated table for query results
    ExportButton.tsx         -- CSV + Excel (.xlsx) download
    StatusBar.tsx            -- Warehouse health indicator
    ErrorBoundary.tsx        -- Graceful error handling per view

  services/
    ApiClient.ts             -- Typed fetch wrapper for all /api/* calls

  types/
    api.ts                   -- Request/response types for all endpoints

  test/
    (unit tests co-located or in __tests__/)
```

### View details

#### AI Query View (`/query`) — Landing page

The primary interface. Conversational NL-to-SQL with editable output.

- Chat-style natural language input
- AI generates SQL → displayed in editable `SqlEditor`
- "Run" button executes edited SQL via `POST /api/query/raw`
- Results rendered in `ResultsTable`
- `ExportButton` on every result set (CSV / Excel)
- The AI response includes the SQL and a natural-language explanation

**Why this is the landing page:** This is the primary use case — practitioners asking business questions in plain English and getting data back. Everything else supports this flow.

#### Database Explorer View (`/explore`)

The discoverability tool. Browse the warehouse to understand what data is available before composing questions.

- Left panel: table list from `GET /api/schema`
- Select a table → shows columns, types, row counts
- Semantic descriptions from `GET /api/schema/dictionary` — what each table and column means in business terms
- Business term glossary: "What does LSI mean? What's a ServiceStop vs a WorkOrder?"
- Key join paths visualized: Customer → ServiceLocation → Pool → ServiceStop
- "Preview" button → shows first 100 rows of any table

**Why this view exists:** Before you can ask a good question (whether in NL or SQL), you need to know what's in the warehouse. Practitioners unfamiliar with the schema need to understand what data are available, the semantics of each field, value ranges, and data types. This is the reference frame that makes the AI Query view usable.

#### Data Explorer View (`/data`)

The power-user SQL workbench.

- SQL editor (full `SqlEditor` component)
- "Run" button → `POST /api/query/raw`
- Results in `ResultsTable` + `ExportButton`
- Same guardrails as all query endpoints (SELECT-only, timeout, row limit)

**Why this exists separately from AI Query:** Different mental model. AI Query is conversational ("ask a question"). Data Explorer is direct ("run this SQL"). Practitioners who know what they want go straight here. Both share the same underlying components.

#### Dashboard View (`/dashboard`)

Pin query results as visual cards for at-a-glance monitoring and demos.

- Pin any query result as a dashboard card
- Basic chart types: bar, line, pie (using existing charting approach or lightweight library)
- Card layout persisted to localStorage (API-backed persistence is a walk/run enhancement)
- Each card shows the underlying SQL (transparency)

### Shared component details

| Component | Crawl implementation | Walk upgrade path |
|-----------|---------------------|-------------------|
| `SqlEditor.tsx` | Styled `<textarea>` with monospace font, basic syntax highlighting via CSS | Monaco Editor or CodeMirror with SQL autocomplete |
| `ResultsTable.tsx` | HTML table with client-side pagination (50 rows/page) | Virtual scrolling for large result sets |
| `ExportButton.tsx` | CSV via Blob URL, Excel via SheetJS (`xlsx` package) | Server-side export for large datasets |
| `StatusBar.tsx` | Polls `GET /api/health` every 30s, shows connected/disconnected + last ETL timestamp | Add row counts per schema, ETL duration |
| `ApiClient.ts` | Typed fetch wrapper with error handling, timeout, retry | Add request caching, auth header injection (Cloudflare Access) |

### UX principles

- **AI Query is the front door** — the most common workflow starts here
- **Editable SQL is shown on every query result** — transparency and practitioner empowerment
- **Export is everywhere** — any result set can be downloaded as CSV or Excel. This is the immediate "presentation layer" escape valve while Power BI/Metabase are on the backlog
- **No authentication in crawl** — internal use only; Cloudflare Access comes with security hardening
- **No client-side database** — every byte of data comes from the API
- **Built for non-technical practitioners** — clean, uncluttered UI that can mature over time

---

## 5. Docker Compose & Deployment

### Docker Compose (updated)

```yaml
services:
  postgres:    # existing — unchanged
  api:         # existing — unchanged
  frontend:    # NEW
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

### Frontend Dockerfile (multi-stage)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
```

**Why multi-stage build:** The React build toolchain (node_modules, Vite, TypeScript compiler) is ~500MB. The final Nginx image with just the static files is ~25MB. We don't ship build tools to production.

### Nginx configuration

```nginx
server {
    listen 80;

    # SPA — all non-API, non-file routes serve index.html
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to FastAPI
    location /api/ {
        proxy_pass http://api:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|svg|ico|woff2?)$ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
```

**Why Nginx over Caddy:** Both work, but Nginx is more ubiquitous in Docker ecosystems, better documented for reverse proxy patterns, and the team has more familiarity with it. Caddy's auto-HTTPS advantage is irrelevant since Cloudflare handles TLS.

**Why Nginx over FastAPI `StaticFiles`:** Separation of concerns. Nginx is purpose-built for static file serving and reverse proxying. FastAPI is purpose-built for API logic. Mixing them means the API process handles static file I/O, which is wasteful and harder to debug independently.

### Cloudflare Tunnel update

Update the tunnel config to route `app.splshwrks.com` to the Nginx container:

| Subdomain | Target | Status |
|-----------|--------|--------|
| `app.splshwrks.com` | `http://localhost:3001` | Currently 502 → will serve SPA |
| `api.splshwrks.com` | `http://localhost:8080` | Already working |
| `bi.splshwrks.com` | Reserved for Metabase | Backlog |

### Deploy workflow (manual)

```bash
ssh root@76.13.29.44
cd /opt/splashworks
git pull
docker compose up -d --build
```

**Why manual deploy:** CI/CD adds complexity that isn't justified for a 1-person team during MVP. The manual workflow is what's been used for Batches A and B. CI/CD is on the backlog for when workflow friction justifies the setup cost.

---

## 6. Testing Strategy

### Why this testing approach

Three tiers, each catching different failure classes. Unit tests catch component-level regressions fast. The E2E smoke test validates the full pipeline cheaply. The E2E acid test proves the data model and AI integration work together. All tests use deterministic test databases (`test-databases/AQPS.db`, `test-databases/JOMO.db`).

### Tier 1: Unit Tests

**Frontend (Vitest):**

| Component | Tests |
|-----------|-------|
| `ApiClient.ts` | Mocked fetch — handles success, error responses, timeouts, network failures |
| `ResultsTable.tsx` | Renders columns/rows correctly, pagination, empty state, large result sets |
| `SqlEditor.tsx` | Renders, accepts input, fires onChange, preserves whitespace |
| `ExportButton.tsx` | Generates correct CSV content, correct Excel content, handles empty data |
| `StatusBar.tsx` | Shows connected/disconnected states, formats timestamps |

**Backend (pytest — extending existing 22 tests):**

| Endpoint | Tests |
|----------|-------|
| `GET /api/schema` | Returns expected table list, column metadata, row counts |
| `GET /api/schema/dictionary` | Returns semantic descriptions, handles missing dictionary gracefully |
| `POST /api/query/raw` | SELECT accepted, INSERT/UPDATE/DELETE/DROP rejected, timeout enforced, row limit enforced, multi-statement rejected |

### Tier 2: E2E Smoke Test ("A" — Active Customer Count)

The simplest possible test that exercises the full stack:

1. Load `test-databases/AQPS.db` via ETL into test Postgres
2. Run `dbt build`
3. Hit `POST /api/query` with "How many active customers does AQPS have?"
4. Assert result contains 859

**Why this test:** If the number is right, every layer worked — ETL extracted the data, dbt transformed it correctly, FastAPI queried it, and the AI generated valid SQL. If it's wrong, something in the pipeline broke.

### Tier 3: E2E Acid Test ("B" — Chemical Reading Drill-Down)

A complex query that exercises the core join path:

1. Same test Postgres setup as Tier 2
2. Hit `POST /api/query` with a query traversing Customer → ServiceLocation → Pool → ServiceStop → ServiceStopEntry → EntryDescription
3. Assert correct join results for a specific customer with known chemical readings

**Why this test:** The smoke test only proves simple counts work. The acid test proves the star schema joins, the semantic layer's understanding of chemical readings, and the AI's ability to generate multi-table SQL all work together.

### Test infrastructure

- Frontend: Vitest (already configured in `vite.config.ts`)
- Backend: pytest (already configured, 22 existing tests)
- E2E: pytest or shell script orchestrating ETL → dbt → API assertions
- Test databases: `test-databases/AQPS.db`, `test-databases/JOMO.db` (deterministic, committed to repo)
- All tests runnable locally and on VPS

---

## 7. Backlog (with Rationale)

Items deferred from Batch C. Each documents *what*, *why it matters*, and *why it's deferred*. This section serves future maintainers (human or AI) who need to understand the intent behind deferral decisions.

### Presentation layer consumers

| Item | Why it matters | Why deferred | Enables |
|------|---------------|--------------|---------|
| **Power BI / Power Query** | Primary reporting tool for Splashworks; FP&A practitioners live in Excel and Power BI | Requires Postgres network exposure decision (open port vs. Cloudflare TCP tunnel vs. API layer); MVP validates the warehouse foundation first | Phase 2 — direct Postgres connection or OData API |
| **Metabase dashboards** | Self-service BI for non-technical users; Tier 1/2/3 dashboards from parent design doc | Additional container + dashboard configuration; React dashboard validates the data presentation layer first | Phase 2 — connect to Postgres, build Daily Pulse / Weekly Performance / Monthly Health dashboards |

### Security & access control

| Item | Why it matters | Why deferred | Enables |
|------|---------------|--------------|---------|
| **Cloudflare Access** | Email-based auth protecting all subdomains; required before external/demo users | No external users during MVP; internal use only | Gate for any external access |
| **Security hardening** | Non-root containers, file permissions, secrets management | Running as root simplifies development; harden before external access | Production readiness |
| **Postgres RBAC** | Read-only role for API queries, separate admin/ETL role | Application-level guardrails (SELECT-only validation) sufficient for internal MVP | Defense in depth before external access |

### Feature enhancements

| Item | Why it matters | Why deferred | Enables |
|------|---------------|--------------|---------|
| **Query workbench** | Save, name, tag, revisit queries; query history | Enhancement over editable SQL; validate core query flow first | Power-user productivity |
| **SQL folding / optimization** | AI-assisted query optimization, CTE folding for complex queries | Backend has basic optimization; enhance after core UX is solid | Performance tuning |
| **Source system traceability** | Hyperlinks from schema dictionary entries to Skimmer support documentation; creates traceability between warehouse data → business function → source system | Requires curating Skimmer doc links; foundational to the knowledge layer but not blocking MVP | **The moat.** As data sources multiply (Skimmer, QBO, Zoho CRM, Xima), practitioners need to understand not just *what* the data is but *where it lives* in the source system and *how it's used* operationally. This is the knowledge layer that makes the AI assistant domain-aware — the competitive differentiator. |
| **CI/CD pipeline** | Automated test → build → deploy on push; catches failures before they hit VPS | Manual deploy works for 1-person team; add when workflow friction justifies setup cost | Team scaling, deployment confidence |

---

## 8. Decisions Log

Every decision with rationale and alternatives considered, for future maintainers.

| Date | Decision | Choice | Rationale | Alternatives Considered |
|------|----------|--------|-----------|------------------------|
| 2026-03-10 | Frontend approach | Clean room (fresh TypeScript) | Existing 21 components all wired to client-side sql.js; rewiring carries legacy patterns (.jsx, no strict types, sql.js assumptions). Clean room starts with proper TypeScript, API-first architecture, no dead code. | Incremental rewire (lower risk but carries legacy baggage; chosen against because the existing codebase has too many sql.js dependencies baked into state management) |
| 2026-03-10 | Frontend serving | Nginx container | Purpose-built for static files + reverse proxy. Separates concerns from FastAPI. ~25MB image via multi-stage build. Restart frontend without touching API. | Caddy (simpler config but less ubiquitous in Docker; auto-HTTPS irrelevant since Cloudflare handles TLS), FastAPI StaticFiles (mixes concerns, API process handles file I/O) |
| 2026-03-10 | SQL interaction model | Editable SQL (AI generates, user can tweak) | Target users are operational and FP&A practitioners familiar enough with SQL to refine output. AI provides the starting point; practitioners refine. | Black box (too limiting for SQL-literate users), Full query workbench (premature — save/name/tag features deferred to backlog) |
| 2026-03-10 | Data Explorer vs. AI Query separation | Two distinct views | Different mental models: AI Query is conversational ("ask a question"), Data Explorer is direct ("run this SQL"). Practitioners who know what they want go straight to Data Explorer. | Single combined view (conflates two workflows; harder to optimize UX for either use case) |
| 2026-03-10 | Database Explorer purpose | Schema + semantic discoverability tool | Practitioners unfamiliar with the schema need to understand what data are available, field semantics, value ranges, and data types before composing good questions. This is the reference frame that makes AI Query usable. | Schema-only browser (misses the semantic layer value), No explorer (forces users to guess at available data) |
| 2026-03-10 | Export format | CSV + Excel (.xlsx) | Immediate "presentation layer" escape valve while Power BI/Metabase are on backlog. Practitioners live in Excel. CSV covers programmatic consumers. | CSV only (Excel is the primary tool for practitioners), API-only (no download — too limiting for immediate use) |
| 2026-03-10 | E2E testing approach | Tiered: smoke (count) + acid (join drill-down) | Smoke test catches pipeline breaks fast (seconds). Acid test catches schema/model/AI integration issues. Both use deterministic test databases. Crawl, walk, run — A first, then B. | Single E2E test (either too simple to catch real issues or too complex for fast feedback), No E2E (unit tests miss integration failures) |
| 2026-03-10 | Deploy workflow | Manual (SSH, git pull, docker compose up) | Same workflow as Batches A and B. Works for 1-person team. CI/CD setup cost not justified until workflow friction increases. | GitHub Actions (more setup, catches failures earlier — deferred to backlog), Git webhook (middle ground but still requires setup) |
| 2026-03-10 | Power BI / Metabase / Cloudflare Access | Deferred to backlog | MVP must validate the full stack (ingestion → warehouse → API → frontend) end-to-end first. Additional presentation consumers and auth layer complexity after the foundation is solid. | Include in Batch C (too much scope for crawl phase; risks diluting focus on core validation) |
| 2026-03-10 | Postgres access control | Application-level guardrails (defer RBAC) | SELECT-only validation, keyword blocklist, timeout, and row limit are enforced at the application level. No external users during MVP. Postgres RBAC (read-only role) added during security hardening. | Implement RBAC now (adds ops complexity during rapid development; running as root simplifies iteration) |
| 2026-03-10 | Source system traceability | Backlog with documented rationale | Foundational to the knowledge-layer moat but requires curating Skimmer documentation links. The schema dictionary (built in this batch) is the prerequisite. | Build now (premature — dictionary endpoint must exist first), Skip entirely (loses the strategic context for future maintainers) |

---

## Appendix: Relationship to Parent Design Doc

This document covers Phase 1 steps 1.9 (React frontend updated) from the parent design doc. Steps 1.10 (Metabase) and 1.11 (Cloudflare Access) are explicitly deferred to the backlog with rationale.

The scope expanded from the parent doc's original vision of "React frontend updated — calls API, no more sql.js" to include:
- Clean room rebuild (vs. incremental rewire)
- New API endpoints for schema introspection and raw SQL execution
- CSV/Excel export capability
- Semantic dictionary in the Database Explorer
- Tiered E2E testing strategy

These additions were driven by the brainstorming session's focus on practitioner usability, self-service data exploration, and rigorous validation. They remain within the crawl philosophy — simplest working version of each capability.
