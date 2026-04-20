# Data Flow Diagrams

**Purpose:** How data moves between systems for key Splashworks business processes.

**Last updated:** 2026-04-20

---

## 1. Service-to-Cash

Core revenue cycle. Customer acquisition through payment receipt, with warehouse consumption for analytics.

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant Z as Zoho CRM
    participant S as Skimmer
    participant Q as QBO
    participant W as Data Warehouse

    Note over Z,S: Lead → Customer (if sales-originated)
    Z->>S: Customer record (manual review, POC)
    Note over S: Customer active — service locations, pools, route assignment

    C->>S: Recurring service or ad-hoc work order
    S->>S: Route Assignment schedules Service Stop
    S->>S: Tech performs stop — chemical readings, checklist, product dosage
    Note over S: Dosage decrements implicit QBO QOH (via QBO sync)

    rect rgb(243, 232, 255)
        Note over S,Q: Monthly billing cycle
        S->>Q: Invoice (native sync)
        Q->>C: Invoice delivered
        C->>Q: Payment received
        Q->>S: Payment (native sync)
    end

    rect rgb(254, 243, 199)
        Note over S,W: Nightly analytics sync
        S->>W: SQLite extract (OneDrive) 01:15 UTC
        W->>W: ETL + dbt (staging → warehouse → semantic)
    end
```

**Key handoffs:**

| # | Step | From | To | Failure mode |
|---|---|---|---|---|
| 1 | Lead conversion | Zoho | Skimmer | Manual review backlog |
| 5 | Dosage → QOH | Skimmer | QBO | Silent drift if sync fails |
| 7 | Invoice sync | Skimmer | QBO | QBO returns error, Skimmer retries |
| 10 | Payment sync back | QBO | Skimmer | Customer shows unpaid in Skimmer |
| 11 | Nightly extract | Skimmer (SQLite) | Warehouse | Schema drift (observed 2026-04-14) |

---

## 2. Inventory Reconciliation

Physical count via inventory-app reconciles against QBO (QOH system of record).

```mermaid
flowchart LR
    classDef sor fill:#e9d5ff,stroke:#7c3aed,color:#000
    classDef tool fill:#fed7aa,stroke:#c2410c,color:#000
    classDef human fill:#ddd6fe,stroke:#5b21b6,color:#000
    classDef event fill:#fee2e2,stroke:#b91c1c,color:#000

    QBO[(QBO<br/><b>QOH: SoR</b>)]:::sor
    INV[Jomo Inventory App<br/>Physical Count]:::tool
    TEAM[Counter / Team]:::human
    VAR{Variance?}
    ADJ[QBO Adjustment Entry]:::event

    subgraph DRIVERS[" Consumers / Producers "]
        direction TB
        WO[Work Order] -->|consumes| QBO
        SS[Service Stop] -->|dosage consumes| QBO
        RCV[Receiving] -->|increases| QBO
    end

    QBO -.->|baseline expected QOH| INV
    TEAM -->|scan SKU / enter quantity| INV
    INV -->|compare: expected vs actual| VAR
    VAR -->|&gt; threshold| ADJ
    VAR -->|within tolerance| OK[No action]
    ADJ -->|update QOH| QBO
```

**Current gap:** Skimmer's work-order commitments don't currently check QBO QOH — tech can commit stock that doesn't exist. Reconciliation catches this after the fact, not before.

---

## 3. Lead-to-Customer

Sales intake through operational activation.

```mermaid
flowchart LR
    classDef zoho fill:#d1fae5,stroke:#059669,color:#000
    classDef skimmer fill:#cfe2ff,stroke:#1e40af,color:#000
    classDef human fill:#ddd6fe,stroke:#5b21b6,color:#000

    LEAD[New Lead]:::zoho
    QUAL[Sales Qualification]:::human
    QUOTE[Quote Prepared]:::zoho
    ACC[Accepted?]
    CUST_Z[Customer in Zoho]:::zoho
    REVIEW[Manual Review]:::human
    CUST_S[Customer in Skimmer]:::skimmer
    SL[Service Location + Pool]:::skimmer
    RA[Route Assignment]:::skimmer

    LEAD --> QUAL --> QUOTE --> ACC
    ACC -->|No| LOST[Lost - archived]:::zoho
    ACC -->|Yes| CUST_Z
    CUST_Z --> REVIEW
    REVIEW -->|Approved| CUST_S
    CUST_S --> SL --> RA
```

---

## 4. Skimmer → Warehouse → AI Query

Nightly analytics path.

```mermaid
flowchart LR
    classDef skimmer fill:#cfe2ff,stroke:#1e40af,color:#000
    classDef infra fill:#fef3c7,stroke:#d97706,color:#000
    classDef app fill:#fee2e2,stroke:#b91c1c,color:#000

    SK[(Skimmer SQLite<br/>AQPS.db + JOMO.db)]:::skimmer
    OD[(OneDrive Sync)]:::infra
    ETL[Python ETL<br/>etl/ package]:::infra
    RAW[(Postgres raw schema)]:::infra
    DBT[dbt<br/>staging → warehouse → semantic]:::infra
    DW[(Postgres DW<br/>public_warehouse + public_semantic)]:::infra
    API[FastAPI<br/>api.splshwrks.com]:::app
    AI[Claude Sonnet<br/>SQL gen]:::app
    UI[React SPA<br/>app.splshwrks.com]:::app
    MB[Metabase<br/>bi.splshwrks.com]:::app

    SK -->|nightly export| OD
    OD -->|rclone sync| ETL
    ETL -->|checksum + COPY| RAW
    RAW --> DBT
    DBT --> DW
    DW --> API
    DW --> MB
    API --> AI
    AI --> API
    API --> UI
```

---

## Related

- [Entity Map](entity-map.md) — the nouns
- [System Landscape](system-landscape.md) — the topology
- [State Diagrams](state-diagrams.md) — the lifecycles
