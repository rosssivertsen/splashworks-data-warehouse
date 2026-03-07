# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**Name:** Splashworks Pool Service BI Visualizer
**Purpose:** AI-powered natural language → SQL query tool over nightly Skimmer database extracts
**Stack:** React + TypeScript, Vite, Tailwind CSS, Netlify (hosting + serverless functions), Cloudflare Workers, Vitest

## Commands

```bash
npm run dev          # Start dev server via Netlify (includes serverless functions)
npm run dev:vite     # Vite only (no serverless functions)
npm run build        # TypeScript check + production build
npm run test         # Run Vitest test suite
npm run test:ui      # Vitest with UI
npm run lint         # ESLint
```

## Architecture

- **Frontend:** React + TypeScript SPA (`src/`)
- **AI Layer:** Multi-provider (Claude, OpenAI, Gemini) — see `docs/MULTI_PROVIDER_AI_GUIDE.md`
- **Database:** SQLite databases loaded in-browser via sql.js (WebAssembly)
- **Serverless functions:** Netlify Functions (`netlify/`) for AI API proxying
- **Deployment:** Netlify (`netlify.toml`), Cloudflare Workers (`wrangler.toml`)
- **Storage:** IndexedDB for persisted union databases in-browser

## Data Sources

Nightly extract from Skimmer (pool service management SaaS), trailing 6-month period, delivered as a tarball. Two company entities:

| Database | Company |
|----------|---------|
| `AQPS.db` | AQPS |
| `JOMO.db` | JOMO |

Test databases: `test-databases/AQPS.db`, `test-databases/JOMO.db`
Both databases have **identical schemas** — `CompanyId` field distinguishes records when unioned.

**Company IDs (stable across all extracts):**

| Company | CompanyId | Full Name |
|---------|-----------|-----------|
| AQPS | `e265c9dee47c47c6a73f689b0df467ca` | A Quality Pool Service of Central Florida, Inc. |
| JOMO | `95d37a64d1794a1caef111e801db5477` | Jomo Pool Service |

## Key Documentation

| File | Purpose |
|------|---------|
| `docs/skimmer-semantic-layer.yaml` | Business terms, SQL patterns, join paths, verified queries, LSI calculation |
| `docs/DATA_DICTIONARY.md` | Full field-level documentation for all 30 tables |
| `docs/ERD.md` + `.svg/.png` | Entity relationship diagrams (Mermaid + rendered) |
| `docs/DATABASE_UNION_GUIDE.md` | How multi-database union works (in-memory, IndexedDB persistence) |
| `docs/SEMANTIC_LAYER_INTEGRATION.md` | How the semantic layer feeds the AI query system |
| `docs/SCHEMA_VALIDATION_REPORT.md` | Schema validation approach and results |
| `docs/Skimmer-schema.sql` | Canonical DDL for all tables |

## Database Schema — Key Tables

**Core entities:**
- `Customer` — `id`, `FirstName`, `LastName`, `Notes`, `BillingAddress/City/State/Zip`, `CustomerCode`, `QboCustomerId`, `IsInactive`, `CompanyId`
- `ServiceLocation` — `id`, `CustomerId`, `Address/City/State/Zip`, `Notes`, `Rate`, `GateCode`, `DogsName`
- `Pool` — `id`, `ServiceLocationId`, `Name` (body of water type), `Gallons`, `Notes`

**Service operations:**
- `ServiceStop` — per-visit record; has `Notes`, `NotesToCustomer`, `NoteIsAlert`
- `ServiceStopEntry` — chemical readings and task records per stop
- `WorkOrder` — `WorkNeeded`, `WorkPerformed`, `Notes`, `NoteIsAlert`, `ServiceDate`

**Billing:**
- `Invoice` — `CustomerId`, `InvoiceNumber`, `Total`, `AmountDue`, `Status`, `PaymentStatus`
- `InvoiceItem`, `Payment`

**Key join path (customer → chemical history):**
```sql
Customer
  JOIN ServiceLocation ON Customer.id = ServiceLocation.CustomerId
  JOIN Pool ON ServiceLocation.id = Pool.ServiceLocationId
  JOIN ServiceStop ON Pool.id = ServiceStop.PoolId
  JOIN ServiceStopEntry ON ServiceStop.id = ServiceStopEntry.ServiceStopId
  JOIN EntryDescription ON ServiceStopEntry.EntryDescriptionId = EntryDescription.id
```

**Active customer filter:** `WHERE Customer.IsInactive = 0 AND Customer.Deleted = 0`

## Notes Fields (multiple levels)
- `Customer.Notes` — top-level customer notes
- `ServiceLocation.Notes` — location-specific notes
- `Pool.Notes` — body of water notes
- `ServiceStop.Notes` — technician notes per visit
- `ServiceStop.NotesToCustomer` — customer-facing visit notes
- `WorkOrder.Notes` + `NoteIsAlert` + `NoteIsHandled`
- `EquipmentItem.Notes`

## Ad Hoc Query Workflow

For quick, interactive queries against nightly Skimmer extracts using Claude Code.

### Nightly extract source

Extracts sync via OneDrive to:
```
/Users/rosssivertsen/Library/CloudStorage/OneDrive-Splashworks/Skimmer User's files - Splashworks/Skimmer Nightly Extract/
```
Files are named `{CompanyId}.db.gz`. The script maps them to friendly names (AQPS.db, JOMO.db).

### Loading a nightly extract

```bash
./cli/load-extract.sh           # Load from OneDrive (default)
./cli/load-extract.sh status    # Show currently loaded databases
```

This decompresses `.db.gz` files into `data/` (gitignored). Running it again overwrites previous databases.

### Database locations

| Database | Path |
|----------|------|
| AQPS (live extract) | `data/AQPS.db` |
| JOMO (live extract) | `data/JOMO.db` |
| AQPS (test) | `test-databases/AQPS.db` |
| JOMO (test) | `test-databases/JOMO.db` |

### Running queries

Ask Claude Code directly — it will use `sqlite3` against the databases in `data/`. Examples:

- "How many active customers does AQPS have?"
- "Show me customers with no service stops in the last 30 days"
- "Find service locations missing zip codes and generate UPDATE statements"
- "Compare chemical reading averages between AQPS and JOMO"

Claude Code uses the schema docs (`docs/DATA_DICTIONARY.md`, `docs/skimmer-semantic-layer.yaml`) to write correct SQL.

### Cross-database queries

To query across both companies, use ATTACH:
```sql
sqlite3 data/AQPS.db "ATTACH 'data/JOMO.db' AS jomo; SELECT 'AQPS' AS company, COUNT(*) FROM Customer WHERE IsInactive=0 UNION ALL SELECT 'JOMO', COUNT(*) FROM jomo.Customer WHERE IsInactive=0;"
```

## Related Project

**CRM → Skimmer POC** (`../CRMtoSkimmer/crm-to-skimmer-poc`) — Zoho CRM ↔ Skimmer bi-directional sync. Uses the same Skimmer schema. `Customer.CustomerCode` is the intended cross-reference field for storing Zoho contact IDs.
