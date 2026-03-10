# AQ-4: Semantic Rewriter — Design Spec

**Date:** 2026-03-10
**Status:** Approved
**Effort:** M-L (1-2 days)
**Depends on:** None (extends existing pipeline)

---

## Problem

The AI query pipeline generates wrong answers or times out on complex questions because:

1. **Semantic mismatch** — industry terms ("route production," "DSO," "collection rate") aren't in Claude's context
2. **Query complexity explosion** — multi-table joins generated without optimization guidance
3. **Silent wrong results** — correct-looking data from wrong filters/joins erodes CEO trust
4. **No graceful handling of unanswerable questions** — system wastes a Sonnet call then returns a generic error
5. **Uninformative error messages** — "Query timed out" and "HTTP 504" give no diagnostic value

**Core insight:** Wrong answers erode trust faster than errors. No answer is better than the wrong answer.

---

## Solution: Two-Stage Rewriter Pipeline

### Architecture

```
User question
  |
  v
Stage 1: REWRITER (Claude Haiku — fast, cheap, ~1s)
  - Identify industry metrics referenced
  - Map to warehouse tables/columns/formulas via metric catalog
  - Flag unanswerable questions with explanation
  - Rewrite question with technical instructions
  - Classify confidence: HIGH / MEDIUM / LOW / UNANSWERABLE
  |
  v
Stage 2: SQL GENERATOR (Claude Sonnet — existing)
  - Receives enriched question + technical instructions + system prompt
  - Generates SQL with less ambiguity
  |
  v
Execute -> Repair -> Response (with confidence signal)
```

### Confidence Routing

| Confidence | Behavior |
|-----------|----------|
| HIGH | Inject explicit SQL hints -> Sonnet generates confidently. Green badge. |
| MEDIUM | Inject partial mapping + caveat -> Sonnet generates with assumptions. Yellow badge. |
| LOW | Pass through with note -> Sonnet attempts. Yellow badge + "best effort" label. |
| UNANSWERABLE | Short-circuit. Return friendly explanation. Skip Sonnet call entirely. Blue info panel. |

### Cost/Latency Impact

- Haiku adds ~0.5-1.5s and ~$0.001 per query
- UNANSWERABLE questions save ~$0.01-0.03 by skipping Sonnet
- Net effect: slightly slower on answerable queries, cheaper overall

---

## Metric Catalog

Lives in `docs/skimmer-semantic-layer.yaml` under a new `industry_metrics` section. Editable by non-engineers.

### Answerable Metrics (data exists in warehouse)

| Metric | Calculation | Tables | Confidence |
|--------|------------|--------|------------|
| Route production per tech | SUM(rate) grouped by tech, excluding work orders | dim_service_location, stg_route_assignment, stg_account | high |
| Jobs completed per day per tech | COUNT(*) WHERE service_status=1, by tech + date | fact_service_stop, dim_tech | high |
| Revenue per technician | Total service revenue / number of techs | dim_service_location, stg_route_assignment | high |
| Mean time to complete job | AVG(minutes_at_stop) WHERE service_status=1 | fact_service_stop | high |
| Jobs per route per day/week | COUNT(*) by tech + date range | fact_service_stop, dim_tech | high |
| Service completion rate | SUM(service_status) / COUNT(*) * 100 | fact_service_stop | high |
| Skipped stop rate + reasons | COUNT(*) WHERE service_status=0, with skip_reason | fact_service_stop | high |
| Average ticket value | AVG(subtotal) from invoices | fact_invoice | high |
| Collection rate | SUM(payments) / SUM(invoices) * 100 | fact_payment, fact_invoice | high |
| Days sales outstanding (DSO) | AVG(payment_date - invoice_date) | fact_payment, fact_invoice | medium |
| Work order completion rate | SUM(service_status) / COUNT(*) from work orders | fact_work_order | high |
| Customer churn / cancellations | is_inactive=1 OR deleted=1, updated_at as cancel date | dim_customer | high |

### Unanswerable Metrics (blocked on data sources)

| Metric | Missing Data | Future Source | Backlog ID |
|--------|-------------|---------------|------------|
| Technician utilization rate | No clock-in/clock-out | Time & attendance (Homebase, Deputy) | DS-1 |
| First-time fix / callback rate | No callback tracking | CRM or dispatch | DS-2 |
| Drive time per job | No GPS data | Telematics (GPS Trackit, Azuga) | DS-3 |
| On-time arrival rate | No appointment windows | Telematics | DS-3 |
| Route density (stops/mile) | No geocoding | Telematics + geocoded addresses | DS-4 |
| CSAT / NPS | No survey data | CRM or survey tool | DS-5 |
| Booking rate / calls handled | No call center data | Phone system (Xima, RingCentral) | DS-6 |
| Lead-to-booking conversion | No CRM pipeline | CRM (Zoho CRM) | DS-7 |
| Customer acquisition cost | No marketing spend | QBO + CRM | DS-8 |

---

## Rewriter Prompt Design

### Input to Haiku

```
You are a query preprocessor for a pool service data warehouse.

Given a user's natural language question:
1. Identify which industry metrics or business concepts it references
2. Map each to the warehouse calculation (or flag as unanswerable)
3. Output a structured JSON response

## Metric Catalog
{injected from industry_metrics YAML}

## Data Gaps
{injected from unanswerable metrics}

## Warehouse Tables (abbreviated)
{table names + key columns only — not full schema}

## Output Format (JSON only, no other text)
{
  "confidence": "high|medium|low|unanswerable",
  "matched_metrics": ["route_production_per_tech"],
  "rewritten_question": "Calculate total recurring service revenue (dim_service_location.rate) per technician per month, excluding work orders...",
  "technical_instructions": "Use dim_service_location.rate joined through stg_route_assignment to stg_account for tech names. Filter: end_date >= CURRENT_DATE::text, is_inactive = 0. Group by tech.",
  "unanswerable_reason": null,
  "partial_answer_hint": null
}
```

### Key Prompt Behaviors

- **Synonym matching:** "route production" = "tech revenue" = "revenue per tech" = "production per route"
- **Partial answers:** When a question is unanswerable, suggest what IS answerable (e.g., "can't do utilization, but can show avg minutes per stop per tech")
- **Date awareness:** Rewriter passes through date references unchanged — Sonnet handles date computation via the system prompt's Date Reference section
- **Multi-metric questions:** A question like "show me tech productivity and route efficiency" should match multiple metrics and combine instructions

---

## Error Messages

### Improved Error Mapping

| Current | New | Trigger |
|---------|-----|---------|
| `Query timed out` | "This question requires a complex query that took too long. Try narrowing it — e.g., add a company name or date range." | Postgres statement timeout |
| `Query execution error` | "The generated SQL had an error. Try rephrasing, or use a simpler question." | SQL execution failure after repair |
| `Could not generate SQL` | "I wasn't sure how to translate that into a query. Try being more specific about what data you want." | Sonnet returns no SQL |
| `AI service error` | "The AI service is temporarily unavailable. Please try again in a moment." | Anthropic API error |
| *(new)* | "We don't have that data yet. [reason]. This requires [data source]." + partial answer hint | Rewriter returns UNANSWERABLE |
| *(new)* | Yellow badge: "Best effort — this query involved assumptions. Verify key numbers." | Rewriter returns MEDIUM or LOW |

### Unanswerable Response Example

> "I can't calculate technician utilization rate yet — this requires clock-in/clock-out data that isn't in Skimmer. We'd need a time & attendance integration (like Homebase or Deputy) to track billable vs. paid hours.
>
> **What I can tell you:** average minutes per stop by technician, which gives a partial picture of time on-site."

---

## Confidence UX

| Signal | Visual | When |
|--------|--------|------|
| Verified | Green dot + "Verified" | Matched known metric or verified query pattern |
| Best effort | Yellow dot + "Best effort" | Recognized domain, made assumptions |
| Standard | No dot | Normal query, no special signal |
| Unanswerable | Blue info panel | Data doesn't exist, with explanation + partial hint |

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `api/services/query_rewriter.py` | Haiku rewriter: question -> enriched question + confidence |

### Modified Files

| File | Change |
|------|--------|
| `docs/skimmer-semantic-layer.yaml` | Add `industry_metrics` section with ~20 metrics |
| `api/routers/query.py` | Insert rewriter step; return confidence; improve error messages |
| `api/models/responses.py` | Add `confidence`, `unanswerable_reason`, `partial_answer_hint` to QueryResponse |
| `api/services/schema_context.py` | Inject industry metrics into Sonnet system prompt |
| `api/services/ai_service.py` | Accept enriched question + technical instructions |
| `src/components/QueryView.tsx` | Confidence badges, improved error messages, unanswerable info panel |
| `src/types/api.ts` | Add confidence fields to response types |

### Not in Scope (deferred)

| Item | Backlog ID | Reason |
|------|------------|--------|
| Pool Deck knowledge base RAG | AQ-8 | Separate scrape + embed effort |
| Pool Deck community content | AQ-9 | Crowdsourced content ingestion |
| Query routing / SQL templates (Option C) | — | Wait for rewriter patterns to emerge |
| Rewriter analytics / logging | — | Fast-follow after core works |

---

## Future Evolution (toward Option C)

As usage patterns emerge from the rewriter:
1. **Log all rewriter outputs** — which metrics are asked about, confidence levels, success rates
2. **Identify "templatable" queries** — questions that always map to the same SQL pattern
3. **Promote templates** — high-frequency verified patterns become direct SQL templates (skip both Haiku and Sonnet)
4. **Pool Deck RAG** — embed industry knowledge base for richer synonym matching and domain context

---

## External Knowledge Sources (backlog)

| Source | URL | Purpose |
|--------|-----|---------|
| The Pool Deck — Knowledge Base | https://thepooldeck.getskimmer.com/knowledge-base | Skimmer-curated help articles, industry terminology |
| The Pool Deck — Community | https://thepooldeck.getskimmer.com/community | Crowdsourced pool service operator knowledge |

These will feed into AQ-8/AQ-9 for vocabulary enrichment and RAG-based context injection.
