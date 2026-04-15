# Chemical Reading

> **Status:** DRAFT — pending review before release

## Definition

An individual measurement or dosage record captured during a pool service visit. Chemical readings track water chemistry (pH, chlorine, alkalinity, CYA, etc.), equipment condition (filter pressure), and chemicals applied (dosages). They are the raw data behind water quality analysis, chemical spend tracking, and equipment health monitoring. Skimmer calls this "ServiceStopEntry" — the glossary uses "Chemical Reading" because that's what the business cares about.

## System of Record

**Primary:** Skimmer
**Rationale:** Chemical readings are captured exclusively by technicians via the Skimmer mobile app during service stops. No other system records pool chemistry data. The data warehouse stages readings for trend analysis and dosage cost calculations.

## Synonyms

| Term | System | Context |
|------|--------|---------|
| ServiceStopEntry | Skimmer | Database entity — each row is one reading or dosage |
| Reading | Skimmer UI | Water chemistry measurements (pH, chlorine, etc.) |
| Dosage | Skimmer UI | Chemicals added during service (chlorine, acid, etc.) |
| Observation | Skimmer | Non-numeric entries (e.g., water clarity, algae presence) |
| EntryDescription | Skimmer | Template defining what can be recorded (e.g., "Free Chlorine", "pH") |
| EntryValue | Skimmer | Preset value options for dropdown-style entries |
| stg_service_stop_entry | Data Warehouse | Staging model |
| dim_chemical | Data Warehouse | Dimension for chemical/entry descriptions |
| fact_dosage | Data Warehouse | Fact table for chemical dosage amounts |
| — | QuickBooks Online | No equivalent |
| — | Zoho CRM | No equivalent |

## Naming Convention

**Standard format:** Readings are identified by entry description + pool + date.

**Rules:**
- `EntryDescription.Description` defines the reading type (e.g., "Free Chlorine", "pH", "Filter Pressure")
- `EntryType` categorizes: Reading, Dosage, Observation
- `UnitOfMeasure` varies by type: ppm, oz, lbs, PSI, °F
- `ReadingType` provides a secondary classification: Chemical, Equipment, etc.

## Common Reading Types

| Entry Description | Entry Type | Unit | Typical Range | Business Significance |
|-------------------|-----------|------|---------------|----------------------|
| Free Chlorine | Reading | ppm | 1.0–4.0 | Primary sanitizer level |
| Total Chlorine | Reading | ppm | 1.0–4.0 | Combined + free chlorine |
| pH | Reading | — | 7.2–7.8 | Water balance |
| Alkalinity | Reading | ppm | 80–120 | pH stability buffer |
| CYA (Cyanuric Acid) | Reading | ppm | 30–50 | Chlorine stabilizer |
| Calcium Hardness | Reading | ppm | 200–400 | Surface protection |
| TDS (Total Dissolved Solids) | Reading | ppm | < 3000 | Water freshness indicator |
| Phosphates | Reading | ppb | < 500 | Algae nutrient indicator |
| Salt | Reading | ppm | 2700–3400 | Salt system pools only |
| Water Temperature | Reading | °F | varies | Affects chemical demand |
| Filter Pressure | Reading | PSI | varies | Equipment health (compare to baseline) |
| Liquid Chlorine | Dosage | oz/lbs | varies | Chemical applied |
| Muriatic Acid | Dosage | oz | varies | pH reduction chemical |

## Identifiers

| System | Field | Format | Example |
|--------|-------|--------|---------|
| Skimmer (Entry) | ServiceStopEntry.id | UUID | `d4e5f6a7b8c9...` |
| Skimmer (Description) | EntryDescription.id | UUID | `a1b2c3d4e5f6...` |
| Data Warehouse | — | — | Staged but not assigned surrogate keys |

## Key Business Rules

- **One entry per reading type per stop:** A single service stop can have multiple entries (pH reading, chlorine reading, acid dosage, etc.) but should not duplicate the same reading type.
- **Value is always numeric:** Stored as FLOAT. Non-numeric observations use `SelectedIndex` to map to preset values.
- **Dosage cost calculation:** The warehouse `fact_dosage` model calculates cost per dosage by joining entry amounts to chemical pricing. This powers the `semantic_profit` model (profit = rate - labor - dosage cost).
- **LSI calculation:** The Langelier Saturation Index can be calculated from pH, alkalinity, calcium hardness, TDS, and water temperature readings. This is on the backlog (DX-2).
- **Filter pressure monitoring:** Current filter PSI compared to `Pool.BaselineFilterPressure` indicates when filter cleaning is needed. Delta > 8-10 PSI typically triggers a filter clean work order.
- **EntryDescription is company-configurable:** Each company can define which readings are collected and in what order. `Sequence` controls display order on the tech's mobile screen.

## Data Flow

```
Skimmer (Tech opens service stop on mobile app)
    │
    ├── Tech records readings (pH, chlorine, etc.)
    │   └── ServiceStopEntry created per reading
    │
    ├── Tech records dosages (chemicals added)
    │   └── ServiceStopEntry created per dosage
    │
    ├── Calculator entries (recommended dosage based on readings + gallons)
    │   └── ServiceStopCalculatorEntry records
    │
    └── Nightly SQLite Extract
        └── Data Warehouse
            ├── public_staging.stg_service_stop_entry (raw readings/dosages)
            ├── public_staging.stg_entry_description (reading type definitions)
            ├── public_warehouse.dim_chemical (chemical/entry dimension)
            ├── public_warehouse.fact_dosage (dosage amounts per stop)
            └── public_warehouse.fact_dosage_gallons (dosage normalized by pool volume)
```

## Field Mapping

| Canonical Field | Skimmer (ServiceStopEntry) | Skimmer (EntryDescription) | Warehouse | Notes |
|----------------|---------------------------|---------------------------|-----------|-------|
| Entry ID | id | — | — | UUID primary key |
| Service Stop | ServiceStopId | — | — | FK to ServiceStop |
| Pool | PoolId | — | — | FK to Pool |
| Description ID | EntryDescriptionId | id | — | FK to reading type template |
| Description Text | EntryDescriptionText | Description | — | Denormalized name |
| Entry Type | EntryType | EntryType | — | Reading, Dosage, Observation |
| Value | Value | — | — | Numeric measurement |
| Unit | UnitOfMeasure | UnitOfMeasure | — | ppm, oz, lbs, PSI, °F |
| Reading Type | ReadingType | — | — | Chemical, Equipment, etc. |
| Sequence | Sequence | Sequence | — | Display order |
| Service Date | ServiceDate | — | — | Date recorded |
| Company | CompanyId | CompanyId | — | AQPS or JOMO |

## Key Query Patterns

**pH trend for a pool:**
```sql
SELECT sse.service_date, sse.value as ph_value
FROM public_staging.stg_service_stop_entry sse
JOIN public_staging.stg_entry_description ed ON sse.entry_description_id = ed.entry_description_id
WHERE sse.pool_id = '<pool_id>'
  AND ed.description LIKE '%pH%'
ORDER BY sse.service_date;
```

**Chemical usage by type (last 30 days):**
```sql
SELECT ed.description, SUM(sse.value) as total_used, ed.unit_of_measure
FROM public_staging.stg_service_stop_entry sse
JOIN public_staging.stg_entry_description ed ON sse.entry_description_id = ed.entry_description_id
WHERE ed.entry_type = 'Dosage'
  AND sse.service_date >= '<start_date>'
GROUP BY ed.description, ed.unit_of_measure
ORDER BY total_used DESC;
```

## Training Resources

- [Skimmer Chemical Spend Calculator](https://docs.google.com/spreadsheets/d/1TemXbDK7OMvU1RnOxBT5wt-HnnsvHNWmVf05q0c1-jo/copy)
- [Learn Orenda's LSI Method in Skimmer](https://drive.google.com/file/d/1a5f1Q8mH9x9DHYgZjq57vA0YBHYjxAMt/edit)

## Related Entities

- [Service Stop](service-stop-DRAFT.md) — many:1 (each reading belongs to one service stop)
- [Pool](pool.md) — many:1 (each reading is for a specific pool)
- [Product](product.md) — linked via dosage entries (chemical products applied)
- [Work Order](work-order.md) — optional link (readings taken during work order execution)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | Initial draft — ServiceStopEntry + EntryDescription schema, warehouse dosage models, common reading types | Claude / Ross Sivertsen |
