# UI Refinements Batch — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Author:** Ross Sivertsen + Claude Opus 4.6
**Date:** 2026-03-10
**Status:** APPROVED
**Branch:** `feature/warehouse-etl`
**Parent:** Interstitial batch (after semantic enrichment, before Phase 2)

---

## 1. Goal

Add starter prompts, dashboard cards with chart visualization, dashboard persistence, and screenshot export to the React frontend. This makes the app immediately useful for operational practitioners who want to explore data visually without writing SQL.

**Success criteria:** A first-time user sees example questions, clicks one, gets results, adds them to a dashboard with a chart, saves the dashboard, and downloads a PNG screenshot.

---

## 2. Context

Phase 1 Batch C deployed a clean-room React frontend with 4 views (AI Query, Explorer, Data, Dashboard). The semantic enrichment batch added 4 dbt models and 16 business terms. The AI now answers common questions correctly, but the UI is bare — no example questions, no charts, no dashboard persistence.

The legacy frontend (`src-legacy/`) has patterns for all of these features using ECharts, jsPDF, and localStorage. The current frontend already has these libraries installed as dependencies but unused.

---

## 3. Deliverable 1: Starter Prompts

### Design

Clickable example questions loaded from the YAML `verified_queries` section via a new API endpoint. Displayed as pill buttons above the query input in QueryView when no query has been run yet. Clicking a prompt fills the input and submits it. Prompts disappear after the first query.

### API Endpoint

`GET /api/prompts` — Returns an array of question strings from `verified_queries` in the semantic layer YAML.

```json
{
  "prompts": [
    "How many active customers does each company have?",
    "What is the average pool size in gallons by company?",
    ...
  ]
}
```

### Why a dedicated endpoint

Keeps the contract clean and lets us add prompt tracking/analytics later (backlog) without changing the frontend.

---

## 4. Deliverable 2: Dashboard Cards with Chart Switching

### Card Structure

Each dashboard card is a self-contained unit:
- **Title** (editable)
- **SQL query** (collapsible, viewable)
- **Results table** (always visible — the underlying data)
- **Chart overlay** (optional — user toggles between table-only and table+chart)
- **Chart type selector** toolbar: bar, line, pie, area
- **Column mapping** — user picks X-axis and Y-axis columns from query results
- **Card actions** — remove card, download card as PNG

### How Cards Get Added

1. **From QueryView/DataView:** After running a query, an "Add to Dashboard" button appears → user picks target dashboard → card created with query + results
2. **From DashboardView:** "New Card" button → inline SQL editor → run → card created

### Chart Rendering

ECharts via `echarts-for-react` (already installed). A `ChartCard` component receives:
- `columns: string[]` — column names from query results
- `rows: any[][]` — data rows
- `chartType: 'table' | 'bar' | 'line' | 'pie' | 'area'`
- `xColumn: string` — column mapped to X-axis
- `yColumn: string` — column mapped to Y-axis

Chart renders below the table when a chart type other than 'table' is selected.

---

## 5. Deliverable 3: Dashboard Persistence

### Data Model

```typescript
interface Dashboard {
  id: string;
  name: string;
  cards: DashboardCard[];
  createdAt: string;
  updatedAt: string;
}

interface DashboardCard {
  id: string;
  title: string;
  sql: string;
  results: { columns: string[]; rows: any[][] };
  chartType: 'table' | 'bar' | 'line' | 'pie' | 'area';
  xColumn: string | null;
  yColumn: string | null;
}
```

### Persistence

localStorage via a `useDashboards` hook. Supports:
- Create, rename, delete dashboards
- Add, update, remove cards within a dashboard
- Auto-save on every change

### UI

Dashboard selector dropdown in the DashboardView header showing all saved dashboards plus "New Dashboard" option. Active dashboard name is editable inline.

### Sample Dashboard

On first visit (no localStorage data), auto-create an "Operations Overview" dashboard with 3-4 pre-built cards using verified queries from the YAML (e.g., active customers by company, avg minutes per stop, payment methods breakdown). Cards come with pre-populated results fetched from the API.

---

## 6. Deliverable 4: Dashboard Screenshot

A "Download as PNG" button in the dashboard header. Uses `html2canvas` (already installed) to capture the dashboard container element and trigger a browser download.

Filename: `{dashboard-name}_{date}.png`

---

## 7. View Changes Summary

| View | Changes |
|------|---------|
| QueryView | Add StarterPrompts component above input, "Add to Dashboard" button after results |
| DashboardView | Complete rework — dashboard selector, card grid, chart rendering, screenshot button |
| DataView | Add "Add to Dashboard" button after results |
| ExplorerView | No changes |
| StatusBar | No changes |

---

## 8. New Components

| Component | Purpose |
|-----------|---------|
| `StarterPrompts` | Pill buttons loaded from /api/prompts, clickable |
| `ChartCard` | Dashboard card with table + chart + type switcher + column mapping |
| `DashboardSelector` | Dropdown for switching between named dashboards |
| `useDashboards` | Hook for dashboard CRUD + localStorage persistence |

---

## 9. Testing Strategy

### Unit Tests
- `useDashboards` hook — CRUD operations, localStorage read/write, sample dashboard creation
- `ChartCard` component — renders table, switches chart types, column mapping
- `StarterPrompts` component — loads from API, click handler fills input

### E2E Tests
- `GET /api/prompts` returns array of question strings
- Dashboard persistence is localStorage-only — unit tests cover it

### No Backend Changes
One new lightweight endpoint (`GET /api/prompts`). No dbt models, no schema changes.

---

## 10. Explicitly NOT in This Batch (Backlog)

- Query history / chat history
- Self-improving prompt tracking (analytics on which prompts users click)
- JSON dashboard export/import for sharing
- Individual chart PNG export
- Dashboard templates library
- PDF export with formatted report layout
- Dashboard duplication

---

## 11. Decisions Log

| Date | Decision | Choice | Rationale |
|------|----------|--------|-----------|
| 2026-03-10 | Starter prompt source | Load from YAML verified_queries via API | Self-maintaining as queries are added. Dedicated endpoint enables future tracking. |
| 2026-03-10 | Chart type selection | User picks from toolbar (default: table) | Tables always render correctly. No AI complexity for chart suggestion. |
| 2026-03-10 | Dashboard persistence | Named dashboards in localStorage | Multiple dashboards for different use cases. No backend needed during MVP. |
| 2026-03-10 | Export format | PNG screenshot (html2canvas) | Simplest, most useful format for email/Slack/presentations. PDF adds complexity for minimal gain. |
| 2026-03-10 | Sample dashboard | 1 pre-built "Operations Overview" on first visit | Users learn by example. Proves the system works immediately. |
| 2026-03-10 | Query history | Backlog | Not trivial to do well (persistence, UI, scroll). Separate batch. |
