# Splashworks Data Warehouse — Backlog

**Project:** Splashworks Enterprise Data Platform
**Last Updated:** 2026-03-26

---

## Streams

| Prefix | Stream | Description |
|--------|--------|-------------|
| DL- | Data Layer | dbt warehouse models, reports, dimensions |
| AQ- | AI Query | Query intelligence, repair, RAG |
| EIA- | Enterprise Info Architecture | Glossary, standards, agent-readiness, Ripple |
| DA- | Dashboard | Frontend dashboard features |
| IN- | Infrastructure | VPS, networking, security |

---

## Priority: High

### Enterprise Information Architecture

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| EIA-1 | Agent-ready frontmatter on all glossary/standards docs | Docs | S | YAML frontmatter: entity, type, systems, system_of_record, related |
| EIA-2 | Enterprise index manifest (`enterprise-index.yaml`) | Docs | S | Auto-discoverable catalog of all EIA docs for agents |
| EIA-3 | Invoice + Payment glossary entities | Docs | M | Cross-system mapping (Skimmer → QBO → Warehouse) |
| EIA-4 | Technician + Route glossary entities | Docs | S | Skimmer-only entities, warehouse mapping |
| EIA-5 | Ripple POC scope + vector store design | Design | M | MS Copilot agent, Pinecone embeddings, first use cases |
| EIA-6 | Vector index pipeline (chunk → embed → Pinecone) | Backend | M | Ingest docs/enterprise/ into searchable index |

### ETL — Historical Accumulation

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| ~~ETL-1~~ | ~~**Incremental fact accumulation** — switch dbt fact tables to `incremental` materialization with dedup keys~~ | ~~dbt + ETL~~ | ~~M~~ | ~~DONE 2026-03-18. All 10 facts incremental. Also fixed missing `_company_name` joins + added `service_stop_entry_id` to dosage facts.~~ |
| ~~ETL-2~~ | ~~**Load RouteSkip + SkippedStopReason** — add to ETL raw sources~~ | ~~ETL~~ | ~~S~~ | ~~DONE 2026-03-18. Already in raw (ETL loads all 44 tables). Added dbt sources + staging models.~~ |
| ~~ETL-3~~ | ~~**Load RouteMove** — add to ETL raw sources~~ | ~~ETL~~ | ~~S~~ | ~~DONE 2026-03-18. Same — already in raw. Added dbt source + staging model.~~ |
| ETL-4 | **Load Equipment tables** — EquipmentItem, InstalledItem, PartCategory, PartMake, PartModel | ETL | S | New raw tables needed for DL-6 (dim_equipment) |
| ~~ETL-5~~ | ~~**Nightly reconciliation check** — compare raw vs warehouse counts/totals, JSON report, pass/fail in pipeline~~ | ~~ETL~~ | ~~S~~ | ~~DONE 2026-03-26. 6 checks (active customers, payments, invoice items, service stops, payment totals, route skips). Runs nightly after dbt.~~ |
| ETL-6 | **Add `_loaded_at` + `_extract_date` to fact tables** — row-level provenance for incremental facts | ETL | S | Phase 2 of source traceability. Enables "when did this row enter the warehouse?" |
| ETL-7 | **Row-level trace CLI** — given a Skimmer ID, trace it through raw → staging → warehouse → semantic | ETL | M | Phase 2 of source traceability. `./cli/trace-record.sh payment abc123 AQPS` |
| ETL-8 | **`rpt_reconciliation` dbt model** — point-in-time snapshots of source vs warehouse totals with variance | dbt model | S | Phase 3 of source traceability. Auditable trail for compliance. |

### Data Layer — Warehouse Models

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| ~~DL-1~~ | ~~`dim_service_location` — address, city, state, zip, rate, rate_type, labor_cost~~ | ~~dbt model~~ | ~~S~~ | ~~DONE 2026-03-12~~ |
| ~~DL-2~~ | ~~`rpt_customer_360` — denormalized customer + locations + service stats + payments~~ | ~~dbt model~~ | ~~M~~ | ~~DONE 2026-03-14~~ |
| ~~DL-3~~ | ~~`rpt_service_history` — service visits with customer/tech/pool names (no IDs)~~ | ~~dbt model~~ | ~~M~~ | ~~DONE 2026-03-15~~ |
| ~~DL-4~~ | ~~`rpt_payment_summary` — payments with customer names, monthly aggregation~~ | ~~dbt model~~ | ~~S~~ | ~~DONE 2026-03-15~~ |
| DL-5 | `rpt_profitability` — profitability with customer names (no IDs) | dbt model | S | Metabase-friendly wrapper around semantic_profit |
| DL-6 | `dim_equipment` — equipment/parts per service location | dbt model | M | Depends on ETL-4. Zero coverage currently. |
| DL-7 | Metabase schema cleanup — hide raw/staging/IDs, rename columns | Config | S | Admin > Table Metadata; no code changes |
| ~~DL-10~~ | ~~`fact_invoice_item` — line-item revenue analysis, product mix, cross-sell~~ | ~~dbt model~~ | ~~S~~ | ~~DONE 2026-03-18. 16,517 rows.~~ |
| ~~DL-11~~ | ~~`fact_route_skip` — skipped service tracking with reasons, revenue leakage~~ | ~~dbt model~~ | ~~S~~ | ~~DONE 2026-03-18. 806 rows (day-of + pre-planned).~~ |
| ~~DL-12~~ | ~~`fact_route_move` — schedule disruption tracking, tech reassignment patterns~~ | ~~dbt model~~ | ~~S~~ | ~~DONE 2026-03-18. 3,510 rows.~~ |
| DL-13 | `fact_equipment_install` — equipment lifecycle, replacement cycles, parts spend | dbt model | M | Depends on ETL-4 + DL-6. |

### App — AI Query Intelligence (The Moat)

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| ~~AQ-4~~ | ~~**Semantic rewriter** — two-stage Haiku rewriter + Sonnet generator with confidence signals, industry metric catalog, unanswerable detection~~ | ~~Backend + Frontend~~ | ~~L~~ | ~~DONE 2026-03-13. 20 metrics, confidence badges, unanswerable detection.~~ |
| ~~AQ-5~~ | ~~**Few-shot examples in system prompt** — 13 verified queries as SQL examples~~ | ~~Backend~~ | ~~S~~ | ~~DONE 2026-03-12~~ |
| ~~AQ-6~~ | ~~**ETL cron automation** — nightly pipeline: rclone sync → Python ETL → dbt → health check~~ | ~~Backend/Infra~~ | ~~M~~ | ~~DONE 2026-03-12. Cron at 1:15 AM UTC.~~ |
| AQ-7 | **SQL repair layer expansion** — add more repair strategies (missing table aliases, ambiguous columns, etc.) | Backend | S | Current: GROUP BY + type cast. Extend as new error patterns emerge. |
| AQ-8 | **Pool Deck knowledge base RAG** — embed Skimmer help articles for industry vocabulary enrichment | Backend | M | Source: https://thepooldeck.getskimmer.com/knowledge-base |
| AQ-9 | **Pool Deck community content** — ingest crowdsourced pool service operator knowledge | Backend | M | Source: https://thepooldeck.getskimmer.com/community |

### App — AI Query UX

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| AQ-1 | Query history / chat history (conversation-style UX) | Frontend | L | New component, API endpoint for threading |
| AQ-2 | Display generated SQL explanation alongside results | Frontend | S | Already returned by API; not shown prominently |
| AQ-3 | Retry/refine button on query errors | Frontend | S | "Try again" with modified prompt |

### App — Dashboard Improvements

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| DA-1 | JSON dashboard export/import for sharing | Frontend | S | Serialize/deserialize localStorage |
| DA-2 | Individual chart PNG export | Frontend | S | html2canvas per card |
| DA-3 | Dashboard templates library | Frontend | M | Preset dashboards for common use cases |
| DA-4 | PDF export with formatted report layout | Frontend | M | jsPDF + layout formatting |
| DA-5 | Dashboard duplication | Frontend | S | Clone existing dashboard |

### Infrastructure

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| IN-1 | Cloudflare WARP for Power BI remote access | Config | M | VA in Manila needs Power BI connectivity |
| ~~IN-2~~ | ~~Read-only Postgres users for Metabase + Ripple~~ | ~~Config~~ | ~~S~~ | ~~DONE 2026-03-26. `ripple_rw` + `metabase_ro` created. Ripple switched to restricted user.~~ |
| IN-3 | Deploy UI refinements to VPS (UI.11) | Deploy | S | Number formatting, date handling, starter prompts |
| ~~IN-7~~ | ~~**Ripple CF Access auth middleware**~~ | ~~Security~~ | ~~S~~ | ~~DONE 2026-03-26. CloudflareAccessMiddleware added, JWT forwarded in Nginx.~~ |
| ~~IN-8~~ | ~~**Use CF-Connecting-IP for audit logging**~~ | ~~Security~~ | ~~S~~ | ~~DONE 2026-03-26. Prefers CF-Connecting-IP over spoofable X-Forwarded-For.~~ |

---

## Priority: Medium

### App — UI Polish

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| UP-1 | Self-improving prompt tracking (analytics on prompt clicks) | Full stack | M | New tracking table, API endpoint |
| UP-2 | Database Explorer — show warehouse schema with descriptions | Frontend | S | Help users understand available data |

### Data Layer — Extended Coverage

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| DX-1 | Route optimization models | dbt model | L | Route scheduling, stop ordering |
| DX-2 | LSI calculation model | dbt model | M | Langelier Saturation Index from chemical readings |
| DX-3 | Product categories / chemical product dimension | dbt model | S | Categorize dosage entries |
| DX-4 | Tax configuration model | dbt model | S | Tax rates per jurisdiction |

### Data Layer — Future Data Sources (KPIs blocked on new integrations)

| ID | KPI | Blocked On | Data Source | Notes |
|----|-----|------------|-------------|-------|
| DS-1 | Technician utilization rate (billable vs paid hours) | No clock-in/clock-out | Time & attendance (e.g., Homebase, Deputy) | Target: 65-75% utilization |
| DS-2 | First-time fix / callback rate | No callback tracking | CRM or dispatch system | Inverse = repeat visit rate |
| DS-3 | Drive time per job / on-time arrival rate | No GPS or appointment windows | Telematics (e.g., GPS Trackit, Azuga) | High drive time = routing/territory issues |
| DS-4 | Route density (stops per mile) | No geocoding | Telematics + geocoded addresses | Tighter density = better margins |
| DS-5 | CSAT / NPS scores | No survey data | CRM or survey tool (e.g., Zoho, Jobber) | Tech-level and route-level |
| DS-6 | Booking rate / calls handled / abandoned | No call center data | Phone system (e.g., Xima, RingCentral) | CSR performance |
| DS-7 | Lead-to-booking conversion | No CRM pipeline | CRM (e.g., Zoho CRM) | Marketing ROI, cost per booked job |
| DS-8 | Customer acquisition cost | No marketing spend data | QBO + CRM | Marketing spend / new customers |
| DS-9 | Membership / contract retention rate | Partial — have churn | CRM contract tracking | Renewal rate over time |

---

## Priority: Low

### Pre-Production Hardening

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| PH-1 | Create `splashworks` system user on VPS | Security | S | Move file ownership from root |
| PH-2 | Run Docker Compose as non-root | Security | S | Add to docker group |
| PH-3 | Run cloudflared as non-root | Security | S | systemd `User=` directive |
| PH-4 | Move cron to non-root user | Security | S | Non-root crontab |
| PH-5 | FastAPI/frontend containers run as non-root | Security | S | Dockerfile USER directive |
| PH-6 | Review `.env` permissions and secrets management | Security | S | File permissions, vault consideration |

### Legacy Fixes

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| LF-1 | Fix critical bugs (Dropbox token revocation, SQL injection) | Security | M | Deferred from Phase 0; apply before production |

---

## Completed

| ID | Item | Completed |
|----|------|-----------|
| ~~META-1~~ | Metabase connected (bi.splshwrks.com) | 2026-03-11 |
| ~~AUTH-1~~ | Cloudflare Access (GitHub + Google + OTP) | 2026-03-11 |
| ~~AQ-7a~~ | SQL repair layer v1 (GROUP BY + type cast auto-fix) | 2026-03-12 |
| ~~DL-8~~ | Route assignment semantics (stg_route_assignment + system prompt + verified query) | 2026-03-12 |
| ~~AQ-5~~ | Few-shot examples — 13 verified queries in system prompt | 2026-03-12 |
| ~~AQ-6~~ | ETL cron automation — nightly-pipeline.sh (sync → ETL → dbt → health) | 2026-03-12 |
| ~~DL-1~~ | dim_service_location — added address column, updated system prompt | 2026-03-12 |
| ~~DL-9~~ | Customer lifecycle semantics (cancelled/new customer terms + dim_customer dates) | 2026-03-12 |
| ~~UI.11~~ | UI refinements deployed to VPS (starter prompts, dashboards, charts) | 2026-03-12 |
| ~~AQ-4~~ | Semantic rewriter — Haiku preprocessing, confidence badges, unanswerable detection, improved errors | 2026-03-13 |
| ~~DL-2~~ | rpt_customer_360 — denormalized customer profile with LTV | 2026-03-14 |
| ~~DL-3~~ | rpt_service_history — denormalized service visits (69,186 rows) | 2026-03-15 |
| ~~DL-4~~ | rpt_payment_summary — denormalized payments (12,247 rows) | 2026-03-15 |
| ~~ETL-1~~ | Incremental fact accumulation — all 10 facts switched to incremental + dedup keys | 2026-03-18 |
| ~~ETL-2~~ | RouteSkip + SkippedStopReason — dbt sources + staging models | 2026-03-18 |
| ~~ETL-3~~ | RouteMove — dbt source + staging model | 2026-03-18 |
| ~~DL-10~~ | fact_invoice_item — line-item revenue analysis (16,517 rows) | 2026-03-18 |
| ~~DL-11~~ | fact_route_skip — skipped service tracking with reasons (806 rows) | 2026-03-18 |
| ~~DL-12~~ | fact_route_move — schedule disruption tracking (3,510 rows) | 2026-03-18 |
| ~~ETL-5~~ | Nightly reconciliation — 6 raw-vs-warehouse checks, JSON report | 2026-03-26 |
| ~~IN-5~~ | Forward Cf-Access-Jwt-Assertion through Nginx to API | 2026-03-26 |
| ~~IN-6~~ | Health endpoint best-effort JWT validation — restore ETL stats in status bar | 2026-03-26 |
| ~~IN-7~~ | Ripple CF Access auth middleware — protect /api/chat LLM endpoint | 2026-03-26 |
| ~~IN-8~~ | CF-Connecting-IP for unspoofable audit log IP attribution | 2026-03-26 |
| ~~IN-2~~ | Restricted DB users — ripple_rw + metabase_ro privilege separation | 2026-03-26 |

---

## Size Legend

| Size | Meaning |
|------|---------|
| S | < 2 hours |
| M | 2-8 hours (half day to full day) |
| L | 1-3 days |
| XL | 3+ days (should be broken down) |
