# Service Stop

> **Status:** DRAFT — pending review before release

## Definition

A single completed visit to a pool by a technician. Service stops are the operational grain of the entire Splashworks data model — every chemical reading, dosage record, and time-on-site measurement hangs off a service stop. In the data warehouse, `fact_service_stop` is the primary fact table, powering service history, completion rates, technician utilization, and profitability analysis.

## System of Record

**Primary:** Skimmer
**Rationale:** Service stops are created by the Skimmer system when route stops are generated, and completed by technicians via the Skimmer mobile app. No other system captures visit-level operational data.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| ServiceStop | Skimmer | Database entity — per-pool record within a route visit |
| RouteStop | Skimmer | Database entity — per-visit record (a RouteStop generates one ServiceStop per pool at the location) |
| Service Visit | Skimmer UI | User-facing term for a completed stop |
| fact_service_stop | Data Warehouse | Warehouse fact table — joins RouteStop + ServiceStop |
| rpt_service_history | Data Warehouse | Denormalized report with customer/tech/pool names |
| — | QuickBooks Online | No equivalent — QBO only sees the resulting invoice |
| — | Zoho CRM | No equivalent |

## Naming Convention

**Standard format:** Service stops are identified by date + pool + technician, not by a user-facing name.

**Rules:**
- `ServiceDate` is the date of the visit
- `Notes` are internal technician notes (not shown to customer)
- `NotesToCustomer` are included in the service report email sent to the customer
- `NoteIsAlert` flags urgent issues requiring follow-up (e.g., equipment failure, green pool)

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer (RouteStop) | RouteStop.id | UUID | `b1c2d3e4f5a6...` |
| Skimmer (ServiceStop) | ServiceStop.id | UUID | `c2d3e4f5a6b7...` |
| Data Warehouse | route_stop_id + service_stop_id | UUID pair | Joined in fact_service_stop |

**Two-level structure:**
- `RouteStop` = the planned visit to a location (one per location per date)
- `ServiceStop` = the per-pool service record within that visit (one per pool at the location)
- The warehouse `fact_service_stop` joins these together, using `route_stop_id` as the primary grain

## Key Business Rules

- **Grain:** One `RouteStop` per location per visit date. One `ServiceStop` per pool within that RouteStop. A location with 2 pools generates 1 RouteStop and 2 ServiceStops.
- **Completion tracking:**
  - `StartTime` = when the tech arrived (tapped "Start" in the app)
  - `CompleteTime` = when the tech finished (tapped "Complete")
  - **Sentinel value:** `CompleteTime = '2010-01-01 12:00:00'` means NOT completed (Skimmer uses this instead of NULL)
  - Warehouse derives `service_status`: 1 = completed, 0 = skipped/incomplete
- **Minutes at stop:** `MinutesAtStop` records the duration of the visit. Typical range 15-90 minutes, average ~27 minutes.
- **Skipped stops:** When a stop is skipped, `IsSkipped = 1` on the RouteStop, with an optional `SkippedStopReasonId` (weather, gate locked, customer request, etc.)
- **Customer communication:** `NotesToCustomer` is included in the post-service email. `NoteIsAlert` + `NoteIsHandled` track urgent issues and their resolution.
- **Photo documentation:** `PhotoUrl` on RouteStop links to service photos taken by the tech
- **Email tracking:** `EmailStatus` and `EmailSentDate` track whether the customer was notified

## Data Flow

```
Skimmer (RouteAssignment generates RouteStop per schedule)
    │
    ├── Tech opens Skimmer mobile app
    │   ├── Taps "Start" → StartTime recorded
    │   ├── Records chemical readings → ServiceStopEntry records
    │   ├── Adds notes, photos
    │   └── Taps "Complete" → CompleteTime recorded
    │
    ├── ServiceStop created per pool at the location
    │   └── ServiceStopEntry records per reading/dosage
    │
    ├── Admin reviews alerts (NoteIsAlert = true)
    │
    └── Nightly SQLite Extract
        └── Data Warehouse
            ├── public_staging.stg_route_stop (raw route-level visit data)
            ├── public_staging.stg_service_stop (raw pool-level service data)
            ├── public_warehouse.fact_service_stop (joined: route + service + location)
            └── public_semantic.rpt_service_history (denormalized with names, 69,186+ rows)
```

## Field Mapping

| Canonical Field | Skimmer (RouteStop) | Skimmer (ServiceStop) | Warehouse (fact_service_stop) | Notes |
|----------------|--------------------|-----------------------|-------------------------------|-------|
| Route Stop ID | id | RouteStopId | route_stop_id | Visit-level grain |
| Service Stop ID | — | id | service_stop_id | Pool-level grain |
| Pool | — | PoolId | pool_id | FK to Pool / dim_pool |
| Location | ServiceLocationId | — | service_location_id | FK to Service Location |
| Customer | — | — | customer_id | Derived via service_location join |
| Technician | AccountId | — | tech_id | FK to Account / dim_tech |
| Service Date | ServiceDate | ServiceDate | service_date | TEXT in warehouse |
| Service Month | — | — | service_month | Derived: substr(service_date, 1, 7) |
| Start Time | StartTime | — | start_time | When tech arrived |
| Complete Time | CompleteTime | — | complete_time | When tech finished |
| Minutes at Stop | MinutesAtStop | — | minutes_at_stop | Duration in minutes |
| Status | — | — | service_status | Derived: 1=completed, 0=skipped |
| Tech Notes | — | Notes | notes | Internal notes |
| Customer Notes | — | NotesToCustomer | notes_to_customer | Shown in email |
| Skipped | IsSkipped | — | — | Boolean on RouteStop |
| Skip Reason | SkippedStopReasonId | — | — | FK to SkippedStopReason |
| Photo | PhotoUrl | — | — | Not in warehouse |
| Company | CompanyId | CompanyId | _company_name | AQPS or JOMO |

## Key Join Paths

**Customer → Service History (the canonical path):**
```sql
dim_customer c
  JOIN dim_service_location sl ON c.customer_id = sl.customer_id AND c._company_name = sl._company_name
  JOIN dim_pool p ON sl.service_location_id = p.service_location_id AND sl._company_name = p._company_name
  JOIN fact_service_stop fss ON p.pool_id = fss.pool_id AND p._company_name = fss._company_name
```

**Tech → Completed Stops:**
```sql
dim_tech t
  JOIN fact_service_stop fss ON t.tech_id = fss.tech_id AND t._company_name = fss._company_name
  WHERE fss.service_status = 1
```

## Training Resources

- [View Customer Service History](https://help.getskimmer.com/article/80-view-customer-service-history-web)
- [How Time Tracking Works](https://help.getskimmer.com/article/119-how-time-tracking-works-app)
- [Skipped Stops, Skip Tracking Reasons, and Email Alerts](https://help.getskimmer.com/article/160-skipped-stops-skip-tracking-reasons-and-email-alerts)

## Related Entities

- [Route Assignment](route-assignment-DRAFT.md) — many:1 (each stop is generated from a route assignment)
- [Technician](technician-DRAFT.md) — many:1 (each stop is performed by one technician)
- [Service Location](service-location.md) — many:1 (each stop is at one location)
- [Pool](pool.md) — many:1 (each service stop record covers one pool)
- [Chemical Reading](chemical-reading-DRAFT.md) — 1:many (each stop produces chemical readings and dosage records)
- [Customer](customer.md) — indirect via Service Location
- [Invoice](invoice.md) — via InvoiceItem (completed stops can generate invoice line items)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — RouteStop + ServiceStop schema, warehouse fact_service_stop, join paths | Claude / Ross Sivertsen |
