# Splashworks Data Warehouse — Backlog

**Project:** Splashworks Pool Service BI Visualizer
**Last Updated:** 2026-03-14

---

## Priority: High

### Data Layer — Warehouse Models

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| ~~DL-1~~ | ~~`dim_service_location` — address, city, state, zip, rate, rate_type, labor_cost~~ | ~~dbt model~~ | ~~S~~ | ~~DONE 2026-03-12~~ |
| ~~DL-2~~ | ~~`rpt_customer_360` — denormalized customer + locations + service stats + payments~~ | ~~dbt model~~ | ~~M~~ | ~~DONE 2026-03-14~~ |
| DL-3 | `rpt_service_history` — service visits with customer/tech/pool names (no IDs) | dbt model | M | Metabase-friendly; replaces fact_service_stop + joins |
| DL-4 | `rpt_payment_summary` — payments with customer names, monthly aggregation | dbt model | S | Metabase-friendly; replaces fact_payment + joins |
| DL-5 | `rpt_profitability` — profitability with customer names (no IDs) | dbt model | S | Metabase-friendly wrapper around semantic_profit |
| DL-6 | `dim_equipment` — equipment/parts per service location | dbt model | M | Zero coverage currently; needed for installed items questions |
| DL-7 | Metabase schema cleanup — hide raw/staging/IDs, rename columns | Config | S | Admin > Table Metadata; no code changes |

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
| IN-2 | Read-only Postgres user for Metabase | Config | S | `metabase_ro` with SELECT-only on warehouse/semantic |
| IN-3 | Deploy UI refinements to VPS (UI.11) | Deploy | S | Number formatting, date handling, starter prompts |

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

---

## Size Legend

| Size | Meaning |
|------|---------|
| S | < 2 hours |
| M | 2-8 hours (half day to full day) |
| L | 1-3 days |
| XL | 3+ days (should be broken down) |
