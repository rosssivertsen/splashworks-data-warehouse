# Splashworks AI Strategy

**Author:** Ross Sivertsen
**Date:** March 26, 2026
**Status:** Draft v1.0

---

## Executive Summary

Splashworks has built a strong data foundation: a Postgres warehouse fed by nightly Skimmer extracts, a dbt transformation pipeline producing clean dimensional models, and two working AI interfaces — the AI Query tool (natural language to SQL) and Ripple (a RAG-powered knowledge agent). The enterprise glossary, semantic layer, and data dictionary provide the structured vocabulary that both humans and AI agents need to reason about the business.

This strategy outlines how to evolve from these point solutions into a coherent AI platform that compounds in value over time. The core thesis: Splashworks' competitive advantage isn't any single model or tool — it's the enterprise information architecture (EIA) that makes AI systems accurate about *this specific business*. Every glossary entry, verified query, and field mapping trains the next generation of agents to be more precise and more useful.

The strategy is organized into three horizons: consolidating what exists today, expanding into proactive intelligence, and building toward autonomous operational agents.

---

## Current State Assessment

### What's Working

**AI Query (app.splshwrks.com)** generates SQL from natural language questions using a two-stage pipeline: Haiku rewrites and classifies the question, then Sonnet generates SQL against the warehouse schema. The semantic layer provides business term mappings, verified queries, and join path documentation. An auto-repair layer catches common SQL errors. This is the "moat" — it turns a generic LLM into one that understands pool service operations.

**Ripple (ripple.splshwrks.com)** is a RAG knowledge agent backed by pgvector. The corpus includes 8 glossary entities, naming conventions, system landscape documentation, the data dictionary, ERD, and the semantic layer YAML. Documents are chunked by heading, embedded with OpenAI's text-embedding-3-small (1536 dimensions), and retrieved via cosine similarity. Claude Haiku generates grounded answers with source citations.

**Enterprise Information Architecture** provides canonical definitions for Customer, Contact, Service Location, Pool, Work Order, Invoice, Payment, and Product — each with cross-system field mappings (Skimmer, Zoho CRM, QBO, Warehouse), business rules, data flows, and identifier formats. This is the single source of truth that prevents AI systems from hallucinating about what "active customer" or "cancelled customer" actually means.

**Data Warehouse** runs a full nightly pipeline: OneDrive sync, SQLite ETL with checksum-based change detection, dbt transformations across staging/warehouse/semantic layers, reconciliation checks, and health monitoring. 712K+ rows across 44 tables, two company entities (AQPS and JOMO), incremental fact accumulation, and audit logging on every query.

### Gaps and Opportunities

The current AI systems operate in isolation. The query tool doesn't learn from Ripple's glossary knowledge. Ripple doesn't have access to live warehouse data. Neither system has memory of previous interactions or the ability to take action. The semantic layer is manually maintained and doesn't grow from usage patterns.

Specific gaps worth addressing:

1. **No feedback loop.** Queries that succeed or fail don't inform future query generation. The feedback endpoint in Ripple is stubbed out.
2. **Static corpus.** Ripple's RAG corpus is manually curated via a YAML manifest. It doesn't include operational data, SOPs, or external pool industry knowledge.
3. **No agent-ready metadata.** The EIA glossary entries lack machine-readable frontmatter (YAML with entity type, system of record, related entities) that would let agents discover and navigate documentation programmatically.
4. **Siloed AI interfaces.** A user who asks Ripple "what's our cancellation rate?" gets a definition. A user who asks the Query tool the same question gets SQL results. Neither combines both.
5. **No proactive intelligence.** All AI interactions are pull-based — the user asks, the system answers. There's no mechanism for the system to surface anomalies, trends, or recommendations unprompted.

---

## Strategic Pillars

### Pillar 1: Strengthen the Information Architecture as the AI Foundation

The EIA is the substrate on which all AI capabilities are built. Every improvement to the glossary, semantic layer, or data dictionary compounds across every AI system that consumes it.

**1.1 Agent-Ready Frontmatter (EIA-1)**

Add YAML frontmatter to every glossary and standards document. This enables agents to discover, filter, and navigate the corpus without reading entire files.

```yaml
---
entity: customer
type: glossary
systems: [skimmer, zoho_crm, qbo, warehouse]
system_of_record: skimmer
related: [service_location, contact, pool, invoice, payment]
last_updated: 2026-03-14
---
```

An agent receiving a question about invoices can immediately pull the invoice glossary, its related entities (customer, payment, product), and the relevant warehouse column mappings — before generating a single line of SQL.

**1.2 Enterprise Index Manifest (EIA-2)**

Create an `enterprise-index.yaml` that serves as a machine-readable catalog of all EIA documents. This is the "table of contents" that agents use to orient themselves.

```yaml
entities:
  - name: customer
    file: glossary/customer.md
    system_of_record: skimmer
    warehouse_tables: [dim_customer, rpt_customer_360]
  - name: invoice
    file: glossary/invoice.md
    system_of_record: qbo
    warehouse_tables: [fact_invoice, fact_invoice_item]
standards:
  - name: naming_conventions
    file: standards/naming-conventions.md
    applies_to: [customer, contact, service_location]
```

**1.3 Expand the Glossary**

Technician and Route Assignment are core operational entities that lack glossary entries. Chemical Product, Equipment, and Tax Configuration are planned warehouse models (DX-2 through DX-4) that will need glossary support. Each new entity strengthens every downstream AI system.

**1.4 Semantic Layer as Living Document**

The semantic layer YAML currently has 21 business terms and 12 verified join paths. This should grow from usage:

- When the AI Query tool successfully answers a novel question, the SQL pattern should be reviewed and potentially added as a verified query.
- When Ripple surfaces a definition that the user then queries in the data tool, that's a signal to add a business term mapping.
- Track which business terms are hit most often (the UP-1 backlog item on prompt analytics feeds directly into this).

---

### Pillar 2: Unify the AI Layer

Today there are two separate AI interfaces: one for data questions (AI Query) and one for knowledge questions (Ripple). The user shouldn't need to know which system to ask.

**2.1 Unified Chat Agent**

Build a single conversational interface that routes questions to the appropriate backend:

- **Knowledge questions** ("What's our definition of an active customer?") → Ripple RAG pipeline
- **Data questions** ("How many active customers do we have?") → AI Query SQL pipeline
- **Hybrid questions** ("What's our cancellation rate and how has it trended?") → Ripple for the definition + metric target, then AI Query for the actual numbers

The routing layer can use the existing Haiku rewriter's classification capability. The rewriter already distinguishes between answerable, partially answerable, and unanswerable questions — extend this taxonomy to include "knowledge-only" and "hybrid" categories.

**2.2 Shared Context Layer**

Both AI systems should draw from the same enriched context:

- The semantic layer YAML (business terms, metrics, verified queries)
- The enterprise glossary (definitions, business rules, cross-system mappings)
- The data dictionary (column descriptions, data types, constraints)
- Conversation history (what the user already asked in this session)

This is architecturally straightforward because both systems already use Claude models and both have access to the Postgres database. The key change is building a shared `context_builder` service that assembles the right context for any question type.

**2.3 Conversation Memory**

The AQ-1 backlog item (query history / chat-style UX) is a prerequisite. Beyond UX, conversation memory enables:

- Follow-up questions: "Now break that down by technician"
- Refinement: "Actually, exclude JOMO and just show AQPS"
- Context accumulation: the AI remembers that the user is looking at Q1 2026 data

Store conversation threads in Postgres with the question, generated SQL (if any), RAG sources (if any), results summary, and user feedback.

---

### Pillar 3: Close the Feedback Loop

The most underinvested area. AI systems that don't learn from their mistakes plateau quickly.

**3.1 Query Success Tracking**

Every AI-generated query already goes through the audit log. Extend this to track outcomes:

- Did the query execute successfully?
- Did the user ask a follow-up (suggesting the answer was useful but incomplete)?
- Did the user rephrase (suggesting the answer was wrong)?
- Did the user give explicit feedback (thumbs up/down)?

This data powers the semantic layer growth described in 1.4 — successful novel queries become candidates for verified query status.

**3.2 Ripple Feedback Pipeline**

The `/api/chat/feedback` endpoint is currently a stub. Implement it:

- Store feedback (message_id, rating, optional text) in a `ripple.chat_feedback` table
- Periodically review low-rated answers to identify corpus gaps
- Use high-rated answers to validate that the RAG retrieval is working correctly

**3.3 Automated Semantic Layer Expansion**

Build a review pipeline: when a novel SQL pattern succeeds and receives positive feedback from the user, generate a candidate entry for the semantic layer YAML (business term, SQL pattern, tables required). A human reviews and approves before it's added. Over time, this turns user questions into institutional knowledge.

---

### Pillar 4: Proactive Intelligence

Move from reactive (user asks, system answers) to proactive (system surfaces insights).

**4.1 Anomaly Detection**

The nightly reconciliation pipeline (ETL-5) already compares raw-vs-warehouse counts. Extend this pattern to business metrics:

- Customer churn spike: "5 customers cancelled this week vs. the trailing 4-week average of 1.5"
- Revenue anomaly: "AQPS weekly revenue dropped 18% week-over-week"
- Service quality flag: "Route skip rate hit 12% on Tuesday (normal: 3-5%)"
- Chemical usage outlier: "Pool at 123 Main St used 3x the average chlorine this month"

These checks run as dbt models or post-dbt Python scripts in the nightly pipeline. Alerts go to a dedicated channel (Slack, email, or in-app notification).

**4.2 Scheduled Reports**

Certain questions get asked repeatedly. Rather than waiting for the user to ask "how did we do last week?", pre-compute and deliver:

- Weekly operations summary (stops completed, skipped, revenue, chemical usage)
- Monthly customer lifecycle report (new, churned, reactivated, net change)
- Technician performance scorecard (stops per day, skip rate, chemical efficiency)

These can be generated as dbt semantic models that refresh nightly, then surfaced in Metabase dashboards or delivered via email.

**4.3 Natural Language Alerts**

Instead of raw metric alerts, use the AI layer to generate human-readable summaries: "Three customers on Mike's Tuesday route were skipped this week due to gate access issues. This is the third consecutive week with gate-related skips on this route. You may want to reach out to these customers about key access."

---

### Pillar 5: Expand the Knowledge Corpus

Ripple's value is directly proportional to the breadth and quality of its corpus.

**5.1 Pool Deck Integration (AQ-8, AQ-9)**

The Pool Deck (Skimmer's community and knowledge base) contains industry-specific vocabulary, best practices, and operator knowledge that would dramatically improve both Ripple's answers and the AI Query tool's understanding of domain terminology. This is the single highest-leverage corpus expansion.

Approach: scrape or API-fetch Pool Deck articles, chunk by section, embed, and add to the pgvector corpus with `doc_type: "industry_knowledge"`. Update the document classifier in `index_docs.py` to handle the new source.

**5.2 Standard Operating Procedures**

As SOPs are written (the EIA glossary was designed to support SOP authoring), they become prime RAG material. A new hire asking Ripple "how do I handle a customer cancellation?" should get the SOP, the business rule definition from the glossary, and optionally the current cancellation stats from the warehouse.

**5.3 QBO and CRM Documentation**

The enterprise references already include QBO API docs. As the Zoho CRM integration matures, CRM-specific documentation (field mappings, sync rules, lead-to-customer conversion process) should enter the corpus.

**5.4 Corpus Quality Metrics**

Track retrieval quality:

- Average similarity score for top-k results (declining scores suggest the corpus doesn't cover the question)
- "No relevant documents found" rate (the empty-corpus fallback in the chat endpoint)
- Distribution of `doc_type` in retrieval results (are certain doc types over/under-represented?)

---

### Pillar 6: Toward Autonomous Agents

The long-term vision — agents that don't just answer questions but take action.

**6.1 Read-Only Data Agents**

The simplest agent pattern: a scheduled or triggered agent that reads warehouse data, interprets it against business rules from the EIA, and produces a written summary or recommendation. No write access, no side effects.

Examples:

- **Weekly digest agent** — reads the past week's data, generates a narrative summary with highlights and concerns, emails it to leadership
- **Customer health agent** — for each customer, assesses service consistency, payment history, and chemical trends, flags at-risk accounts
- **Route optimization agent** — analyzes stop density, drive time patterns, and skip rates to suggest route restructuring

These agents use the same AI Query pipeline but are invoked programmatically rather than through a chat interface.

**6.2 Write-Capable Agents (Future)**

Agents that can modify systems require much more guardrailing but unlock significant operational value:

- **Invoice reconciliation agent** — compares Skimmer invoices against QBO, flags discrepancies, drafts corrective entries for human approval
- **Schedule optimization agent** — proposes route changes based on customer additions/cancellations, submits to Skimmer via API after manager approval
- **Customer communication agent** — drafts personalized emails for service disruptions, payment reminders, or seasonal recommendations

Each write-capable agent should follow an approval workflow: the agent proposes an action, a human reviews and approves, the agent executes. No autonomous writes without explicit human confirmation, at least in the initial phase.

**6.3 Agent Infrastructure Requirements**

To support agents at scale, the platform needs:

- **Agent registry** — what agents exist, what they can do, what systems they can access
- **Execution logs** — what each agent did, when, why, and what the outcome was
- **Permission model** — read-only vs. read-write, per-system access controls (the `ripple_rw` and `metabase_ro` database users are a good foundation)
- **Approval workflows** — for write-capable agents, a queue of proposed actions awaiting human review
- **Cost tracking** — per-agent API spend (Claude, OpenAI embeddings) to ensure ROI

---

## Implementation Roadmap

### Phase 1: Foundation Strengthening (Q2 2026)

Focus: make the existing systems better and lay groundwork for unification.

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| 1 | Agent-ready frontmatter on all EIA docs (EIA-1) | S | None |
| 2 | Enterprise index manifest (EIA-2) | S | EIA-1 |
| 3 | Implement Ripple feedback storage | S | None |
| 4 | Query success tracking in audit log | S | None |
| 5 | Technician + Route glossary entities (EIA-4) | S | None |
| 6 | Conversation history / chat UX (AQ-1) | L | None |
| 7 | Pool Deck knowledge base ingestion (AQ-8) | M | None |
| 8 | Self-improving prompt analytics (UP-1) | M | None |

### Phase 2: Unification (Q3 2026)

Focus: merge the AI Query and Ripple experiences, build shared context.

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| 1 | Shared context builder service | M | EIA-1, EIA-2 |
| 2 | Question routing layer (knowledge vs. data vs. hybrid) | M | Shared context |
| 3 | Unified chat interface | L | Routing layer, AQ-1 |
| 4 | Automated semantic layer candidate pipeline | M | Query success tracking |
| 5 | Pool Deck community content ingestion (AQ-9) | M | AQ-8 |
| 6 | Corpus quality metrics dashboard | S | None |

### Phase 3: Proactive Intelligence (Q4 2026)

Focus: the system starts surfacing insights without being asked.

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| 1 | Business metric anomaly detection models | M | Warehouse maturity |
| 2 | Weekly operations digest (read-only agent) | M | Anomaly detection |
| 3 | Customer health scoring agent | M | rpt_customer_360 |
| 4 | Natural language alert generation | S | Anomaly detection |
| 5 | Scheduled report delivery (email) | M | Digest agent |

### Phase 4: Autonomous Agents (2027+)

Focus: agents that propose and execute actions with human approval.

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| 1 | Agent registry and execution logging | L | None |
| 2 | Approval workflow infrastructure | L | Agent registry |
| 3 | Invoice reconciliation agent (Skimmer ↔ QBO) | L | QBO integration, approval workflows |
| 4 | Route optimization recommendations | L | Geocoding (DS-4), telematics |
| 5 | Customer communication drafting | M | CRM integration |

---

## Technical Architecture Decisions

### Embedding Model

The current choice of `text-embedding-3-small` (1536 dimensions, OpenAI) is pragmatic and cost-effective. Considerations for the future:

- **Stick with OpenAI embeddings** for now — the 1536-dimension vectors are well-supported by pgvector, and IVFFlat indexing with 10 lists is appropriate for the current corpus size (hundreds of chunks).
- **Monitor HNSW indexing** — when the corpus exceeds ~10K chunks, switch from IVFFlat to HNSW for better recall at similar query latency. pgvector supports both.
- **Consider Anthropic embeddings** if/when available, to reduce vendor dependency and potentially improve semantic alignment with the Claude generation models.
- **Evaluate dimensionality** — text-embedding-3-small supports truncation to 512 or 256 dimensions with minimal quality loss. If storage or query latency becomes a concern, this is a cheap optimization.

### LLM Model Selection

The current model allocation is sound:

- **Haiku** for classification, rewriting, and Ripple RAG answers (fast, cheap, good enough for structured tasks)
- **Sonnet** for SQL generation (the task that demands the highest reasoning capability)

As models improve, the natural migration path is to use newer Haiku variants for more tasks and reserve Sonnet/Opus for the hardest problems (complex multi-table SQL, agent planning).

### Vector Store

pgvector in the existing Postgres instance is the right choice for the current scale. It avoids a separate infrastructure dependency (compared to Pinecone, as mentioned in EIA-5) and keeps all data in one place. Revisit if the corpus grows beyond ~100K chunks or if sub-10ms query latency becomes a requirement — at that point, a dedicated vector database may be warranted.

### Context Window Management

As the corpus grows and conversations get longer, context window management becomes critical. Strategy:

- Use the semantic layer to pre-filter relevant context rather than stuffing everything into the prompt.
- Implement a tiered context approach: always include the most relevant glossary entries and business rules, conditionally include data dictionary columns and verified queries, never include raw schema dumps unless the question specifically requires schema exploration.
- Track token usage per query to identify when context is being wasted on irrelevant information.

---

## Cost Considerations

AI API costs are the primary variable expense. Current estimated usage:

| Component | Model | Est. Queries/Day | Est. Cost/Day |
|-----------|-------|-------------------|---------------|
| Query Rewriter | Haiku | 20-50 | $0.05-0.10 |
| SQL Generator | Sonnet | 20-50 | $0.30-0.75 |
| Ripple RAG | Haiku | 10-30 | $0.02-0.06 |
| Embeddings | text-embedding-3-small | 0-50 (indexing) | $0.001-0.01 |

Total estimated cost: $10-30/month at current usage. This scales linearly with query volume. The Phase 3 proactive agents add fixed daily costs (one digest generation per day ≈ $0.05).

Cost guardrails to implement:

- Per-user daily query limits (already have rate limiting at 20/min)
- Monthly spend alerting
- Caching for repeated or similar questions (semantic similarity check before generating new SQL)

---

## Success Metrics

| Metric | Current | 6-Month Target | 12-Month Target |
|--------|---------|----------------|-----------------|
| AI Query success rate (executes without error) | ~75% (est.) | 90% | 95% |
| Verified queries in semantic layer | 12 | 30 | 50+ |
| EIA glossary entities | 8 | 12 | 16+ |
| Ripple corpus chunks | ~100 (est.) | 500 | 1,000+ |
| Average RAG similarity score | Unknown | Tracked, baseline set | >0.75 for top-3 |
| User feedback coverage | 0% | 20% of queries rated | 50% of queries rated |
| Proactive alerts generated | 0 | 5/week | 10/week |
| Time to answer a business question | Minutes (manual) | Seconds (AI) | Seconds (proactive) |

---

## Risks and Mitigations

**Data freshness.** The warehouse runs on nightly extracts with a 6-month trailing window. AI answers about "right now" are always at least a day old. Mitigation: clearly communicate data freshness in every AI response; consider intraday extracts for critical metrics if demand warrants it.

**Hallucination.** Despite guardrails (anti-hallucination system prompt rules, schema validation, unanswerable detection), LLMs can still generate plausible-sounding incorrect SQL or answers. Mitigation: the semantic layer's verified queries provide a ground truth baseline; expand this coverage aggressively. The auto-repair layer catches execution errors but not semantic errors (correct SQL, wrong answer).

**Vendor lock-in.** The stack uses Claude (Anthropic) for generation and OpenAI for embeddings. Mitigation: the MULTI_PROVIDER_AI_GUIDE already documents support for multiple LLM providers. Keep the embedding layer swappable — the pgvector schema doesn't care which model produced the vectors (as long as dimensions match).

**Corpus drift.** As the business evolves, glossary definitions and business rules may become stale. Mitigation: the EIA change log convention enforces documentation of updates; the automated semantic layer pipeline (3.3) keeps the most-used patterns fresh; quarterly EIA review meetings.

**Cost escalation.** If usage grows 10x (multiple users, proactive agents), monthly AI costs could reach $100-300. Mitigation: aggressive caching, Haiku for everything except SQL generation, prompt optimization to reduce token usage.

---

## Conclusion

Splashworks is in a strong position. The hardest part — building a clean data warehouse with well-defined business semantics — is largely done. The AI strategy is about capitalizing on that investment by making the information architecture the central nervous system that every AI capability plugs into.

The sequence matters: strengthen the EIA first (it's cheap and compounds), then unify the AI interfaces (better UX, shared learning), then add proactive intelligence (move from reactive to predictive), and finally build toward autonomous agents (the long game).

Every glossary entry you write, every verified query you add, every business rule you codify — it's all training data for the AI systems you haven't built yet.
