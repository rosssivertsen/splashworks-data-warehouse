---
entity: acquisition-cohort
type: glossary
status: DRAFT
system_of_record: skimmer
systems: [skimmer, warehouse]
warehouse_tables: [dim_customer, stg_customer_tag, stg_tag]
related: [customer, tag, brand]
---

# Acquisition Cohort

## Definition

A named group of customers acquired via a specific M&A transaction or branded onboarding wave. Each cohort tracks **retention** over time — what percentage of acquired customers are still active — to measure the durability of an acquisition.

Acquisition Cohorts are first-class to executive reporting because Splashworks (and JOMO) grew via roll-up of smaller pool-service operators, and the question "did the acquisition hold?" is more important than "how many customers do we have today?"

## System of Record

**Primary:** Skimmer — cohort membership is recorded via the `Tag` entity. A customer is "in" a cohort when they have a `CustomerTag` row pointing at the cohort's named Tag.
**Rationale:** Tagging is the existing mechanism used by ops to track M&A provenance; no separate Cohort table is needed.

## Registered cohorts (canonical list)

This list is the canonical registry — source of truth lives in `sales-dashboard/refresh/cohorts.py:17` (`COHORTS` constant) and is mirrored here. If they drift, **`cohorts.py` is the live truth**; this file should be updated to match.

| Tag name (Skimmer) | Brand | Acquisition date | Mode | Display label |
|---|---|---|---|---|
| `PoolLogic` | JOMO | 2025-09-11 | `legacy` | Pool Logic |
| `JomoLegacy` | JOMO | 2025-09-11 | `route_before_tag` | Jomo Legacy |
| `SUNCASTER` | JOMO | 2026-01-15 | `recent` | Suncaster |
| `Russells` | Splashworks | 2026-01-08 | `recent` | Russells |
| `Brick City` | Splashworks | 2026-04-02 | `recent` | Brick City |
| `PurePools` | Splashworks | 2026-05-07 | `recent` | Pure Pools |

When a new acquisition closes, add a row to `cohorts.py` AND this table.

## Cohort modes (taxonomy)

The `mode` controls **who counts** as a member of the cohort — three modes exist because acquisitions are tagged differently depending on when the tagging happens relative to the deal.

### `recent` — batch acquisitions tagged at closing

- **Membership:** every customer carrying the cohort's Tag
- **"Active" definition:** `is_inactive = 0 AND (open_routes > 0 OR customer was created within last 14 days)`
- **Use when:** the acquisition is new and ops tagged customers at the moment of cutover. Tag application is contemporaneous with acquisition.
- **Examples:** SUNCASTER (Jan 2026), Russells (Jan 2026), Brick City (Apr 2026), Pure Pools (May 2026)

### `legacy` — retroactive tag, route-date filtered

- **Membership:** customers carrying the Tag **AND** with a first route StartDate in [acq_date − 90d, acq_date + 90d]
- **"Active" definition:** same as `recent`
- **Use when:** the acquisition happened in the past and ops applied the Tag broadly (or imperfectly). The 90-day window around the acquisition date filters out customers who picked up the tag for other reasons.
- **Example:** PoolLogic (Sept 2025)

### `route_before_tag` — pre-existing customers absorbed into a branded cohort

- **Membership:** customers carrying the Tag **AND** whose first route StartDate is **before** the acq_date
- **"Active" definition:** same as `recent`
- **Use when:** the cohort represents customers who were already Splashworks/JOMO customers before the acquisition happened — e.g., the "Jomo Legacy" cohort which is JOMO's customers from before the PoolLogic acquisition.
- **Example:** JomoLegacy

## Metric — Cohort Retention

```
retention_pct = (active_in_cohort / total_in_cohort) * 100
```

Reported per cohort. The dashboard also exposes an **Avg Acquisition Retention** which is the unweighted mean of per-cohort retention.

**Decay caveat:** "Active" requires an open route OR a recent create. A customer can be `is_inactive=0` but with all routes ended — they will NOT count as Active. This is intentional: the question is "are we still serving them?" not "have we administratively closed them?"

## Key business rules

- **A customer can be in multiple cohorts** if they carry multiple Tags. The retention metric counts them once per cohort independently.
- **Tag is the only join key** — there is no `cohort_id` column on Customer. Cohorts are defined entirely by Tag name + computation mode.
- **Mode is metadata, not stored on the Tag** — it lives in `cohorts.py` and this glossary. The Tag itself in Skimmer is just a string.
- **Brand binding** — every cohort belongs to exactly one Brand (JOMO or Splashworks). A cohort cannot span Brands because the underlying Skimmer databases are separate.
- **Cohort "active" is stricter than Customer "active"** — Customer "active" allows zero open routes if `is_inactive=0`; Cohort "active" requires open routes OR very recent creation.

## Field mapping

| Canonical | Source | Notes |
|-----------|--------|-------|
| cohort | derived | Tag.Name matched against the cohort registry |
| acq_date | (this glossary + cohorts.py) | M&A close date or onboarding date — not stored in Skimmer |
| mode | (this glossary + cohorts.py) | One of: `recent`, `legacy`, `route_before_tag` |
| total | derived | Count of customers in cohort by mode-specific rule |
| active | derived | Subset of total meeting active definition |
| retention_pct | derived | `100 * active / total` |

## Open questions for Ross

- Should the cohort registry (Tag name + acq_date + mode + brand) move into a SDW table — e.g., `dim_acquisition_cohort` — so it can be queried in SQL without a Python file? Today only `cohorts.py` knows the modes.
- Is the 14-day "recent create" grace period in the `recent` mode active definition still the right value? It was set to absorb the gap between acquisition close and full Skimmer route setup; if onboarding now happens within ~3 days, this could tighten to 7.
- For the `legacy` mode's ±90-day window: is 90 days the right value, or does the actual PoolLogic data suggest a different boundary?
- Long-term: should cohorts persist forever (lifetime retention curves), or sunset after some horizon (e.g., 24 months post-acquisition retention is "the answer" and we stop tracking)?

## Related

- [Tag](tag-DRAFT.md) — the underlying Skimmer mechanism
- [Customer](customer.md) — cohort members
- [Brand](brand-DRAFT.md) — each cohort is brand-bound
- `sales-dashboard/refresh/cohorts.py` — live implementation
- Dashboard tile: "Cohort Retention by Acquisition" at `dashboard/index.html:416`

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-23 | Initial DRAFT — captures the 6 cohorts + 3 modes that exist only in `cohorts.py`. M&A history made queryable. | Claude (on Ross's direction) |
