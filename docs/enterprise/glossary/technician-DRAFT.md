# Technician

> **Status:** DRAFT — pending review before release

## Definition

A person who performs pool service, repairs, or administrative functions within Splashworks. Technicians are the workforce — they are assigned routes, complete service stops, execute work orders, and record chemical readings. Skimmer calls this entity "Account," which is confusingly generic — in business context, this is always a technician or admin user.

## System of Record

**Primary:** Skimmer
**Rationale:** Skimmer is the only system that manages technician profiles, role assignments, route scheduling, and mobile app access. QBO has an Employee entity for payroll, but it lacks operational detail. Zoho CRM has no technician concept.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| Account | Skimmer | Database entity name — includes both techs and admins |
| Technician | Skimmer UI | User-facing term for field workers |
| Admin | Skimmer UI | User-facing term for office staff with management permissions |
| Employee | QuickBooks Online | QBO's payroll entity — maps loosely to tech for labor cost purposes |
| dim_tech | Data Warehouse | Warehouse dimension table |
| — | Zoho CRM | No equivalent |

## Naming Convention

**Standard format:** "FirstName LastName" (e.g., "Mike Rivera")

**Rules:**
- Title case — no ALL CAPS, no all lowercase
- Full legal name, not nicknames (unless the tech goes exclusively by a nickname in operations)
- Username is separate from display name — used for Skimmer login

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer | Account.id | UUID | `f8a2b3c1d5e7...` |
| QuickBooks Online | Employee.Id | Numeric | `12` |
| Data Warehouse | tech_id + _company_name | UUID + text | `f8a2b3c1...` + `AQPS` |

**Cross-system linkage:**
- No native Skimmer ↔ QBO Employee link exists. Matching is done by name.
- Warehouse renames `account_id` to `tech_id` in `dim_tech` for clarity.

## Key Business Rules

- **Role types:** Admin, Technician (other roles may exist but these are the primary two)
- **Active status:** `IsActive` boolean — inactive accounts cannot log in or be assigned routes
- **Permissions:** Granular permission flags control what each account can do:
  - `CanManageRoutes` — create/edit route assignments
  - `CanManageAdminPanel` — access admin settings
  - `CanManageSettings` — modify company configuration
  - `PreventMoveRouteStops` — restriction on rescheduling stops
  - `PreventReorderRouteStops` — restriction on changing stop order
- **Multi-tenancy:** Each account belongs to exactly one company entity (AQPS or JOMO)
- **One tech, many routes:** A technician can be assigned multiple routes across different days of the week
- **Warehouse filter:** `dim_tech` includes all accounts (active and inactive) — filter `is_active = 1` for current workforce

## Data Flow

```
Skimmer (Account — admin creates and manages)
    │
    ├── Tech logs into Skimmer mobile app
    │   └── Completes service stops, work orders, readings
    │
    ├── Admin assigns tech to routes (RouteAssignment)
    │
    └── Nightly SQLite Extract
        └── Data Warehouse
            ├── public_staging.stg_account (raw, all fields)
            └── public_warehouse.dim_tech (cleaned: tech_id, name, role, permissions)
```

**Not in QBO sync flow.** Skimmer does not sync technician/account data to QBO. Employee records in QBO are managed independently for payroll.

## Field Mapping

| Canonical Field | Skimmer | QBO Advanced | Warehouse | Notes |
|----------------|---------|--------------|-----------|-------|
| Tech ID | id | Employee.Id | tech_id | UUID in Skimmer, numeric in QBO |
| First Name | FirstName | GivenName | first_name | |
| Last Name | LastName | FamilyName | last_name | |
| Full Name | — | DisplayName | full_name | Derived: FirstName + " " + LastName |
| Role | RoleType | — | role_type | Admin, Technician |
| Active | IsActive | Active | is_active | Boolean in all systems |
| Email | Email | PrimaryEmailAddr | — | Not in warehouse dim |
| Phone | MobilePhone | PrimaryPhone | — | Not in warehouse dim |
| Route Permissions | CanManageRoutes | — | can_manage_routes | Boolean |
| Admin Permissions | CanManageAdminPanel | — | can_manage_admin_panel | Boolean |
| Settings Permissions | CanManageSettings | — | can_manage_settings | Boolean |
| Company | CompanyId | — | _company_name | AQPS or JOMO |

## Training Resources

- [Route Assignments and Technician Scheduling](https://help.getskimmer.com/article/119-how-time-tracking-works-app)

## Related Entities

- [Route Assignment](route-assignment-DRAFT.md) — 1:many (a technician is assigned to multiple routes)
- [Service Stop](service-stop-DRAFT.md) — 1:many (a technician completes service stops)
- [Work Order](work-order.md) — 1:many (a technician is assigned work orders)
- [Customer](customer.md) — indirect via Route Assignment and Service Location

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — Skimmer Account schema + QBO Employee + warehouse dim_tech mapping | Claude / Ross Sivertsen |
