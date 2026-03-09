# Splashworks Data Warehouse — Backlog

**Project:** Splashworks Pool Service BI Visualizer
**Last Updated:** 2026-03-11

---

## Priority: High

### Data Layer — Warehouse Models

| ID | Item | Category | Effort | Notes |
|----|------|----------|--------|-------|
| DL-1 | `dim_service_location` — address, city, state, zip, rate, rate_type, labor_cost | dbt model | S | Most common staging fallback; unlocks address/geographic queries |
| DL-2 | `rpt_customer_360` — denormalized customer + locations + service stats + payments | dbt model | M | Single view for "tell me everything about customer X" |
| DL-3 | `rpt_service_history` — service visits with customer/tech/pool names (no IDs) | dbt model | M | Metabase-friendly; replaces fact_service_stop + joins |
| DL-4 | `rpt_payment_summary` — payments with customer names, monthly aggregation | dbt model | S | Metabase-friendly; replaces fact_payment + joins |
| DL-5 | `rpt_profitability` — profitability with customer names (no IDs) | dbt model | S | Metabase-friendly wrapper around semantic_profit |
| DL-6 | `dim_equipment` — equipment/parts per service location | dbt model | M | Zero coverage currently; needed for installed items questions |
| DL-7 | Metabase schema cleanup — hide raw/staging/IDs, rename columns | Config | S | Admin > Table Metadata; no code changes |

### App — AI Query Improvements

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

---

## Size Legend

| Size | Meaning |
|------|---------|
| S | < 2 hours |
| M | 2-8 hours (half day to full day) |
| L | 1-3 days |
| XL | 3+ days (should be broken down) |
