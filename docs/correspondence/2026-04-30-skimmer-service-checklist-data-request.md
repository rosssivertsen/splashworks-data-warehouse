# Skimmer — Service Checklist Data Access Request

**Draft date:** 2026-04-30
**From:** Ross Sivertsen, Splashworks
**To:** glenn@getskimmer.com
**Subject:** Service Checklist data — extract or API access for warehouse reporting

---

Hi Glenn,

Following up on the schema thread from late April — your guidance on the
route-assignment canonical filter and the `2080-01-01` sentinel was load-bearing
for getting our active-route reporting right, so thanks again for that.

Quick context if it's useful: we've built an internal data warehouse on top of the
nightly SQLite extract we receive for our two Skimmer accounts:

- **A Quality Pool Service of Central Florida, Inc. (AQPS)** — CompanyId `e265c9dee47c47c6a73f689b0df467ca`
- **Jomo Pool Service (JOMO)** — CompanyId `95d37a64d1794a1caef111e801db5477`

The warehouse already powers operational reporting (revenue, route productivity,
chemistry compliance, customer LTV, etc.) using the 45 tables the extract delivers.
We've now hit a data gap I'd like your read on.

## What we'd like to report on

Per-route, per-stop, per-day:

> For every stop on a given day, was each Service Checklist item completed?
> If not completed, what was the reason?

This is operational quality data for tech accountability and customer-facing
service-quality assurance.

## What we found

We checked both the SQLite extract and your developer portal at
`devportal.getskimmer.com` before writing — wanted to make sure we weren't
asking for something already shipped.

**SQLite extract (45 tables, both accounts, 2026-04-30 dump):**

- No table named anything like `ServiceChecklist`, `ChecklistItem`, `StopTask`, etc.
- No column named `checklist`, `task`, `complete`, or `done` other than the
  stop-level `RouteStop.CompleteTime` and `WorkOrder.CompleteTime`.
- The literal item values `Balanced Water to LSI` and `Clean Automatic Vacuum`
  (the most distinctive items from the JOMO checklist) appear in zero rows
  across either account's extract.

**Public API (devportal.getskimmer.com):**

- The `Routes` endpoint (`GetTechRoute` / `GetAllRoutesForDay`) is the most likely
  host for this data. Response payload exposes only stop-level fields: `id`,
  `customerId`, address fields, `sequence`, and `completeTime`. No checklist,
  no notes, no skip reason.
- For our use case the API is actually thinner than the SQLite extract —
  `RouteSkip` and `SkippedStopReason` (which we do use today) aren't present.
- We also weren't able to find a dedicated `Checklist`, `ServiceStop`, or
  `RouteSkip` resource in the 16-resource sidebar.

**But your help docs confirm the data does exist in the system:**

- "Each checklist task completed is recorded and appears within the service
  history record" — help.getskimmer.com/article/40
- "Service History — completed service records exported to spreadsheet by date
  range, for all clients or one you select" — Settings → Export

So Skimmer captures this; it just isn't exposed programmatically today.

## Three ways we could see this working

Listed in what we'd guess is least-to-most engineering effort on your side —
happy to flip that ordering if it doesn't match how you'd think about it:

### Option C — Scheduled Service History CSV drop

The Settings → Export → Service History export already produces the spreadsheet
we'd need. If that same export could be written nightly to the OneDrive folder
where the SQLite extract already lands (or a sibling folder), we'd ingest it
through the same pipeline we use today. No schema changes, no new endpoints —
just automation around export logic that already exists.

### Option B — Expanded nightly SQLite extract

Adding the underlying tables to the SQLite dump we already receive. From the UI
we'd guess this looks something like:

- `ServiceChecklistItem` — per-company checklist template (`id`, `CompanyId`, `Description`, `Sequence`)
- `ServiceStopChecklistCompletion` — per-stop, per-item status (`id`, `ServiceStopId`, `ServiceChecklistItemId`, `IsCompleted`, `NotCompletedReasonId`, `CompletedAt`, `CompanyId`)
- `ChecklistNotCompletedReason` — lookup for skip-style reasons (if you maintain one)

Names are illustrative — whatever matches your internal model is fine.

### Option A — Public API expansion

Add checklist data to the `Routes` endpoint response (or a new `ServiceStops`
resource). This would also be a natural place to expose `RouteSkip` /
`SkippedStopReason`, which we use heavily from the SQLite extract today and
would otherwise lose if we ever consolidated onto the API.

## Two related questions on API access

Independent of the checklist gap — since I was in the developer portal anyway:

1. Are AQPS and JOMO eligible for API access on our current plan, or is the
   "Owning the Market" tier a prerequisite?
2. Is there a roadmap for surfacing `RouteSkip` / `SkippedStopReason` /
   `ServiceStop` granularity through the API? Right now the SQLite extract is
   the richer surface, which feels like an inversion of what you'd typically
   want for an enterprise API.

## Time window we'd need

Same trailing 6-month window as the current extract — plenty for the
operational reporting we're after.

## Other notes

- Not asking for raw access to other accounts' data — just AQPS and JOMO.
- We're paying customers in good standing on both accounts.
- If any of this is on your roadmap or already addressed via a feature we
  haven't enabled, even a pointer in that direction would help.

Thanks Glenn — and if any of these belong on someone else's plate (support,
product, sales for the API tier question), just point me in that direction.

Best,
Ross Sivertsen
Splashworks
<mail@ross-sivertsen.com>
