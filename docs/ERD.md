# Skimmer Pool Service Database - Entity Relationship Diagram

**Version**: 1.0  
**Last Updated**: October 26, 2025  
**Database Type**: SQLite

---

## Full Database ERD

```mermaid
erDiagram
    Company ||--o{ Customer : "has"
    Company ||--o{ Account : "has"
    Company ||--o{ CompanySetting : "configures"
    
    Customer ||--o{ ServiceLocation : "has"
    Customer ||--o{ Invoice : "receives"
    Customer ||--o{ Payment : "makes"
    Customer ||--o{ CustomerTag : "tagged_with"
    
    ServiceLocation ||--o{ Pool : "contains"
    ServiceLocation ||--o{ RouteAssignment : "scheduled_on"
    ServiceLocation ||--o{ RouteStop : "visited_at"
    ServiceLocation ||--o{ WorkOrder : "requests"
    ServiceLocation ||--o{ InvoiceLocation : "billed_for"
    ServiceLocation ||--o{ LocationWorkOrderType : "configures"
    
    Pool ||--o{ EquipmentItem : "has"
    Pool ||--o{ ServiceStop : "serviced"
    
    EquipmentItem }o--|| PartCategory : "categorized_as"
    EquipmentItem }o--|| PartMake : "manufactured_by"
    EquipmentItem }o--|| PartModel : "model_is"
    
    PartCategory ||--o{ PartMake : "has"
    PartMake ||--o{ PartModel : "has"
    
    Account ||--o{ RouteAssignment : "assigned_to"
    Account ||--o{ RouteStop : "performs"
    Account ||--o{ WorkOrder : "handles"
    
    RouteAssignment ||--o{ RouteStop : "generates"
    RouteAssignment ||--o{ RouteSkip : "skips"
    RouteAssignment ||--o{ RouteMove : "moves"
    
    RouteStop ||--o{ ServiceStop : "includes"
    RouteStop }o--|| SkippedStopReason : "skipped_because"
    
    ServiceStop ||--o{ ServiceStopEntry : "records"
    ServiceStop ||--o{ ServiceStopCalculatorEntry : "calculates"
    ServiceStop ||--o{ InstalledItem : "installs"
    
    ServiceStopEntry }o--|| EntryDescription : "describes"
    EntryDescription ||--o{ EntryValue : "has_values"
    
    WorkOrder }o--|| WorkOrderType : "type_is"
    WorkOrder ||--o{ InstalledItem : "installs"
    WorkOrder ||--o{ ShoppingListItem : "needs"
    WorkOrder ||--o{ InvoiceItem : "billed_as"
    
    WorkOrderType ||--o{ LocationWorkOrderType : "configured_for"
    WorkOrderType ||--o{ WorkOrderTypeShoppingListItem : "defaults"
    
    InstalledItem }o--o| EquipmentItem : "replaces"
    InstalledItem }o--o| Chemical : "uses"
    InstalledItem }o--o| Product : "uses"
    
    ShoppingListItem }o--o| EquipmentItem : "for"
    ShoppingListItem }o--o| Chemical : "for"
    ShoppingListItem }o--o| Product : "for"
    
    Invoice ||--o{ InvoiceLocation : "groups_by"
    Invoice ||--o{ Payment : "paid_by"
    
    InvoiceLocation ||--o{ InvoiceItem : "contains"
    InvoiceLocation }o--|| TaxGroup : "taxed_by"
    
    InvoiceItem }o--o| RouteStop : "from"
    InvoiceItem }o--o| WorkOrder : "from"
    InvoiceItem }o--o| Product : "sells"
    InvoiceItem }o--o| EntryDescription : "charges_for"
    
    TaxGroup ||--o{ TaxGroupRate : "includes"
    TaxRate ||--o{ TaxGroupRate : "in"
    
    Tag ||--o{ CustomerTag : "tags"
    
    Product }o--|| ProductCategory : "categorized_as"
    
    Company {
        TEXT id PK
        TEXT Name
        DATETIME ActiveUntil
        JSON Accounts
    }
    
    Customer {
        TEXT id PK
        TEXT CompanyId FK
        TEXT FirstName
        TEXT LastName
        TEXT CompanyName
        BOOLEAN DisplayAsCompany
        TEXT CustomerCode
        TEXT PrimaryEmail
        BOOLEAN IsInactive
    }
    
    ServiceLocation {
        TEXT id PK
        TEXT CustomerId FK
        TEXT Address
        TEXT City
        TEXT State
        FLOAT Latitude
        FLOAT Longitude
        TEXT GateCode
        FLOAT Rate
        TEXT RateType
    }
    
    Pool {
        TEXT id PK
        TEXT ServiceLocationId FK
        TEXT Name
        INTEGER Gallons
        FLOAT BaselineFilterPressure
    }
    
    Account {
        TEXT id PK
        TEXT CompanyId FK
        TEXT Username
        TEXT Email
        TEXT FirstName
        TEXT LastName
        TEXT RoleType
        BOOLEAN IsActive
    }
    
    RouteAssignment {
        TEXT id PK
        TEXT ServiceLocationId FK
        TEXT AccountId FK
        TEXT DayOfWeek
        TEXT Frequency
        DATETIME StartDate
        DATETIME EndDate
        INTEGER Sequence
        TEXT Status
    }
    
    RouteStop {
        TEXT id PK
        TEXT AccountId FK
        TEXT ServiceLocationId FK
        TEXT RouteAssignmentId FK
        DATETIME ServiceDate
        DATETIME StartTime
        DATETIME CompleteTime
        BOOLEAN IsSkipped
        INTEGER Sequence
    }
    
    ServiceStop {
        TEXT id PK
        TEXT RouteStopId FK
        TEXT PoolId FK
        DATETIME ServiceDate
        TEXT Notes
        TEXT NotesToCustomer
        BOOLEAN NoteIsAlert
    }
    
    ServiceStopEntry {
        TEXT id PK
        TEXT ServiceStopId FK
        TEXT PoolId FK
        TEXT EntryDescriptionId FK
        TEXT EntryType
        FLOAT Value
        DATETIME ServiceDate
    }
    
    WorkOrder {
        TEXT id PK
        TEXT WorkOrderTypeId FK
        TEXT ServiceLocationId FK
        TEXT AccountId FK
        DATETIME ServiceDate
        DATETIME StartTime
        DATETIME CompleteTime
        FLOAT LaborCost
        FLOAT Price
        BOOLEAN IsInvoiced
    }
    
    InstalledItem {
        TEXT id PK
        TEXT ServiceStopId FK
        TEXT WorkOrderId FK
        TEXT EquipmentItemId FK
        TEXT ChemicalId FK
        TEXT ProductId FK
        TEXT ItemType
        FLOAT Quantity
        FLOAT Price
    }
    
    Invoice {
        TEXT id PK
        TEXT CustomerId FK
        INTEGER InvoiceNumber
        DATETIME InvoiceDate
        DATETIME DueDate
        REAL Total
        REAL AmountDue
        TEXT Status
        TEXT PaymentStatus
    }
    
    InvoiceItem {
        TEXT id PK
        TEXT InvoiceLocationId FK
        TEXT Item
        REAL Quantity
        REAL Rate
        REAL Amount
        BOOLEAN IsTaxable
    }
    
    Payment {
        TEXT id PK
        TEXT CustomerId FK
        TEXT InvoiceId FK
        DATETIME PaymentDate
        TEXT PaymentType
        TEXT Status
        REAL Amount
    }
```

---

## Core Business Flow Diagram

```mermaid
graph TD
    A[Company] --> B[Customer]
    B --> C[ServiceLocation]
    C --> D[Pool]
    
    C --> E[RouteAssignment]
    E --> F[RouteStop]
    F --> G[ServiceStop]
    G --> H[ServiceStopEntry]
    
    C --> I[WorkOrder]
    I --> J[InstalledItem]
    
    F --> K[InvoiceItem]
    I --> K
    J --> K
    
    K --> L[InvoiceLocation]
    L --> M[Invoice]
    M --> N[Payment]
    
    style A fill:#e1f5ff
    style B fill:#fff4e1
    style C fill:#e8f5e9
    style D fill:#f3e5f5
    style M fill:#ffe0e0
    style N fill:#e0ffe0
```

---

## Scheduling & Routing Flow

```mermaid
graph LR
    A[Account<br/>Technician] --> B[RouteAssignment<br/>Regular Schedule]
    C[ServiceLocation<br/>Customer Address] --> B
    
    B --> D[RouteStop<br/>Daily Visit]
    B -.skip.-> E[RouteSkip<br/>Vacation/Holiday]
    B -.move.-> F[RouteMove<br/>One-time Change]
    
    D --> G[ServiceStop<br/>Per Pool Service]
    G --> H[ServiceStopEntry<br/>Readings/Chemicals]
    
    style A fill:#bbdefb
    style B fill:#c8e6c9
    style D fill:#fff9c4
    style G fill:#ffccbc
```

---

## Revenue Generation Flow

```mermaid
graph TD
    A[ServiceStop<br/>Regular Service] --> D[InvoiceItem]
    B[WorkOrder<br/>Repair/Maintenance] --> D
    C[InstalledItem<br/>Parts/Products] --> D
    
    D --> E[InvoiceLocation<br/>By Location]
    E --> F[Invoice<br/>Customer Bill]
    
    F --> G{Payment<br/>Status}
    G -->|Paid| H[Revenue]
    G -->|Unpaid| I[A/R]
    G -->|Failed| J[Collections]
    
    style A fill:#e3f2fd
    style B fill:#f3e5f5
    style C fill:#fff3e0
    style F fill:#ffebee
    style H fill:#c8e6c9
    style I fill:#fff9c4
    style J fill:#ffcdd2
```

---

## Equipment Management Flow

```mermaid
graph TD
    A[Pool] --> B[EquipmentItem<br/>Inventory]
    B --> C[PartCategory<br/>Type]
    C --> D[PartMake<br/>Manufacturer]
    D --> E[PartModel<br/>Model]
    
    B --> F{Needs<br/>Service?}
    F -->|Yes| G[ShoppingListItem<br/>Parts Needed]
    F -->|No| H[Regular Service]
    
    G --> I[WorkOrder<br/>Repair Job]
    I --> J[InstalledItem<br/>Part Installed]
    J --> K[InvoiceItem<br/>Billed]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style G fill:#fff9c4
    style I fill:#ffe0b2
    style J fill:#c8e6c9
```

---

## Key Relationship Patterns

### 1. Customer Journey
```
Company → Customer → ServiceLocation → Pool
                                    → RouteAssignment
                                    → Invoice
```

### 2. Service Execution
```
Account (Tech) + RouteAssignment → RouteStop → ServiceStop → ServiceStopEntry
```

### 3. Work Order Lifecycle
```
ServiceLocation → WorkOrder → ShoppingListItem → InstalledItem → InvoiceItem
```

### 4. Revenue Chain
```
ServiceStop/WorkOrder → InvoiceItem → InvoiceLocation → Invoice → Payment
```

### 5. Equipment Tracking
```
Pool → EquipmentItem → ShoppingListItem → InstalledItem
    ↓                       ↓                  ↓
PartCategory            WorkOrder         InvoiceItem
```

---

## Table Relationship Density

### High Connectivity (Hub Tables)
- **ServiceLocation**: 7 direct relationships
- **Invoice**: 5 direct relationships  
- **WorkOrder**: 6 direct relationships
- **Pool**: 4 direct relationships

### Junction Tables (Many-to-Many)
- **CustomerTag**: Customer ↔ Tag
- **TaxGroupRate**: TaxGroup ↔ TaxRate
- **InvoiceLocation**: Invoice ↔ ServiceLocation

### Reference Tables (Lookup)
- PartCategory, PartMake, PartModel
- WorkOrderType, EntryDescription
- Chemical, Product, ProductCategory
- Tag, TaxGroup, TaxRate
- SkippedStopReason

---

## Critical Join Paths

### Path 1: Customer to Revenue
```sql
Customer 
  → ServiceLocation 
  → InvoiceLocation 
  → Invoice 
  → Payment
```

### Path 2: Technician Performance
```sql
Account 
  → RouteStop 
  → ServiceStop 
  → ServiceStopEntry
```

### Path 3: Equipment to Billing
```sql
Pool 
  → EquipmentItem 
  → InstalledItem 
  → InvoiceItem 
  → Invoice
```

### Path 4: Service to Invoice
```sql
RouteStop 
  → ServiceStop 
  → ServiceStopEntry 
  → InvoiceItem 
  → Invoice
```

### Path 5: Work Order to Revenue
```sql
WorkOrder 
  → InstalledItem 
  → InvoiceItem 
  → Invoice 
  → Payment
```

---

## Cardinality Summary

| Relationship Type | Count | Examples |
|------------------|-------|----------|
| One-to-Many | 60+ | Customer → ServiceLocation, Pool → EquipmentItem |
| Many-to-One | 60+ | RouteStop → Account, Invoice → Customer |
| Many-to-Many | 3 | Customer ↔ Tag, TaxGroup ↔ TaxRate |
| One-to-One | 2 | RouteMove → RouteStop, ShoppingListItem → InstalledItem |

---

## Foreign Key Enforcement

**Note**: SQLite foreign keys are NOT enforced at the database level in this schema. Application-level enforcement is critical.

### Required Foreign Keys (NOT NULL)
- All `CompanyId` columns (multi-tenancy)
- `Customer.CompanyId`
- `ServiceLocation.CustomerId`
- `Pool.ServiceLocationId`
- `RouteStop.ServiceLocationId`, `AccountId`

### Optional Foreign Keys (Nullable)
- `RouteStop.SkippedStopReasonId` (only if skipped)
- `InvoiceItem.WorkOrderId` (only for work order items)
- `InstalledItem.EquipmentItemId` (only for equipment)

---

## Database Design Patterns

### 1. Soft Deletes
Many tables use `Deleted` or `SoftDeleted` boolean flags:
- Preserves historical data
- Maintains referential integrity
- Enables audit trails

### 2. Denormalization
JSON fields cache related data for performance:
- `Customer.ServiceLocations`
- `ServiceLocation.Pools`
- `Pool.EquipmentItems`
- `RouteStop.ServiceStops`

### 3. Polymorphic Relationships
`InvoiceItem` can link to multiple source types:
- `RouteStopId` (regular service)
- `WorkOrderId` (repair work)
- `ProductId` (product sales)
- `EntryDescriptionId` (chemical/reading charges)

### 4. Audit Fields
Standard on all tables:
- `CreatedAt` - When record was created
- `UpdatedAt` - When record was last modified
- `Version` - Optimistic locking (BLOB)

---

## Query Optimization Hints

### Indexes Recommended
```sql
-- Critical join columns
CREATE INDEX idx_customer_companyid ON Customer(CompanyId);
CREATE INDEX idx_servicelocation_customerid ON ServiceLocation(CustomerId);
CREATE INDEX idx_routestop_accountid ON RouteStop(AccountId);
CREATE INDEX idx_routestop_servicedate ON RouteStop(ServiceDate);
CREATE INDEX idx_invoice_customerid ON Invoice(CustomerId);
CREATE INDEX idx_invoice_invoicedate ON Invoice(InvoiceDate);

-- Composite indexes for common queries
CREATE INDEX idx_routestop_date_account ON RouteStop(ServiceDate, AccountId);
CREATE INDEX idx_servicestopentry_pool_date ON ServiceStopEntry(PoolId, ServiceDate);
```

### Multi-Table Query Tips
1. **Always filter by CompanyId first**
2. **Use explicit JOIN syntax** (not implicit WHERE joins)
3. **Join in order of relationship** (Company → Customer → Location → Pool)
4. **Limit JSON field access** (use normalized tables for queries)
5. **Use CTEs for complex multi-step queries**

---

**End of ERD Documentation**
