# Enterprise Entity Map

**Purpose:** One-page visual ontology of Splashworks canonical business entities, grouped by domain and color-coded by System of Record.

**Last updated:** 2026-05-23

---

## Legend

**Color — System of Record**

| Swatch | System | Role |
|---|---|---|
| 🟦 Blue | Skimmer | Service operations |
| 🟪 Purple | QBO Advanced | Financial (invoicing, payments, QOH) |
| 🟩 Green | Zoho CRM | Sales / leads |
| 🟨 Yellow | Data Warehouse | Derived / analytics-only (no origin data) |
| ⬜ Gray (dashed) | SoR TBD | Open governance question |

**Status markers**

- *(no marker)* — Finalized glossary entry
- **(D)** — DRAFT, under review
- **(P)** — PROPOSED, not yet drafted

---

## Entity Map

```mermaid
flowchart TB
    classDef skimmer fill:#cfe2ff,stroke:#1e40af,color:#000
    classDef qbo fill:#e9d5ff,stroke:#7c3aed,color:#000
    classDef zoho fill:#d1fae5,stroke:#059669,color:#000
    classDef warehouse fill:#fef3c7,stroke:#d97706,color:#000
    classDef tbd fill:#f3f4f6,stroke:#6b7280,color:#000,stroke-dasharray: 5 5

    subgraph org[" 🏢 Org & Geography "]
        BRAND["Brand<br/><i>(D)</i>"]
        BRANCH["Branch<br/><i>(D)</i>"]
    end

    subgraph people[" 🧑 People "]
        CUST[Customer]
        CONT[Contact]
        STAFF["Staff / Technician<br/><i>(P)</i>"]
        TEAM["Team<br/><i>(P)</i>"]
        COMP["Company<br/><i>(D)</i>"]
    end

    subgraph places[" 📍 Places "]
        SVCLOC[Service Location]
        POOL[Pool]
    end

    subgraph assets[" 📦 Assets "]
        PROD[Product]
        QOH["QOH<br/><i>(P)</i>"]
        VEH["Vehicle<br/><i>(P)</i>"]
        EQ["Equipment<br/><i>(D)</i>"]
    end

    subgraph work[" 🔧 Work & Services "]
        WO[Work Order]
        SS["Service Stop<br/><i>(D)</i>"]
        CR["Chemical Reading<br/><i>(D)</i>"]
        SC["Service Checklist<br/><i>(P)</i>"]
        RA["Route Assignment<br/><i>(D)</i>"]
        RS["Route Stop<br/><i>(D)</i>"]
    end

    subgraph fin[" 💰 Financial "]
        INV[Invoice]
        PAY[Payment]
        QT["Quote<br/><i>(D)</i>"]
        TAX["Tax Config<br/><i>(D)</i>"]
    end

    subgraph classification[" 🏷️ Classification "]
        TAG["Tag<br/><i>(D)</i>"]
        CSEG["Customer Segment<br/><i>(P)</i>"]
        PCAT["Product Category<br/><i>(P)</i>"]
        ACOH["Acquisition Cohort<br/><i>(D)</i>"]
    end

    %% Org & Geography relationships
    BRAND --> BRANCH
    BRAND --> CUST
    BRANCH --> SVCLOC

    %% Core structural relationships
    CUST --> CONT
    CUST --> SVCLOC
    SVCLOC --> POOL
    CUST --> WO
    CUST --> INV
    INV --> PAY
    POOL --> SS
    SS --> CR
    SS --> SC
    STAFF --> SS
    TEAM --> STAFF
    TEAM --> RA
    RA --> RS
    SVCLOC --> RS
    PROD --> QOH
    WO --> PROD
    SS --> PROD
    INV --> TAX

    %% Cross-cutting / classification
    PROD -.-> PCAT
    CUST -.-> CSEG
    CUST -.-> TAG
    CUST -.-> ACOH
    ACOH -.-> TAG
    SVCLOC -.-> TAG
    POOL -.-> TAG
    STAFF -.-> VEH

    %% System-of-Record coloring
    class CUST,CONT,SVCLOC,POOL,STAFF,TEAM,COMP,PROD,EQ,WO,SS,CR,SC,RA,RS,QT,TAG,PCAT,ACOH skimmer
    class QOH,INV,PAY,TAX qbo
    class BRAND,BRANCH warehouse
    class VEH,CSEG tbd
```

---

## Open System-of-Record questions

| Entity | Candidates | Notes |
|---|---|---|
| **Vehicle** | QBO (fixed asset) / future fleet-mgmt tool / inventory-app (current custodian) | No real IMS today. Inventory-app holds operational data (VIN, plate, lease, division) but isn't authoritative. |
| **Customer Segment** | Zoho (origin at sales) / Skimmer (ops persistence) | Drives pricing and routing — needs one SoR. |
| **Product Category** | per classification-governance standard | Resolved by `standards/classification-governance.md` (in progress). |
| **Tax Configuration** | QBO (assumed) | Confirm during DRAFT finalization. |

---

## Key relationships — in plain English

- A **Brand** (JOMO, Splashworks) groups one or more **Branches** and owns **Customers**.
- A **Branch** is a geographic territory (Jacksonville for JOMO; Spring Hill or Ocala for Splashworks). It contains **Service Locations**. Branch is derived from `billing_zip` + `billing_city`.
- A **Customer** has one or more **Contacts**, **Service Locations**, and **Invoices**.
- A **Service Location** has one or more **Pools**.
- A **Pool** receives **Service Stops**, each of which records **Chemical Readings** and completes a **Service Checklist**.
- A **Service Stop** is performed by one **Staff** member and consumes **Products**.
- **Staff** belong to **Teams**. Teams are assigned to **Route Assignments**, which schedule **Route Stops** at Service Locations.
- **Work Orders** are ad-hoc (not recurring) requests against a Customer; they also consume **Products**.
- **Invoices** receive **Payments** and apply **Tax Configuration**.
- **Products** have a point-in-time **QOH** (stock level, per location).
- **Classification** (Tag, Customer Segment, Product Category, Acquisition Cohort) applies cross-cuttingly — shown as dashed.
- **Acquisition Cohort** is implemented via **Tag** — a customer is "in" a cohort when they carry the cohort's named Tag and match the cohort's computation mode (recent / legacy / route_before_tag).

---

## Related docs

- [System Landscape](system-landscape.md) — systems and data flows (complementary view)
- [enterprise-index.yaml](enterprise-index.yaml) — machine-readable entity manifest
- [README.md](README.md) — EIA overview and contribution guide
