# Route Assignment

> **Status:** DRAFT — pending review before release

## Definition

A recurring schedule entry that assigns a technician to service a specific location on a given day of the week at a defined frequency. Route assignments are the backbone of Splashworks operations — they define who goes where, when, and how often. The system automatically generates route stops (individual visits) from these assignments.

## System of Record

**Primary:** Skimmer
**Rationale:** Skimmer is the only system that manages route scheduling, technician assignments, and visit generation. Neither QBO nor Zoho CRM has a routing concept. The data warehouse stages route assignment data for analytics but is not a write target.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| RouteAssignment | Skimmer | Database entity name |
| Route | Skimmer UI | User-facing shorthand (e.g., "Mike's Monday route") |
| Schedule | Skimmer UI | Sometimes used interchangeably with "route" |
| stg_route_assignment | Data Warehouse | Staging model (no warehouse dim yet — analytics done via fact_service_stop joins) |
| — | QuickBooks Online | No equivalent |
| — | Zoho CRM | No equivalent |

## Naming Convention

**Standard format:** Route assignments are identified by technician + day + location, not by a user-facing name.

**Rules:**
- Routes are colloquially referenced by tech name + day: "Mike's Monday route", "Sarah's Thursday route"
- `DayOfWeek` uses full day names: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- `Frequency` values: Weekly, Biweekly, Triweekly, Monthly, EveryFourWeeks, EveryFiveWeeks, EveryTwoMonths
- `Sequence` determines the visit order within a day's route (lower = earlier in the day)

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | RouteAssignment.id | UUID | `e7f8a1b2c3d4...` |
| Data Warehouse | route_assignment_id + _company_name | UUID + text | `e7f8a1b2...` + `AQPS` |

## Key Business Rules

- **One assignment = one tech + one location + one day:** A service location on a Wednesday route with Mike is one route assignment. If the same location also needs Friday service with Sarah, that's a second assignment.
- **Frequency drives visit generation:** Skimmer auto-generates `RouteStop` records based on the frequency. Biweekly assignments have off-week logic; triweekly generates every third week.
- **Sequence = route order:** Lower sequence numbers are serviced first. Techs follow this order in the mobile app.
- **Status values:** Active, Paused, Ended
  - Active: generating stops normally
  - Paused: temporarily suspended (e.g., snowbird customer away for season)
  - Ended: permanently stopped (EndDate set)
- **Soft delete:** `Deleted` flag — warehouse filters `deleted = 0`
- **Route moves:** One-time schedule changes (moving a stop to a different date or tech) are tracked via `RouteMove`, not by modifying the assignment
- **Route skips:** Pre-planned skip dates (vacations, holidays) are tracked via `RouteSkip`
- **Multi-tenancy:** Each assignment belongs to exactly one company entity (AQPS or JOMO)

## Data Flow

```
Skimmer (RouteAssignment — admin creates and manages)
    │
    ├── System generates RouteStop records per frequency
    │   └── RouteStop → ServiceStop (per pool) → ServiceStopEntry (readings)
    │
    ├── RouteSkip — admin marks specific dates to skip
    │
    ├── RouteMove — admin moves a specific visit to another date/tech
    │
    └── Nightly SQLite Extract
        └── Data Warehouse
            └── public_staging.stg_route_assignment (raw: tech, location, day, frequency, sequence)
```

**Not yet a warehouse dimension.** Route assignment data is staged but not promoted to a `dim_route_assignment`. Analytics on routes currently join `fact_service_stop` back to `stg_route_assignment`. A future dim model would support route density, utilization, and scheduling optimization queries.

## Field Mapping

| Canonical Field | Skimmer | Warehouse | Notes |
|----------------|---------|-----------|-------|
| Assignment ID | id | route_assignment_id | UUID primary key |
| Location | ServiceLocationId | service_location_id | FK to Service Location |
| Technician | AccountId | account_id | FK to Account / dim_tech |
| Day of Week | DayOfWeek | day_of_week | Monday through Sunday |
| Frequency | Frequency | frequency | Weekly, Biweekly, etc. |
| Start Date | StartDate | start_date | When assignment begins |
| End Date | EndDate | end_date | When assignment ends (nullable) |
| Sequence | Sequence | sequence | Route order (integer) |
| Deleted | Deleted | deleted | Soft delete, filtered in staging |
| Company | CompanyId | _company_name | AQPS or JOMO |

## Training Resources

**Skimmer is the system of record and the action surface for route changes.** The data warehouse is read-only and supports analytics only — it cannot move, reassign, or reorder routes. For the operational workflow ("re-route this customer", "move all of Mike's Wednesday stops to Sarah for the week"), use Skimmer directly:

- [View, Build, and Manage Routes (Web) — Route Dashboard](https://help.getskimmer.com/article/98-view-build-and-manage-routes-web) — primary admin surface
- [Manage Route Assignments (Web)](https://help.getskimmer.com/article/97-manage-route-assignments-web) — create / edit / end assignments
- [Move a Route Assignment (App)](https://help.getskimmer.com/article/37-move-a-route-assignment-app) — mobile-side reassignment
- [The Schedule – Calendar](https://help.getskimmer.com/article/273-the-schedule-calendar) — calendar view across techs

**Temporary vs. permanent move semantics in Skimmer:**
- **Temporary** (one-off stop shifted to a different tech/day) → generates a `RouteMove` row. The underlying `RouteAssignment` is unchanged. Use when covering a vacation, sick day, or an overrun.
- **Permanent** ("move this customer to Sarah going forward") → ends the current `RouteAssignment` (sets `EndDate`) and creates a new one. Use when a customer is being reassigned long-term.

The warehouse captures both: `fact_route_move` (temporary) and historical `stg_route_assignment` rows (permanent — identifiable via `EndDate < CURRENT_DATE`).

## Related Entities

- [Technician](technician-DRAFT.md) — many:1 (each assignment belongs to one technician)
- [Service Location](service-location.md) — many:1 (each assignment targets one location)
- [Service Stop](service-stop-DRAFT.md) — 1:many (assignments generate service stops)
- [Customer](customer.md) — indirect via Service Location (assignment → location → customer)
- [Pool](pool.md) — indirect via Service Location → Pool (each pool at the location gets serviced)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — Skimmer RouteAssignment schema + warehouse staging model | Claude / Ross Sivertsen |
