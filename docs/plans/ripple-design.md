# Ripple — Chat Agent Design Document

**Date:** 2026-03-17
**Status:** Approved
**Author:** Ross Sivertsen + Sherpa (Claude)
**Stream:** EIA-5 (Ripple POC scope + vector store design)

---

## 1. Overview

Ripple is a standalone chat agent for Splashworks that provides conversational access to enterprise knowledge and live data. It uses lightweight RAG over the enterprise information architecture documentation and routes data questions to the existing data warehouse query API.

**Vision:** "Sherpa builds knowledge, Ripple distributes it."

### Users (by priority)

1. **Ross / internal ops** — asking "what's the active customer filter?" or "how does profit calculation work?" while working
2. **AI agents / automations** — querying the knowledge base programmatically to ground their responses
3. **Splashworks team (non-technical)** — asking business questions like "how do we define a cancelled customer?"

### Capabilities

- **Documentation RAG** — answers knowledge questions from the EIA corpus with source citations
- **Live data queries** — routes data questions to the existing `/api/query` pipeline (NL → SQL)
- **Hybrid queries** — retrieves doc context to enrich data queries (e.g., "explain our profit calculation and show me top 10 customers by profit")

### Deployment

- Standalone at `ripple.splshwrks.com`, behind Cloudflare Access
- Docker Compose on existing Hostinger VPS (Vercel migration on backlog)

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────┐
│  ripple.splshwrks.com (Cloudflare Access)           │
│  ┌───────────────┐     ┌──────────────────────┐     │
│  │ Ripple Frontend│────▶│   Ripple API         │     │
│  │ React SPA      │     │   FastAPI :8082      │     │
│  │ (container)    │     │   (container)        │     │
│  └───────────────┘     │                      │     │
│                         │  ┌────────────────┐  │     │
│                         │  │ Intent Router  │  │     │
│                         │  │ (Haiku)        │  │     │
│                         │  └──┬─────────┬───┘  │     │
│                         │     │         │      │     │
│                         │  ┌──▼──┐  ┌───▼───┐  │     │
│                         │  │ Doc │  │ Data  │  │     │
│                         │  │ RAG │  │ Proxy │  │     │
│                         │  │(pgv)│  │       │  │     │
│                         │  └──┬──┘  └───┬───┘  │     │
│                         └────┼──────────┼──────┘     │
│                              │          │            │
│                         ┌────▼──────────▼─────┐      │
│                         │    Postgres 16      │      │
│                         │  ripple schema (pgv)│      │
│                         │  public_* (dbt)     │      │
│                         └─────────────────────┘      │
│                                     ▲                │
│                         ┌───────────┴──────┐         │
│                         │  Data Warehouse  │         │
│                         │  API :8080       │         │
│                         └──────────────────┘         │
└─────────────────────────────────────────────────────┘
```

**Key decisions:**

- **Ripple API** is a separate container but shares the same Postgres instance (new `ripple` schema for embeddings)
- **Data questions** proxy to the existing warehouse API — no duplicated SQL gen logic
- **Doc questions** hit pgvector in the `ripple` schema directly
- **Hybrid questions** retrieve doc context first, then proxy to the data API with enriched context
- **Containers added:** 2 (ripple-api, ripple-frontend). Total: 8 (currently 6).

---

## 3. RAG Corpus & Document Inbox

### Source of truth

The existing `docs/` directory contains the RAG-eligible documentation. A dedicated subdirectory keeps Ripple-specific content separate from EIA and data warehouse docs.

```
docs/
├── enterprise/                  ← EIA glossaries, standards (unchanged)
├── plans/                       ← PROGRESS.md, BACKLOG.md (unchanged)
├── skimmer-semantic-layer.yaml  ← (unchanged)
├── DATA_DICTIONARY.md           ← (unchanged)
├── ERD.md                       ← (unchanged)
└── ripple/
    └── corpus/                  ← Ripple-specific RAG content (inbox)
```

### Corpus manifest

An explicit manifest controls what gets indexed — cherry-picks from existing docs plus the Ripple corpus inbox.

```yaml
# ripple/config/corpus-manifest.yaml
sources:
  # Existing docs (cherry-picked, not copied)
  - docs/enterprise/*.md
  - docs/skimmer-semantic-layer.yaml
  - docs/DATA_DICTIONARY.md
  - docs/ERD.md
  # Ripple-specific corpus
  - docs/ripple/corpus/**/*.md
  - docs/ripple/corpus/**/*.yaml
```

### Current corpus inventory

~165 KB across 15 files, all markdown/YAML:

| Category | Files | Size |
|----------|-------|------|
| Entity glossaries | customer.md, contact.md, service-location.md, pool.md | ~13 KB |
| Semantic layer | skimmer-semantic-layer.yaml | ~36 KB |
| Data dictionary | DATA_DICTIONARY.md | ~50 KB |
| ERD | ERD.md | ~13 KB |
| Standards & references | naming-conventions.md, qbo-accounting-api.md, qbo-payments-api.md | ~18 KB |
| System landscape | system-landscape.md | ~6 KB |
| Other | CLAUDE.md, README.md, etc. | ~29 KB |

---

## 4. Data Model & Chunking Strategy

### Schema

```sql
CREATE SCHEMA IF NOT EXISTS ripple;

CREATE TABLE ripple.doc_chunks (
    id              SERIAL PRIMARY KEY,
    source_file     TEXT NOT NULL,
    chunk_index     INTEGER NOT NULL,
    heading         TEXT,
    content         TEXT NOT NULL,
    embedding       vector(1536),        -- OpenAI text-embedding-3-small
    doc_type        TEXT NOT NULL,        -- glossary, semantic, dictionary, erd, standard, reference
    entity          TEXT,                 -- customer, pool, etc. (nullable)
    checksum        TEXT NOT NULL,        -- MD5 of content, for change detection
    indexed_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_file, chunk_index)
);

CREATE INDEX ON ripple.doc_chunks USING ivfflat (embedding vector_cosine_ops);
```

### Chunking rules

| Doc Type | Strategy | Approx Chunk Size |
|----------|----------|-------------------|
| Glossary entities | Split by `##` heading — each section is a chunk | 200-500 tokens |
| Semantic layer YAML | Split by top-level key, then by individual entry | 100-300 tokens |
| Data dictionary | Split by table — each table's fields as one chunk | 300-800 tokens |
| ERD | Single chunk (Mermaid diagram + relationships) | ~800 tokens |
| Standards/references | Split by `##` heading | 200-500 tokens |

### Embedding model

**OpenAI `text-embedding-3-small`** (1536 dimensions)

- ~$0.02 per million tokens
- Entire corpus embeds for fractions of a penny
- Quality/cost balance for this corpus size

---

## 5. Query Pipeline

```
User message
  │
  ▼
┌──────────────────────────────┐
│  Intent Router (Haiku)       │
│  Classifies into:            │
│    • doc — knowledge Q       │
│    • data — SQL/metrics Q    │
│    • hybrid — both           │
│    • chitchat — greeting     │
└──┬───────┬───────┬───────┬───┘
   │       │       │       │
   ▼       ▼       ▼       ▼
  doc    data    hybrid  chitchat
   │       │       │       │
   │       │       │       └─▶ Haiku: friendly response
   │       │       │
   │       │       └─▶ pgvector search → retrieve doc context
   │       │           → enrich prompt → proxy to /api/query
   │       │           → combine doc explanation + data results
   │       │
   │       └─▶ Proxy to api.splshwrks.com/api/query
   │           (existing Haiku rewriter → Sonnet SQL gen)
   │
   └─▶ pgvector search (top-k chunks)
       → Haiku summarizes with citations
```

### AI model allocation (tiered)

| Path | Models Used | Est. Cost/Query |
|------|------------|-----------------|
| Doc | Haiku (router) + Haiku (answer) | ~$0.001 |
| Data | Haiku (router) + existing pipeline (Haiku + Sonnet) | ~$0.01 |
| Hybrid | Haiku (router) + Haiku (doc retrieval) + existing pipeline | ~$0.012 |
| Chitchat | Haiku only | ~$0.0005 |

### Model versions

- **Router + Doc answers:** `claude-haiku-4-5-20251001`
- **SQL generation:** `claude-sonnet-4-20250514` (via existing warehouse API)
- **Embeddings:** OpenAI `text-embedding-3-small`
- **Multi-provider via AI Gateway:** on backlog

---

## 6. API Design

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/chat` | Main chat endpoint — classifies, retrieves, responds (streaming SSE) |
| POST | `/api/chat/feedback` | Thumbs up/down on responses |
| GET | `/api/health` | Health check |
| GET | `/api/corpus/status` | Indexed file count, chunk count, last indexed timestamp |
| POST | `/api/corpus/reindex` | Trigger re-indexing (admin only) |

### Request/response

```json
// POST /api/chat
// Request
{
  "message": "What is the active customer filter?",
  "conversation_id": "optional-uuid"
}

// Response (streaming SSE)
data: {"type": "intent", "intent": "doc", "confidence": 0.95}
data: {"type": "sources", "sources": [{"file": "docs/enterprise/customer.md", "heading": "Active vs Inactive"}]}
data: {"type": "token", "content": "The active"}
data: {"type": "token", "content": " customer filter"}
data: {"type": "token", "content": " requires both conditions..."}
data: {"type": "done", "message_id": "uuid"}
```

### Design principles

- **Stateless by default** — `conversation_id` is optional for single-turn agent queries
- **Agent-consumable from day 1** — same endpoint works for React frontend and AI agents
- **No auth beyond Cloudflare Access** — same as the rest of the stack
- **No conversation persistence** in Phase 1 — added in Phase 3

---

## 7. Frontend

Lightweight React SPA — same stack as `app.splshwrks.com`.

```
ripple/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx    ← message list + input
│   │   │   ├── Message.tsx       ← single message (user or assistant)
│   │   │   ├── Sources.tsx       ← citation cards (collapsible)
│   │   │   └── DataResult.tsx    ← table/chart for data queries
│   │   ├── hooks/
│   │   │   └── useChat.ts        ← SSE streaming hook
│   │   └── services/
│   │       └── api.ts            ← fetch wrapper
│   ├── Dockerfile
│   └── package.json
```

### UX decisions

- **Single-page chat** — no sidebar, no navigation
- **Message types:** text (markdown rendered), data results (table + optional chart), sources (collapsible citation list)
- **Streaming** — token-by-token via SSE
- **Dark mode** — matches the existing app aesthetic
- **Branding:** minimal — "Ripple" wordmark, Splashworks accent color

### Intentionally simple (Phase 1)

- No conversation history — refresh = new chat
- No multi-conversation sidebar
- No user accounts (Cloudflare Access handles auth)

---

## 8. Infrastructure & Deployment

### Docker Compose additions

```yaml
  ripple-api:
    build: ./ripple/api
    ports:
      - "8082:8082"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres

  ripple-frontend:
    build: ./ripple/frontend
    ports:
      - "3003:80"
    depends_on:
      - ripple-api
```

### Cloudflare Tunnel

Add route to existing `splashworks-warehouse` tunnel:

```yaml
- hostname: ripple.splshwrks.com
  service: http://localhost:3003
```

### New environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | For `text-embedding-3-small` embeddings only |

All other variables reuse existing config (`DATABASE_URL`, `ANTHROPIC_API_KEY`).

### Resource impact

- ~100-200 MB RAM for both containers combined
- VPS has 8 GB, currently using ~3-4 GB

---

## 9. Implementation Phases

### Phase 1: Crawl — Doc RAG Only

**Goal:** Ripple answers questions about documentation.

| Step | Task | Details |
|------|------|---------|
| 1.1 | Scaffold `ripple/` directory | `api/`, `frontend/`, `cli/`, `config/` |
| 1.2 | Corpus manifest | `corpus-manifest.yaml` pointing at existing docs + `docs/ripple/corpus/` |
| 1.3 | Chunking + indexing script | Python: reads manifest → chunks by heading → embeds via OpenAI → upserts to `ripple.doc_chunks` |
| 1.4 | Ripple API (doc path only) | FastAPI: `/api/chat` with pgvector search → Haiku response with citations |
| 1.5 | Ripple frontend | Minimal React chat UI with streaming |
| 1.6 | Docker + tunnel | Two containers, Cloudflare route for `ripple.splshwrks.com` |
| 1.7 | Deploy + smoke test | End-to-end: ask a doc question, get a cited answer |

**Done when:** "What is the active customer filter?" returns a correct, cited answer.

### Phase 2: Walk — Add Data Routing

**Goal:** Ripple handles both doc and data questions.

| Step | Task | Details |
|------|------|---------|
| 2.1 | Intent router | Haiku classifier: doc / data / hybrid / chitchat |
| 2.2 | Data proxy | Forward data questions to `api.splshwrks.com/api/query` |
| 2.3 | Hybrid path | Retrieve doc context → enrich data query prompt → proxy |
| 2.4 | DataResult component | Render tables/charts for data responses |
| 2.5 | Feedback endpoint | `POST /api/chat/feedback` — thumbs up/down |

**Done when:** "How many active AQPS customers?" returns a number, and "What does active mean and how many do we have?" does both.

### Phase 3: Run — Polish & Agent Access

**Goal:** Production-ready, agent-consumable.

| Step | Task | Details |
|------|------|---------|
| 3.1 | Conversation persistence | Store chat history in Postgres |
| 3.2 | Corpus status dashboard | `/api/corpus/status` + UI showing indexed docs |
| 3.3 | Reindex endpoint | `POST /api/corpus/reindex` — trigger from browser |
| 3.4 | Agent documentation | OpenAPI spec, usage examples for AI consumers |
| 3.5 | Nightly reindex | Add to `nightly-pipeline.sh` (incremental, checksum-based) |
| 3.6 | Pinecone migration (optional) | Swap pgvector for Pinecone if scale warrants |

**Done when:** Ripple is stable, self-maintaining, and consumable by other AI agents.

---

## 10. Backlog Items (Deferred)

| Item | Description | Trigger |
|------|-------------|---------|
| Multi-provider AI Gateway | Route through Vercel AI Gateway for failover/cost tracking | When Vercel migration happens |
| Pinecone vector store | Replace pgvector with Pinecone (EIA-6) | When corpus exceeds ~1 MB or needs metadata filtering at scale |
| Vercel deployment | Migrate frontend (or all) to Vercel | When VPS constraints appear |
| Non-repo content ingestion | Upload endpoint for PDFs, external docs | When AQ-8 (Pool Deck KB RAG) begins |
| Multi-user conversation history | Per-user chat history with auth | When team (priority B users) onboards |
| Ripple MCP server | Expose Ripple as an MCP tool for other AI agents | When agent ecosystem grows |

---

## 11. Directory Structure

```
splashworks-data-warehouse/
├── ripple/
│   ├── api/
│   │   ├── main.py                  ← FastAPI app
│   │   ├── services/
│   │   │   ├── intent_router.py     ← Haiku intent classification
│   │   │   ├── doc_retriever.py     ← pgvector search + Haiku response
│   │   │   ├── data_proxy.py        ← proxy to warehouse API
│   │   │   └── embeddings.py        ← OpenAI embedding calls
│   │   ├── models/
│   │   │   └── schemas.py           ← Pydantic models
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── cli/
│   │   └── index_docs.py            ← chunking + embedding + upsert
│   └── config/
│       └── corpus-manifest.yaml     ← what gets indexed
├── docs/
│   ├── ripple/
│   │   └── corpus/                  ← Ripple-specific RAG inbox
│   └── plans/
│       └── ripple-design.md         ← this document
└── ...
```
