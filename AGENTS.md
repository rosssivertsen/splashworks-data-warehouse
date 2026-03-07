# AGENTS.md

This file provides guidance to coding agents (including Codex) when working in this repository.

## Project Overview

**Name:** Splashworks Pool Service BI Visualizer
**Purpose:** AI-powered natural language -> SQL query tool over nightly Skimmer database extracts
**Stack:** React + TypeScript, Vite, Tailwind CSS, Netlify (hosting + serverless functions), Cloudflare Workers, Vitest

## Commands

```bash
npm run dev          # Start dev server via Netlify (includes serverless functions)
npm run dev:vite     # Vite only (no serverless functions)
npm run build        # TypeScript check + production build
npm run test         # Run Vitest test suite
npm run test:ui      # Vitest with UI
npm run lint         # ESLint
npm run extract:nightly -- /path/to/extract.tar.gz  # Load nightly tarball into data/
npm run extract:latest  # Auto-load latest AQPS/JOMO files from OneDrive nightly folder
npm run query -- --db union --file queries/active-customers.sql  # Run ad hoc SQL
npm run gaps         # Run quick non-destructive data gap checks
```

## Architecture

- **Frontend:** React + TypeScript SPA (`src/`)
- **AI Layer:** Multi-provider (Claude, OpenAI, Gemini) - see `docs/MULTI_PROVIDER_AI_GUIDE.md`
- **Database:** SQLite databases loaded in-browser via sql.js (WebAssembly)
- **Serverless functions:** Netlify Functions (`netlify/`) for AI API proxying
- **Deployment:** Netlify (`netlify.toml`), Cloudflare Workers (`wrangler.toml`)
- **Storage:** IndexedDB for persisted union databases in-browser

## Data Sources

Nightly extract from Skimmer (pool service management SaaS), trailing 12-month period, delivered as a tarball. Two company entities:

| Database | Company |
|----------|---------|
| `AQPS.db` | AQPS |
| `JOMO.db` | JOMO |

Production nightly extracts are loaded locally into `data/` (gitignored) via `npm run extract:nightly`.
`test-databases/AQPS.db` and `test-databases/JOMO.db` are test-only fixtures.
Both databases have **identical schemas** - `CompanyId` field distinguishes records when unioned.

## Nightly Ad Hoc Workflow

1. Load the newest nightly AQPS/JOMO files automatically:
   `npm run extract:latest`
2. Run ad hoc query on merged dataset:
   `npm run query -- --db union --sql "SELECT COUNT(*) FROM u_Customer WHERE IsInactive = 0 AND Deleted = 0;"`
3. Run starter checks for missing data and orphaned records:
   `npm run gaps`
4. Use reusable SQL templates in `queries/` with:
   `npm run query -- --db union --file queries/<template>.sql`

### Fixed nightly source defaults

- Nightly folder:
  `/Users/rosssivertsen/Library/CloudStorage/OneDrive-Splashworks/Skimmer User's files - Splashworks/Skimmer Nightly Extract`
- AQPS filename prefix (CompanyId): `e265c9dee47c47c6a73f689b0df467ca`
- JOMO filename prefix (CompanyId): `95d37a64d1794a1caef111e801db5477`
- `npm run extract:latest` uses these defaults and materializes:
  - `data/AQPS.db`
  - `data/JOMO.db`

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

## Database Schema - Key Tables

**Core entities:**
- `Customer` - `id`, `FirstName`, `LastName`, `Notes`, `BillingAddress/City/State/Zip`, `CustomerCode`, `QboCustomerId`, `IsInactive`, `CompanyId`
- `ServiceLocation` - `id`, `CustomerId`, `Address/City/State/Zip`, `Notes`, `Rate`, `GateCode`, `DogsName`
- `Pool` - `id`, `ServiceLocationId`, `Name` (body of water type), `Gallons`, `Notes`

**Service operations:**
- `ServiceStop` - per-visit record; has `Notes`, `NotesToCustomer`, `NoteIsAlert`
- `ServiceStopEntry` - chemical readings and task records per stop
- `WorkOrder` - `WorkNeeded`, `WorkPerformed`, `Notes`, `NoteIsAlert`, `ServiceDate`

**Billing:**
- `Invoice` - `CustomerId`, `InvoiceNumber`, `Total`, `AmountDue`, `Status`, `PaymentStatus`
- `InvoiceItem`, `Payment`

**Key join path (customer -> chemical history):**
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
- `Customer.Notes` - top-level customer notes
- `ServiceLocation.Notes` - location-specific notes
- `Pool.Notes` - body of water notes
- `ServiceStop.Notes` - technician notes per visit
- `ServiceStop.NotesToCustomer` - customer-facing visit notes
- `WorkOrder.Notes` + `NoteIsAlert` + `NoteIsHandled`
- `EquipmentItem.Notes`

## Related Project

**CRM -> Skimmer POC** (`../CRMtoSkimmer/crm-to-skimmer-poc`) - Zoho CRM <-> Skimmer bi-directional sync. Uses the same Skimmer schema. `Customer.CustomerCode` is the intended cross-reference field for storing Zoho contact IDs.
