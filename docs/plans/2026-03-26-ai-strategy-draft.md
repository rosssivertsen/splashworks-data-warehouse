# Splashworks AI Strategy — Draft

**Author:** Ross Sivertsen + Sherpa (Claude)
**Date:** 2026-03-26
**Status:** DRAFT — for review

---

## Executive Summary

Splashworks has built something most small businesses never achieve: a structured, semantically rich data foundation with an enterprise glossary, a dimensional warehouse, a working RAG pipeline, and an AI query layer — all operational. The AI strategy isn't about starting from zero. It's about recognizing what you've already built as a platform and deliberately compounding it.

**The thesis:** Splashworks' competitive advantage isn't pool service expertise alone — it's *encoded, queryable pool service intelligence*. Every glossary entry, every verified SQL pattern, every business rule captured in the EIA becomes training material for AI agents that get smarter as the knowledge base grows. Competitors have data in spreadsheets. Splashworks has data in a warehouse with a semantic layer that AI can reason over.

**Three horizons:**

1. **Now (Q2 2026):** Complete the knowledge foundation and make Ripple the single conversational interface for all Splashworks data and documentation
2. **Next (Q3-Q4 2026):** Deploy specialized AI agents for operational workflows (scheduling, customer health, chemical optimization)
3. **Later (2027+):** Multi-tenant AI platform — offer the same intelligence infrastructure to other pool service companies

---

## 1. What You Have (The Foundation)

Before planning what to build, it's worth being explicit about what's already in place. This is unusually strong for a company of Splashworks' size.

### Data Infrastructure
| Asset | State | Significance |
|-------|-------|-------------|
| Postgres 16 + pgvector | Production, nightly refresh | Unified analytical store with vector search capability |
| dbt pipeline (21 staging + 11 facts + 8 semantic models) | Production | Reproducible, tested transformations |
| Nightly ETL with reconciliation | Production | Automated data freshness with 6 integrity checks |
| Incremental fact accumulation | Production | History beyond the 6-month Skimmer window |

### Knowledge Layer (The Moat)
| Asset | State | Significance |
|-------|-------|-------------|
| Enterprise glossary (8 entities) | v1.1, agent-ready frontmatter in progress | Machine-readable business definitions — not just docs, but structured knowledge |
| Semantic layer YAML (16 business terms, 14 verified queries, 20 industry metrics) | Production | The "Rosetta Stone" between natural language and SQL |
| Naming conventions standard | v1.0 | Cross-system disambiguation rules |
| System landscape diagram | v1.0 | Integration topology for agents to understand data provenance |
| Cross-system field mappings | Per entity | Agents know that Skimmer `IsInactive=0` = QBO `Active=true` |
| Data dictionary (44 tables) | Complete | Field-level documentation of every source table |

### AI Applications
| Asset | State | Significance |
|-------|-------|-------------|
| AI Query App (app.splshwrks.com) | Production | NL→SQL with semantic rewriting, confidence scoring, SQL repair |
| Ripple (ripple.splshwrks.com) | Phase 1 deployed (doc RAG) | Conversational access to enterprise knowledge, 222 chunks indexed |
| Two-stage query pipeline | Production | Haiku rewriter → Sonnet SQL gen → auto-repair |
| rpt_customer_360 | Production | One-row-per-customer denormalized view — the "ask me anything about a customer" table |

### What This Means

Most AI strategies start with "we need to collect data." Splashworks starts with "we have structured data, a semantic layer, a knowledge graph, and two working AI applications." The strategy is about *leverage*, not *foundation-building*.

---

## 2. Strategic Principles

These should govern every AI decision at Splashworks:

### 2.1 Knowledge compounds, models don't

Every verified query added to the semantic layer, every glossary entity documented, every business rule encoded — these permanently improve every AI agent that consumes them. Model upgrades are free performance gains on top of this foundation. Invest in knowledge capture first, model sophistication second.

### 2.2 One warehouse, many agents

The data warehouse and EIA are shared infrastructure. AI agents are consumers with different specializations. Never duplicate the data layer for a specific agent. If an agent needs data in a form that doesn't exist, add a dbt model — it benefits every agent.

### 2.3 Let failure patterns drive design

Don't speculate about what agents need. Ship the simplest version, watch where it fails, and fix those failure patterns. The semantic rewriter (AQ-4) was born this way — AI-generated SQL kept failing on business term mismatches, so you built a Haiku preprocessor. This pattern should continue.

### 2.4 Agent-ready by default

Every new document, every new dbt model, every new business rule should be agent-consumable from day one. This means:
- YAML frontmatter on all EIA docs (EIA-1, in progress)
- Enterprise index manifest for auto-discovery (EIA-2)
- Structured semantic layer entries, not prose
- OpenAPI specs on all endpoints

### 2.5 Humans set direction, agents execute

AI at Splashworks should amplify Ross and the team, not replace judgment. The pattern is: human defines the question or workflow, AI handles the tedious execution (querying, summarizing, alerting, routing).

---

## 3. Horizon 1: Complete the Knowledge Foundation (Q2 2026)

**Goal:** Make the EIA + warehouse + Ripple a closed loop where any business question about Splashworks operations can be answered conversationally.

### 3.1 Finish EIA Agent-Readiness

| Item | What | Why |
|------|------|-----|
| EIA-1 | YAML frontmatter on all glossary/standards docs | Agents can discover and filter docs by entity, type, system |
| EIA-2 | `enterprise-index.yaml` manifest | Single catalog for any agent to enumerate all available knowledge |
| EIA-4 | Technician + Route glossary entities | Completes the operational entity set — scheduling and staffing are core workflows |

**Outcome:** Any AI agent can programmatically discover, filter, and consume the entire Splashworks knowledge base without hardcoded paths.

### 3.2 Complete Ripple Phase 2 (Intent Router + Data Proxy)

This is the highest-leverage near-term item. Ripple Phase 1 answers doc questions. Phase 2 makes it the *single entry point* for all Splashworks intelligence:

| Step | What | Impact |
|------|------|--------|
| RP-2.1 | Intent router (Haiku classifier: doc/data/hybrid/chitchat) | One interface for all question types |
| RP-2.2 | Data proxy to warehouse API | "How many active AQPS customers?" works in Ripple |
| RP-2.3 | Hybrid path (doc context enriches data queries) | "Explain our profit calculation and show top 10" — the killer feature |
| RP-2.5 | Feedback endpoint | Closes the learning loop |

**Outcome:** ripple.splshwrks.com becomes the *primary interface* for Splashworks data. Non-technical team members ask questions in plain English. Technical users get SQL + explanations. AI agents use the same endpoint programmatically.

### 3.3 Expand the Semantic Layer

The semantic layer is the single highest-ROI artifact in the entire project. Every verified query added here improves every AI agent simultaneously.

| Addition | Why |
|----------|-----|
| Route skip/move metrics (from DL-11, DL-12) | "What % of stops were skipped last month?" — new fact tables exist, semantic layer doesn't reference them yet |
| Invoice item metrics (from DL-10) | Product mix analysis, cross-sell patterns |
| rpt_customer_360 examples | The AI sometimes builds complex multi-join queries when it should just hit the 360 table |
| Unanswerable → answerable conversions | As new data sources come online (QBO direct, time & attendance), move metrics from "unanswerable" to "answerable" |

### 3.4 Source Traceability (ETL-6, ETL-7, ETL-8)

| Item | What | Why for AI |
|------|------|-----------|
| ETL-6 | `_loaded_at` + `_extract_date` on facts | Agents can answer "when did this data enter the warehouse?" |
| ETL-7 | Row-level trace CLI | Debugging tool: trace a record from Skimmer through to semantic layer |
| ETL-8 | `rpt_reconciliation` dbt model | Auditable trail — agents can report on data quality over time |

**Outcome:** The warehouse becomes self-describing. An agent can not only query the data but explain its provenance.

---

## 4. Horizon 2: Specialized AI Agents (Q3-Q4 2026)

Once the knowledge foundation is complete and Ripple is the unified conversational interface, the next step is deploying purpose-built agents for specific operational workflows.

### 4.1 Agent Architecture

```
                    ┌─────────────────────────────┐
                    │    Ripple (Conversational)    │
                    │    ripple.splshwrks.com       │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │     Agent Router / Orchestrator│
                    │     (Claude Agent SDK or WDK)  │
                    └──┬──────┬──────┬──────┬─────┘
                       │      │      │      │
              ┌────────▼┐ ┌──▼────┐ ┌▼─────┐ ┌▼─────────┐
              │Customer  │ │Route  │ │Chem  │ │Financial  │
              │Health    │ │Optim  │ │Advisor│ │Digest     │
              │Agent     │ │Agent  │ │Agent │ │Agent      │
              └────┬─────┘ └──┬───┘ └──┬───┘ └────┬──────┘
                   │          │        │           │
              ┌────▼──────────▼────────▼───────────▼──────┐
              │         Shared Infrastructure               │
              │  ┌─────────────┐  ┌────────────────────┐   │
              │  │  Postgres    │  │  EIA Knowledge     │   │
              │  │  Warehouse   │  │  Base (pgvector)   │   │
              │  └─────────────┘  └────────────────────┘   │
              └────────────────────────────────────────────┘
```

**Key decision: Agent SDK vs. hand-rolled**

The Ripple design doc already notes the intention to use Claude Agent SDK for intent routing (RP-2.1). This is the right call. As you add more specialized agents, the orchestration question becomes: do you build a custom router, or use an agent framework?

**Recommendation:** Start with Claude Agent SDK for Ripple Phase 2 (intent routing). If you need durable execution (agents that survive crashes, retry on failure, pause for human approval), evaluate Vercel Workflow DevKit (WDK) when migration to Vercel happens. For now, the VPS + Agent SDK is the right fit.

### 4.2 Candidate Agents

Prioritized by ROI and data readiness:

#### Customer Health Agent (HIGH priority)
- **Trigger:** Nightly, after ETL
- **Input:** rpt_customer_360 + fact_service_stop + fact_payment
- **Output:** Proactive alerts — "3 AQPS customers haven't been serviced in 2+ weeks", "JOMO customer Grand Oaks is 45 days past due"
- **Value:** Churn prevention. The data already exists; the warehouse already has customer lifecycle columns. This agent just needs to watch for signals.
- **Delivery:** Slack notification or Telegram message to Ross

#### Chemical Optimization Advisor (MEDIUM priority)
- **Trigger:** On demand via Ripple or scheduled weekly
- **Input:** fact_service_stop (chemical readings), dim_pool (gallons), semantic layer
- **Output:** "Pool at 123 Oak St has had high chlorine 4 visits in a row — reduce dosage", "LSI is trending acidic at Grand Oaks"
- **Blocked on:** DX-2 (LSI calculation model) — but basic chlorine/pH trend analysis can start now
- **Value:** Chemical waste reduction, water quality improvement. Differentiator for customer retention.

#### Route Efficiency Agent (MEDIUM priority)
- **Trigger:** Weekly digest or on-demand
- **Input:** fact_route_skip + fact_route_move + fact_service_stop + dim_route_assignment
- **Output:** "Tech Mike had 12% skip rate last week (company avg: 5%)", "Route 7 had 3 schedule disruptions — consider rebalancing"
- **Blocked on:** DS-3 (GPS/telematics) for drive time, but skip/move analysis can start immediately
- **Value:** Operational efficiency. Skip and move data already in the warehouse (DL-11, DL-12).

#### Financial Digest Agent (LOW priority — wait for QBO direct integration)
- **Trigger:** Weekly/monthly
- **Input:** fact_invoice + fact_payment + rpt_customer_360
- **Output:** "Revenue up 8% MoM. 14 invoices overdue >30 days totaling $4,200. Top 3 customers by LTV are..."
- **Blocked on:** QBO direct warehouse integration for richer financial data
- **Value:** Executive summary. Useful but not urgent — Metabase already covers basic financial dashboards.

### 4.3 Agent Infrastructure Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Agent framework | Claude Agent SDK (now), WDK (when on Vercel) | Lightweight start, upgrade path clear |
| Notification channel | Telegram (Ross), Slack (team) | Ross already has Telegram MCP; Slack when team grows |
| Scheduling | Extend nightly-pipeline.sh with agent triggers | Agents run after ETL + dbt, when data is fresh |
| Cost model | Haiku for routing + triage, Sonnet for synthesis | Same tiered model as existing query pipeline |
| State | Postgres (new `agents` schema) | Agent run history, alert dedup, feedback tracking |
| Feedback loop | Thumbs up/down on agent outputs → refine prompts | Same pattern as Ripple Phase 2 feedback |

---

## 5. Horizon 3: Platform Vision (2027+)

This is the "run" phase. Only worth planning directionally — details will be informed by what's learned in Horizons 1-2.

### 5.1 Multi-Tenant Intelligence Platform

Splashworks operates two companies (AQPS, JOMO) on the same warehouse with `_company_name` isolation. The architecture already supports multi-tenancy. The long-term play:

1. **Onboard other pool service companies** onto the same warehouse pattern (different Skimmer exports, same ETL/dbt/semantic layer)
2. **Cross-company benchmarking:** "Your skip rate is 8% — the network average is 5%. Here's what top performers do differently."
3. **Shared knowledge base:** Pool chemistry best practices, seasonal patterns, equipment lifecycle data — all enriched by the combined corpus

This is the "knowledge layer moat" vision from the design doc. The more companies on the platform, the better the AI gets for everyone.

### 5.2 External Knowledge Ingestion

The backlog already identifies two high-value external sources:
- **AQ-8: Pool Deck Knowledge Base** — Skimmer's help articles on pool chemistry, equipment, operations
- **AQ-9: Pool Deck Community** — Crowdsourced operator knowledge

These feed directly into the Ripple RAG corpus and enrich every agent's vocabulary. A pool service operator asking "what's a good stabilizer level?" gets an answer grounded in both Splashworks' own data and industry best practices.

### 5.3 Vercel Migration Path

The current VPS (Hostinger KVM-2) is the right choice for the current scale. When to consider migration:

| Signal | Migration Trigger |
|--------|-------------------|
| Team grows beyond Ross + 1-2 people | Need preview deployments, CI/CD |
| Agent count exceeds 3-4 | Need durable execution (WDK), better scaling |
| Customer-facing agent access | Need edge performance, global CDN |
| Cost of VPS management exceeds Vercel pricing | Time spent on ops > $20/mo Vercel cost |

The stack is already Vercel-compatible: React + FastAPI + Postgres. Migration is a deployment change, not a rewrite.

---

## 6. Data Strategy for AI

The data strategy isn't separate from the AI strategy — it *is* the AI strategy. Every data investment directly improves AI capability.

### 6.1 Priority Data Investments

| Investment | AI Impact | Status |
|------------|-----------|--------|
| **QBO direct integration** | Unlocks financial digest agent, removes Skimmer as bottleneck for payment/invoice data | Planned (system landscape) |
| **Time & attendance** (Homebase/Deputy) | Unlocks technician utilization, true cost-of-service, route efficiency | Blocked on vendor selection (DS-1) |
| **GPS/telematics** | Unlocks drive time, route density, on-time arrival | Blocked on vendor selection (DS-3, DS-4) |
| **Zoho CRM full sync** | Unlocks lead-to-booking conversion, CAC, pipeline forecasting | POC in progress |
| **Equipment tables** (ETL-4) | Unlocks equipment lifecycle, replacement prediction, parts spend | Ready to build |

### 6.2 The Semantic Layer as AI Training Data

This is the most important architectural insight: **the semantic layer YAML is not documentation — it's a prompt engineering artifact.**

Every entry in `skimmer-semantic-layer.yaml` teaches the AI:
- What business terms mean (`active_customer`, `profit`, `cancelled_customer`)
- How to translate them to SQL (`WHERE is_inactive = 0`)
- What tables to use (`[dim_customer]`)
- What synonyms to recognize (`"churned"`, `"lost customer"`, `"deactivated"`)
- What the system can't answer and why (unanswerable metrics with explanations)
- What verified queries look like (few-shot examples)

**Action:** Treat the semantic layer as a first-class product. Every time someone asks a question the AI can't answer well, the fix is usually a new semantic layer entry — not a code change.

### 6.3 Feedback Loops

```
User asks question
     │
     ▼
AI generates answer
     │
     ▼
User provides feedback (thumbs up/down, correction)
     │
     ▼
Feedback → new verified query OR semantic layer fix OR glossary update
     │
     ▼
All agents improve
```

This loop is the engine. Ripple Phase 2 (RP-2.5) adds the feedback endpoint. The discipline is: every piece of feedback gets triaged into one of three buckets:
1. **New verified query** — add to semantic layer
2. **Glossary correction** — update EIA entity
3. **Model/prompt fix** — update system prompt or dbt model

---

## 7. Cost Model

### Current Costs

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| VPS (Hostinger KVM-2) | ~$12 | Prepaid 2 years |
| Anthropic API (Haiku + Sonnet) | ~$5-15 | Low query volume currently |
| OpenAI API (embeddings) | <$1 | 222 chunks, fraction of a penny to embed |
| Cloudflare (Free plan) | $0 | Tunnels, DNS, Access all free tier |
| **Total** | **~$15-30/mo** | |

### Projected Costs (with agents)

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| VPS | ~$12 | Same — agents are lightweight Python on existing hardware |
| Anthropic API | ~$30-60 | More agent queries, nightly proactive runs |
| OpenAI API (embeddings) | ~$2-5 | Larger corpus with Pool Deck content |
| Notification service (Telegram/Slack) | $0 | Free tier |
| **Total** | **~$45-80/mo** | |

The cost scales with query volume and agent frequency, not with data volume. The expensive investment (warehouse, ETL, dbt) is already sunk.

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Over-engineering agents before knowledge layer is complete | Medium | High — agents built on incomplete knowledge produce bad outputs | Finish EIA + semantic layer expansion BEFORE building new agents |
| Single point of failure (VPS) | Low-Medium | High — all services on one box | Docker Compose makes migration straightforward; Postgres backups exist |
| AI hallucination in operational agents | Medium | High — wrong alerts erode trust | Confidence scoring (already built), human-in-the-loop for high-stakes actions, feedback loops |
| Scope creep — building platform before product is solid | Medium | Medium — distraction from core value | Strict crawl/walk/run discipline. No Horizon 3 work until Horizon 1 is complete |
| Data freshness (nightly only) | Low | Medium — agents work on yesterday's data | Acceptable for current use cases. Real-time only needed if customer-facing |
| API cost spike from runaway agents | Low | Low-Medium | Set per-agent daily cost caps, monitor with reconciliation |

---

## 9. Recommended Roadmap

### Q2 2026 (Horizon 1 — Foundation)

| Month | Focus | Key Deliverables |
|-------|-------|-----------------|
| April | EIA completion + Ripple Phase 2 | EIA-1 (frontmatter), EIA-2 (manifest), EIA-4 (tech/route entities), RP-2.1/2.2 (intent router + data proxy) |
| May | Semantic layer expansion + traceability | New verified queries for skip/move/invoice data, ETL-6 (row provenance), RP-2.3 (hybrid queries) |
| June | Feedback loop + knowledge base growth | RP-2.5 (feedback endpoint), AQ-8 (Pool Deck KB RAG), first feedback-driven semantic layer updates |

### Q3 2026 (Horizon 2 — First Agents)

| Month | Focus | Key Deliverables |
|-------|-------|-----------------|
| July | Customer Health Agent | Nightly churn risk alerts, overdue payment flags |
| August | Chemical Advisor Agent + DX-2 (LSI model) | Weekly chemical optimization recommendations |
| September | Route Efficiency Agent | Skip rate analysis, schedule disruption alerts |

### Q4 2026 (Horizon 2 — Polish + External Data)

| Month | Focus | Key Deliverables |
|-------|-------|-----------------|
| October | QBO direct integration | Independent financial data pipeline |
| November | Financial Digest Agent | Weekly/monthly executive summaries |
| December | Review + 2027 planning | Assess platform readiness for multi-tenant |

---

## 10. Success Metrics

### Horizon 1

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Ripple answers doc + data questions | Phase 2 deployed | Smoke test: hybrid query works |
| Semantic layer coverage | 25+ verified queries (from 14) | Count in YAML |
| EIA entities | 12+ (from 8) | Count in glossary/ |
| AI query accuracy on verified patterns | >90% | E2E test suite pass rate |

### Horizon 2

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Customer Health Agent catches churn signals | 1+ actionable alert per week | Alert log review |
| Chemical Advisor reduces waste | Qualitative — "this is useful" from Ross | User feedback |
| Route Efficiency identifies patterns | Skip rate variance by tech is visible | Agent output review |
| Time from question to answer | <10 seconds for doc, <20 seconds for data | Ripple response timing |

### Ongoing

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Monthly AI cost | <$100 | Anthropic + OpenAI billing |
| Feedback loop velocity | Every correction → semantic layer update within 1 week | Commit log |
| Knowledge base growth | 2+ new verified queries per month | Semantic layer YAML diff |

---

## Appendix A: Glossary of AI Components

| Term | Definition at Splashworks |
|------|--------------------------|
| **EIA** | Enterprise Information Architecture — the glossary, standards, and system landscape docs in `docs/enterprise/` |
| **Semantic Layer** | `docs/skimmer-semantic-layer.yaml` — business terms, SQL patterns, verified queries. The bridge between natural language and SQL. |
| **Ripple** | Conversational AI agent at ripple.splshwrks.com. Doc RAG (Phase 1), data queries (Phase 2), agent access (Phase 3). |
| **AI Query App** | app.splshwrks.com — NL→SQL with semantic rewriting and confidence scoring |
| **RAG** | Retrieval-Augmented Generation — embed docs as vectors, retrieve relevant chunks, include in AI prompt |
| **pgvector** | Postgres extension for vector similarity search. Used for Ripple's doc chunk embeddings. |
| **Agent-ready** | A document or endpoint that can be programmatically discovered, filtered, and consumed by AI agents without human intervention |
| **Verified query** | A SQL pattern in the semantic layer that has been manually validated to return correct results. Used as few-shot examples for AI. |
| **Knowledge compound** | The effect where each piece of encoded knowledge improves all agents simultaneously |

---

## Appendix B: Relationship to Existing Plans

This strategy document sits above the backlog and progress tracker. It provides the *why* and *sequence*; the backlog provides the *what* and *effort*.

| This Strategy | Maps To |
|---------------|---------|
| Section 3.1 (EIA Completion) | EIA-1, EIA-2, EIA-4 in BACKLOG.md |
| Section 3.2 (Ripple Phase 2) | RP-2.1 through RP-2.5 in BACKLOG.md + ripple-design.md |
| Section 3.3 (Semantic Layer) | AQ-7, AQ-8, AQ-9 in BACKLOG.md |
| Section 3.4 (Traceability) | ETL-6, ETL-7, ETL-8 in BACKLOG.md |
| Section 4.2 (Customer Health Agent) | New — add to BACKLOG.md as AG-1 |
| Section 4.2 (Chemical Advisor) | New + DX-2 in BACKLOG.md — add as AG-2 |
| Section 4.2 (Route Efficiency Agent) | New — add as AG-3 |
| Section 4.2 (Financial Digest Agent) | New — add as AG-4 |
| Section 6.1 (Data Investments) | DS-1 through DS-9 in BACKLOG.md |
