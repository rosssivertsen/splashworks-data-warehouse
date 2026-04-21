# Entity State Diagrams

**Purpose:** Lifecycle states for key Splashworks business entities. Each state corresponds to a set of flag/field values in the system of record.

**Last updated:** 2026-04-20

---

## 1. Customer Lifecycle

From Zoho lead through Skimmer active → suspended → cancelled → archived.

```mermaid
stateDiagram-v2
    [*] --> Lead: Zoho intake
    Lead --> Active: Converted to Skimmer customer
    [*] --> Active: Direct Skimmer creation

    Active --> Suspended: Overdue +\nShouldSuspendOnOverdue=1
    Suspended --> Active: Payment received

    Active --> Cancelled: is_inactive=1
    Suspended --> Cancelled: is_inactive=1

    Cancelled --> Active: Reactivation\n(rare)
    Cancelled --> Archived: deleted=1

    Archived --> [*]
```

**Field mapping:**

| State | `is_inactive` | `deleted` | Other |
|---|---|---|---|
| Lead | — | — | In Zoho only |
| Active | 0 | 0 | |
| Suspended | 0 | 0 | Overdue balance + `ShouldSuspendOnOverdue=1` |
| Cancelled | 1 | 0 | `updated_at` = cancellation date |
| Archived | any | 1 | Tombstone |

---

## 2. Invoice Lifecycle

QBO is system of record for invoice state.

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Sent: Delivered to customer
    Sent --> PartiallyPaid: payment < total
    Sent --> Paid: payment >= total
    PartiallyPaid --> Paid: additional payment
    Sent --> Overdue: past due date, unpaid
    PartiallyPaid --> Overdue: past due date
    Overdue --> Paid: payment received
    Overdue --> Voided: written off
    Sent --> Voided: cancelled
    Draft --> Voided: cancelled pre-send
    Paid --> [*]
    Voided --> [*]
```

---

## 3. Work Order Lifecycle

Ad-hoc repair/maintenance request, separate from recurring Service Stops.

```mermaid
stateDiagram-v2
    [*] --> Requested: Customer or tech initiates
    Requested --> Scheduled: Route Assignment created
    Requested --> Cancelled: Customer withdraws

    Scheduled --> InProgress: Tech on-site
    Scheduled --> Cancelled: Rescheduled out /\ncustomer withdraws

    InProgress --> Completed: Work done,\ndosages + checklist recorded
    InProgress --> Incomplete: Unable to complete\n(parts, access, weather)

    Incomplete --> Scheduled: Re-scheduled
    Completed --> Invoiced: Billed to QBO
    Invoiced --> Closed: Payment applied

    Cancelled --> [*]
    Closed --> [*]
```

---

## 4. Service Stop Lifecycle

Recurring per-visit record. Different from work order — these are scheduled weekly routes.

```mermaid
stateDiagram-v2
    [*] --> Scheduled: Route Assignment assigns\npool to route day
    Scheduled --> Skipped: Skip reason recorded\n(gate locked, weather, etc.)
    Scheduled --> InProgress: Tech arrives
    InProgress --> Completed: Readings +\nchecklist +\ndosages recorded
    InProgress --> Incomplete: Partial completion
    Incomplete --> Scheduled: Re-scheduled for make-up
    Completed --> [*]
    Skipped --> [*]
```

**Sentinel:** Skimmer stores non-completion as `service_date = 2010-01-01 12:00:00` — warehouse filters this out when computing "completed stops."

---

## 5. Inventory Count Lifecycle

The physical stocktake process (not an entity, but a governed workflow).

```mermaid
stateDiagram-v2
    [*] --> Initiated: Master Count created
    Initiated --> InProgress: Counters assigned\nto locations
    InProgress --> Submitted: All counts entered
    Submitted --> Reviewed: Variance report generated
    Reviewed --> Adjusted: Variance > threshold\n→ QBO adjustment
    Reviewed --> Closed: Variance within tolerance
    Adjusted --> Closed: Adjustment posted to QBO\n(QOH updated)
    Closed --> [*]
```

---

## Related

- [Entity Map](entity-map.md) — the nouns
- [Data Flow Diagrams](data-flow-diagrams.md) — how data moves
- [System Landscape](system-landscape.md) — the topology
