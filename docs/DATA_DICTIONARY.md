# Skimmer Pool Service Database - Data Dictionary

**Version**: 1.1
**Last Updated**: March 26, 2026
**Database Type**: SQLite
**Purpose**: Pool service management, scheduling, billing, and operations tracking
**Tables**: 44 per company database (AQPS, JOMO)

---

## Table of Contents
- [Skimmer Pool Service Database - Data Dictionary](#skimmer-pool-service-database---data-dictionary)
  - [Table of Contents](#table-of-contents)
  - [Core Business Entities](#core-business-entities)
    - [Company](#company)
    - [Customer](#customer)
    - [ServiceLocation](#servicelocation)
    - [Pool](#pool)
    - [Account](#account)
  - [Scheduling \& Routing](#scheduling--routing)
    - [RouteAssignment](#routeassignment)
    - [RouteStop](#routestop)
    - [RouteMove](#routemove)
    - [RouteSkip](#routeskip)
  - [Service Operations](#service-operations)
    - [ServiceStop](#servicestop)
    - [ServiceStopEntry](#servicestopentry)
    - [WorkOrder](#workorder)
  - [Billing \& Payments](#billing--payments)
    - [Invoice](#invoice)
    - [InvoiceItem](#invoiceitem)
    - [Payment](#payment)
  - [Equipment \& Parts](#equipment--parts)
    - [EquipmentItem](#equipmentitem)
    - [PartCategory](#partcategory)
    - [PartMake](#partmake)
    - [PartModel](#partmodel)
    - [InstalledItem](#installeditem)
    - [ShoppingListItem](#shoppinglistitem)
  - [Products \& Chemicals](#products--chemicals)
    - [Product](#product)
    - [ProductCategory](#productcategory)
    - [Chemical](#chemical)
    - [EntryDescription](#entrydescription)
    - [EntryValue](#entryvalue)
  - [Quotes \& Proposals](#quotes--proposals)
    - [Quote](#quote)
    - [QuoteLocation](#quotelocation)
    - [QuoteItem](#quoteitem)
    - [QuoteAttachment](#quoteattachment)
    - [QuoteTag](#quotetag)
  - [System \& Configuration](#system--configuration)
    - [WorkOrderType](#workordertype)
    - [LocationWorkOrderType](#locationworkordertype)
    - [CompanySetting](#companysetting)
    - [Tag](#tag)
    - [CustomerTag](#customertag)
    - [TaxGroup](#taxgroup)
    - [TaxRate](#taxrate)
    - [TaxGroupRate](#taxgrouprate)
    - [InvoiceLocation](#invoicelocation)
    - [SkippedStopReason](#skippedstopreason)
    - [CompanyAddress](#companyaddress)
    - [ServiceStopCalculatorEntry](#servicestopcalculatorentry)
    - [WorkOrderTypeShoppingListItem](#workordertypeshoppinglistitem)
  - [Relationship Summary](#relationship-summary)
    - [Core Business Flow](#core-business-flow)
    - [Key Relationship Patterns](#key-relationship-patterns)
    - [Foreign Key Reference Guide](#foreign-key-reference-guide)
    - [Critical Business Queries](#critical-business-queries)
  - [Usage Notes](#usage-notes)
    - [Data Integrity Rules](#data-integrity-rules)
    - [Denormalization Strategy](#denormalization-strategy)
    - [Query Optimization Tips](#query-optimization-tips)
    - [Common AI Query Patterns](#common-ai-query-patterns)

---

## Core Business Entities

### Company
**Purpose**: Root entity representing the pool service business organization

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique company identifier | Primary Key |
| Name | TEXT | Company business name | Required |
| ActiveUntil | DATETIME | Subscription expiration | Determines access |
| Accounts | JSON | Related technician accounts | Denormalized for performance |
| CreatedAt | DATETIME | Record creation timestamp | Auto-generated |
| UpdatedAt | DATETIME | Last modification timestamp | Auto-updated |
| Deleted | BOOLEAN | Soft delete flag | For audit trail |

**Relationships**:
- **1:Many** → Account (technicians)
- **1:Many** → Customer
- **1:Many** → ServiceLocation
- **1:Many** → All other business entities (via CompanyId)

**Common Queries**:
```sql
-- Get company with active accounts
SELECT * FROM Company c 
LEFT JOIN Account a ON c.id = a.CompanyId 
WHERE a.IsActive = 1;
```

---

### Customer
**Purpose**: Pool service customers (residential or commercial)

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique customer identifier | Primary Key |
| FirstName | TEXT | Customer first name | For individuals |
| LastName | TEXT | Customer last name | For individuals |
| CompanyName | TEXT | Business name | For commercial |
| DisplayAsCompany | BOOLEAN | Show as business vs individual | Affects display |
| CustomerCode | TEXT | Custom reference code | Optional, unique |
| MobilePhone | TEXT | Primary mobile number | |
| MobilePhone2 | TEXT | Secondary mobile number | |
| PrimaryEmail | TEXT | Main email address | For invoicing |
| SecondaryEmail | TEXT | Alternate email | |
| BillingAddress | TEXT | Billing street address | |
| BillingCity | TEXT | Billing city | |
| BillingState | TEXT | Billing state/province | |
| BillingZip | TEXT | Billing postal code | |
| QboCustomerId | TEXT | QuickBooks customer ID | For accounting integration |
| IsInactive | BOOLEAN | Customer status | Affects scheduling |
| Notes | TEXT | General customer notes | |
| Tags | JSON | Customer tags | Denormalized for search |
| ServiceLocations | JSON | Related service addresses | Denormalized |
| CompanyId | TEXT | Company reference | Foreign Key to Company |

**Relationships**:
- **Many:1** → Company
- **1:Many** → ServiceLocation (service addresses)
- **Many:Many** → Tag (via CustomerTag)
- **1:Many** → Invoice
- **1:Many** → Payment

**Key Business Rules**:
- A customer can have multiple service locations
- DisplayAsCompany determines name formatting
- IsInactive customers don't appear in active routes

**Common Queries**:
```sql
-- Active customers with service locations
SELECT c.*, COUNT(sl.id) as location_count
FROM Customer c
LEFT JOIN ServiceLocation sl ON c.id = sl.CustomerId
WHERE c.IsInactive = 0 AND c.CompanyId = ?
GROUP BY c.id;

-- Customers by revenue (last 12 months)
SELECT c.*, SUM(i.Total) as total_revenue
FROM Customer c
LEFT JOIN Invoice i ON c.id = i.CustomerId
WHERE i.InvoiceDate >= date('now', '-12 months')
GROUP BY c.id
ORDER BY total_revenue DESC;
```

---

### ServiceLocation
**Purpose**: Physical addresses where pool service is performed

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique location identifier | Primary Key |
| CustomerId | TEXT | Owner customer | Foreign Key to Customer |
| Address | TEXT | Street address | Required |
| City | TEXT | City | Required |
| State | TEXT | State/province | Required |
| Zip | TEXT | Postal code | |
| LocationCode | TEXT | Custom location code | Optional reference |
| Latitude | FLOAT | GPS latitude | For routing |
| Longitude | FLOAT | GPS longitude | For routing |
| MinutesAtStop | INTEGER | Time allocation per visit | Default from CompanySetting |
| IsBadAddress | BOOLEAN | GPS/routing issue flag | |
| GateCode | TEXT | Access code | Technician reference |
| DogsName | TEXT | Pet information | Safety note |
| Notes | TEXT | Location-specific notes | |
| Rate | FLOAT | Service rate | Location-specific pricing |
| RateType | TEXT | Billing type | Per visit/monthly/etc |
| LaborCost | FLOAT | Cost per service | For profitability |
| LaborCostType | TEXT | Cost calculation type | |
| Pools | JSON | Related pools | Denormalized |
| RouteAssignments | JSON | Scheduled routes | Denormalized |
| RouteMoves | JSON | One-time route changes | Denormalized |
| WorkOrderModels | JSON | Work order templates | Denormalized |
| RecurringWorkItems | JSON | Recurring work | Denormalized |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → Customer (owner)
- **1:Many** → Pool (bodies of water at location)
- **1:Many** → RouteAssignment (regular schedule)
- **1:Many** → RouteMove (schedule changes)
- **1:Many** → RouteStop (actual visits)
- **1:Many** → WorkOrder (repair/maintenance work)
- **1:Many** → LocationWorkOrderType (recurring work config)

**Key Business Rules**:
- Each location belongs to one customer
- Can have multiple pools
- GPS coordinates used for route optimization
- Rate can override customer default

**Common Queries**:
```sql
-- Locations with poor GPS data
SELECT * FROM ServiceLocation 
WHERE (Latitude IS NULL OR Longitude IS NULL) 
AND IsBadAddress = 0;

-- High-value locations (monthly revenue)
SELECT sl.*, AVG(i.Total) as avg_invoice
FROM ServiceLocation sl
JOIN Invoice i ON sl.id IN (
  SELECT ServiceLocationId FROM InvoiceLocation il WHERE il.InvoiceId = i.id
)
WHERE i.InvoiceDate >= date('now', '-30 days')
GROUP BY sl.id
ORDER BY avg_invoice DESC;
```

---

### Pool
**Purpose**: Individual pools/bodies of water at a service location

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique pool identifier | Primary Key |
| ServiceLocationId | TEXT | Parent location | Foreign Key to ServiceLocation |
| Name | TEXT | Pool name/identifier | e.g., "Main Pool", "Spa" |
| Gallons | INTEGER | Water volume | For chemical calculations |
| BaselineFilterPressure | FLOAT | Normal filter PSI | For maintenance alerts |
| Notes | TEXT | Pool-specific notes | Equipment details, issues |
| EquipmentItems | JSON | Related equipment | Denormalized |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → ServiceLocation (parent)
- **1:Many** → EquipmentItem (pumps, filters, etc.)
- **1:Many** → ServiceStop (service records)
- **1:Many** → ServiceStopEntry (readings, chemicals)

**Key Business Rules**:
- A location can have multiple pools (pool + spa is common)
- Gallons critical for chemical dosage calculations
- BaselineFilterPressure used to detect filter issues

**Common Queries**:
```sql
-- Pools needing maintenance (filter pressure abnormal)
SELECT p.*, sl.Address, 
       sse.Value as current_pressure,
       ABS(sse.Value - p.BaselineFilterPressure) as pressure_diff
FROM Pool p
JOIN ServiceLocation sl ON p.ServiceLocationId = sl.id
JOIN ServiceStopEntry sse ON p.id = sse.PoolId
WHERE sse.EntryDescriptionText LIKE '%Filter%Pressure%'
  AND ABS(sse.Value - p.BaselineFilterPressure) > 5
ORDER BY pressure_diff DESC;
```

---

### Account
**Purpose**: Technicians and administrators who use the system

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique account identifier | Primary Key |
| Username | TEXT | Login username | Unique |
| Email | TEXT | Account email | For notifications |
| FirstName | TEXT | User first name | Required |
| LastName | TEXT | User last name | Required |
| RoleType | TEXT | User role | Admin/Technician/etc |
| IsActive | BOOLEAN | Account status | Affects login |
| CompanyId | TEXT | Company reference | Foreign Key |
| MobilePhone | TEXT | Contact number | |
| Address | TEXT | Home address | |
| City | TEXT | City | |
| State | TEXT | State | |
| Zip | TEXT | Postal code | |
| CanManageRoutes | BOOLEAN | Permission flag | |
| CanManageAdminPanel | BOOLEAN | Permission flag | |
| CanManageSettings | BOOLEAN | Permission flag | |
| PreventMoveRouteStops | BOOLEAN | Restriction flag | |
| PreventReorderRouteStops | BOOLEAN | Restriction flag | |
| Company | JSON | Company details | Denormalized |

**Relationships**:
- **Many:1** → Company
- **1:Many** → RouteStop (assigned technician)
- **1:Many** → WorkOrder (assigned technician)
- **1:Many** → RouteAssignment (regular assignment)

---

## Scheduling & Routing

### RouteAssignment
**Purpose**: Regular recurring service schedule for a location

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique assignment identifier | Primary Key |
| ServiceLocationId | TEXT | Location to service | Foreign Key to ServiceLocation |
| AccountId | TEXT | Assigned technician | Foreign Key to Account |
| DayOfWeek | TEXT | Scheduled day | Monday, Tuesday, etc. |
| Frequency | TEXT | Visit frequency | Weekly, Biweekly, Monthly |
| StartDate | DATETIME | Assignment start | When schedule begins |
| EndDate | DATETIME | Assignment end | When schedule ends (optional) |
| Sequence | INTEGER | Route order | For optimization |
| Status | TEXT | Assignment status | Active, Paused, Ended |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → ServiceLocation
- **Many:1** → Account (technician)
- **1:Many** → RouteStop (actual visits generated)
- **1:Many** → RouteSkip (skipped dates)
- **1:Many** → RouteMove (one-time changes)

**Key Business Rules**:
- Generates RouteStop records based on Frequency
- Sequence determines visit order for route optimization
- Biweekly frequency has off-week logic
- Status affects whether new stops are generated

**Common Queries**:
```sql
-- Active routes by technician for a specific day
SELECT ra.*, sl.Address, c.FirstName || ' ' || c.LastName as CustomerName
FROM RouteAssignment ra
JOIN ServiceLocation sl ON ra.ServiceLocationId = sl.id
JOIN Customer c ON sl.CustomerId = c.id
WHERE ra.AccountId = ? 
  AND ra.DayOfWeek = ?
  AND ra.Status = 'Active'
  AND (ra.EndDate IS NULL OR ra.EndDate >= date('now'))
ORDER BY ra.Sequence;
```

---

### RouteStop
**Purpose**: Individual service visits generated from route assignments

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique stop identifier | Primary Key |
| AccountId | TEXT | Assigned technician | Foreign Key to Account |
| ServiceLocationId | TEXT | Location to visit | Foreign Key to ServiceLocation |
| RouteAssignmentId | TEXT | Parent assignment | Foreign Key to RouteAssignment |
| ServiceDate | DATETIME | Scheduled date | Date of visit |
| StartTime | DATETIME | Actual start time | When tech arrived |
| CompleteTime | DATETIME | Actual completion | When tech finished |
| IsSkipped | BOOLEAN | Skip flag | If visit not performed |
| SkippedStopReasonId | TEXT | Skip reason | Foreign Key if skipped |
| IsOffBiweekly | BOOLEAN | Biweekly off-week flag | |
| Sequence | INTEGER | Visit order | Route optimization |
| MinutesAtStop | INTEGER | Time allocation | For scheduling |
| RouteMoveId | TEXT | Related route move | If moved from another date |
| EmailHeader | TEXT | Email subject | For customer notification |
| EmailMessage | TEXT | Email body | For customer notification |
| PhotoUrl | TEXT | Service photo | Evidence/documentation |
| EmailStatus | TEXT | Email delivery status | Sent, Failed, etc. |
| EmailSentDate | DATETIME | When email sent | |
| ServiceStops | JSON | Related service records | Denormalized |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → Account (technician)
- **Many:1** → ServiceLocation
- **Many:1** → RouteAssignment
- **Many:1** → RouteMove (if moved)
- **Many:1** → SkippedStopReason (if skipped)
- **1:Many** → ServiceStop (one per pool at location)

**Key Business Rules**:
- Generated automatically from RouteAssignment
- StartTime/CompleteTime track actual service window
- IsSkipped requires SkippedStopReasonId if company setting requires
- ServiceStops JSON contains per-pool service data

**Common Queries**:
```sql
-- Daily route for technician (incomplete stops)
SELECT rs.*, sl.Address, sl.GateCode,
       c.FirstName || ' ' || c.LastName as CustomerName,
       c.MobilePhone
FROM RouteStop rs
JOIN ServiceLocation sl ON rs.ServiceLocationId = sl.id
JOIN Customer c ON sl.CustomerId = c.id
WHERE rs.AccountId = ?
  AND date(rs.ServiceDate) = date('now')
  AND rs.CompleteTime IS NULL
ORDER BY rs.Sequence;

-- Skipped stops analysis
SELECT sr.Reason, COUNT(*) as skip_count
FROM RouteStop rs
JOIN SkippedStopReason sr ON rs.SkippedStopReasonId = sr.id
WHERE rs.ServiceDate >= date('now', '-30 days')
GROUP BY sr.Reason
ORDER BY skip_count DESC;
```

---

### RouteMove
**Purpose**: One-time schedule changes (moving a visit to different date/technician)

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique move identifier | Primary Key |
| RouteAssignmentId | TEXT | Original assignment | Foreign Key |
| ServiceLocationId | TEXT | Location being moved | Foreign Key |
| OriginalAccountId | TEXT | Original technician | Foreign Key |
| OriginalServiceDate | DATETIME | Original date | |
| MoveToAccountId | TEXT | New technician | Foreign Key |
| MoveToServiceDate | DATETIME | New date | |
| CreatedDate | DATETIME | When move was created | |
| Sequence | INTEGER | Order on new route | |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → RouteAssignment
- **Many:1** → ServiceLocation
- **Many:1** → Account (original technician)
- **Many:1** → Account (new technician)
- **1:1** → RouteStop (creates new stop on new date)

---

### RouteSkip
**Purpose**: Marking specific dates to skip in recurring schedule

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique skip identifier | Primary Key |
| RouteAssignmentId | TEXT | Assignment to skip | Foreign Key |
| ServiceDate | DATETIME | Date to skip | Specific date |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → RouteAssignment

**Key Business Rules**:
- Prevents automatic RouteStop generation for specified date
- Used for vacations, seasonal closures, etc.

---

## Service Operations

### ServiceStop
**Purpose**: Service record for a specific pool on a specific visit

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique service stop ID | Primary Key |
| RouteStopId | TEXT | Parent route stop | Foreign Key to RouteStop |
| PoolId | TEXT | Pool serviced | Foreign Key to Pool |
| PoolName | TEXT | Pool identifier | Denormalized |
| ServiceDate | DATETIME | Date of service | |
| Notes | TEXT | Technician notes | Internal |
| NotesToCustomer | TEXT | Customer-facing notes | Shown in email |
| NoteIsAlert | BOOLEAN | Requires attention | Urgent issues |
| NoteIsHandled | BOOLEAN | Alert resolved | |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → RouteStop (parent visit)
- **Many:1** → Pool (which pool)
- **1:Many** → ServiceStopEntry (readings, chemicals added)
- **1:Many** → ServiceStopCalculatorEntry (chemical calculations)

**Key Business Rules**:
- One ServiceStop per pool per RouteStop
- NoteIsAlert flags issues needing follow-up
- NotesToCustomer included in service report email

---

### ServiceStopEntry
**Purpose**: Individual readings, chemicals, and observations during service

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique entry identifier | Primary Key |
| ServiceStopId | TEXT | Parent service | Foreign Key to ServiceStop |
| PoolId | TEXT | Pool reference | Foreign Key to Pool |
| EntryDescriptionId | TEXT | Type of entry | Foreign Key to EntryDescription |
| WorkOrderId | TEXT | Related work order | Foreign Key (optional) |
| EntryType | TEXT | Entry category | Reading, Dosage, Observation |
| Value | FLOAT | Numeric value | pH level, chemical oz, etc. |
| ServiceDate | DATETIME | Date recorded | |
| EntryDescriptionText | TEXT | Description | Denormalized |
| UnitOfMeasure | TEXT | Unit | oz, lbs, ppm, etc. |
| ReadingType | TEXT | Reading category | Chemical, Equipment, etc. |
| SelectedIndex | INTEGER | Dropdown selection | For preset values |
| Sequence | INTEGER | Display order | |
| ValueDisplay | TEXT | Formatted value | For display |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → ServiceStop
- **Many:1** → Pool
- **Many:1** → EntryDescription (template)
- **Many:1** → WorkOrder (if part of work order)

**Key Business Rules**:
- EntryType determines validation rules
- Value stored as float for calculations
- ReadingType categorizes for reporting

**Common Queries**:
```sql
-- pH trend for a pool (last 30 days)
SELECT sse.ServiceDate, sse.Value as pH_value
FROM ServiceStopEntry sse
JOIN EntryDescription ed ON sse.EntryDescriptionId = ed.id
WHERE sse.PoolId = ?
  AND ed.Description LIKE '%pH%'
  AND sse.ServiceDate >= date('now', '-30 days')
ORDER BY sse.ServiceDate;

-- Chemical usage by type (last month)
SELECT ed.Description, SUM(sse.Value) as total_used, ed.UnitOfMeasure
FROM ServiceStopEntry sse
JOIN EntryDescription ed ON sse.EntryDescriptionId = ed.id
WHERE ed.EntryType = 'Dosage'
  AND sse.ServiceDate >= date('now', '-30 days')
  AND sse.CompanyId = ?
GROUP BY ed.Description
ORDER BY total_used DESC;
```

---

### WorkOrder
**Purpose**: Repair and maintenance work orders

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique work order ID | Primary Key |
| WorkOrderTypeId | TEXT | Type of work | Foreign Key to WorkOrderType |
| ServiceLocationId | TEXT | Where work performed | Foreign Key |
| WorkNeeded | TEXT | Problem description | |
| WorkPerformed | TEXT | What was done | |
| AddedByAccountId | TEXT | Who created | Foreign Key to Account |
| AddedOnDate | DATETIME | When created | |
| AccountId | TEXT | Assigned technician | Foreign Key to Account |
| ServiceDate | DATETIME | Scheduled date | |
| ScheduledTime | TEXT | Time window | |
| StartTime | DATETIME | Actual start | |
| CompleteTime | DATETIME | Actual completion | |
| RouteSequence | INTEGER | Order in route | |
| EstimatedMinutes | INTEGER | Time estimate | |
| LaborCost | FLOAT | Cost of labor | |
| Price | FLOAT | Customer price | |
| IsInvoiced | BOOLEAN | Billing status | |
| SyncDate | DATETIME | Last sync | |
| EmailHeader | TEXT | Email subject | |
| EmailMessage | TEXT | Email body | |
| EmailStatus | TEXT | Email status | |
| EmailSentDate | DATETIME | Email sent | |
| Notes | TEXT | Internal notes | |
| NoteIsAlert | BOOLEAN | Requires attention | |
| NoteIsHandled | BOOLEAN | Alert resolved | |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → WorkOrderType (category)
- **Many:1** → ServiceLocation
- **Many:1** → Account (creator)
- **Many:1** → Account (assigned technician)
- **1:Many** → InstalledItem (parts installed)
- **1:Many** → ShoppingListItem (parts needed)
- **1:Many** → ServiceStopEntry (if service work)
- **1:Many** → InvoiceItem (billing)

**Key Business Rules**:
- WorkOrderType determines default pricing
- IsInvoiced tracks billing status
- Can be one-time or recurring

**Common Queries**:
```sql
-- Open work orders by technician
SELECT wo.*, wot.Description as WorkType, sl.Address
FROM WorkOrder wo
JOIN WorkOrderType wot ON wo.WorkOrderTypeId = wot.id
JOIN ServiceLocation sl ON wo.ServiceLocationId = sl.id
WHERE wo.AccountId = ?
  AND wo.CompleteTime IS NULL
ORDER BY wo.ServiceDate;

-- Work order profitability
SELECT wot.Description,
       COUNT(*) as order_count,
       AVG(wo.Price - wo.LaborCost) as avg_profit,
       SUM(wo.Price - wo.LaborCost) as total_profit
FROM WorkOrder wo
JOIN WorkOrderType wot ON wo.WorkOrderTypeId = wot.id
WHERE wo.CompleteTime >= date('now', '-90 days')
GROUP BY wot.Description
ORDER BY total_profit DESC;
```

---

## Billing & Payments

### Invoice
**Purpose**: Customer billing documents

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique invoice identifier | Primary Key |
| CustomerId | TEXT | Billed customer | Foreign Key to Customer |
| InvoiceNumber | INTEGER | Sequential number | Auto-increment |
| InvoiceDate | DATETIME | Invoice date | |
| DueDate | DATETIME | Payment due date | |
| Message | TEXT | Invoice message | |
| Total | REAL | Total amount | Including tax |
| Subtotal | REAL | Pre-tax amount | |
| TaxAmount | REAL | Tax amount | |
| AmountDue | REAL | Outstanding balance | |
| Status | TEXT | Invoice status | Draft, Sent, Paid, Void |
| PaymentStatus | TEXT | Payment status | Unpaid, Partial, Paid |
| PaidAmount | REAL | Amount paid | |
| CanAutopay | INTEGER | Autopay eligible | Boolean as integer |
| VoidReason | TEXT | Why voided | If status = Void |
| FeeName | TEXT | Fee description | |
| DiscountName | TEXT | Discount description | |
| FeeFlat | REAL | Fixed fee amount | |
| FeePercent | REAL | Percentage fee | |
| FeeTotal | REAL | Calculated fee | |
| DiscountTotal | REAL | Calculated discount | |
| DiscountFlat | REAL | Fixed discount | |
| DiscountPercent | REAL | Percentage discount | |
| QuoteId | TEXT | Related quote | If converted from quote |
| AutopayMethodExists | INTEGER | Has payment method | Boolean |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → Customer
- **1:Many** → InvoiceLocation (service locations on invoice)
- **1:Many** → InvoiceItem (line items)
- **1:Many** → Payment

**Key Business Rules**:
- AmountDue = Total - PaidAmount
- Status affects collections workflow
- VoidReason required if Status = Void
- InvoiceNumber must be unique per company

**Common Queries**:
```sql
-- Outstanding invoices (accounts receivable)
SELECT i.*, c.FirstName || ' ' || c.LastName as CustomerName,
       julianday('now') - julianday(i.DueDate) as days_overdue
FROM Invoice i
JOIN Customer c ON i.CustomerId = c.id
WHERE i.PaymentStatus != 'Paid'
  AND i.Status != 'Void'
  AND i.CompanyId = ?
ORDER BY days_overdue DESC;

-- Monthly revenue
SELECT strftime('%Y-%m', InvoiceDate) as month,
       SUM(Total) as revenue,
       COUNT(*) as invoice_count,
       AVG(Total) as avg_invoice
FROM Invoice
WHERE Status != 'Void'
  AND InvoiceDate >= date('now', '-12 months')
  AND CompanyId = ?
GROUP BY month
ORDER BY month;
```

---

### InvoiceItem
**Purpose**: Line items on invoices

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique item identifier | Primary Key |
| InvoiceLocationId | TEXT | Location on invoice | Foreign Key to InvoiceLocation |
| Sequence | INTEGER | Display order | |
| Item | TEXT | Item name | |
| Description | TEXT | Item description | |
| Quantity | REAL | Quantity | |
| Rate | REAL | Unit price | |
| CostQuantity | REAL | Cost quantity | For profit calc |
| Cost | REAL | Unit cost | For profit calc |
| IsTaxable | BOOLEAN | Subject to tax | |
| RouteStopId | TEXT | Related service | Foreign Key (optional) |
| WorkOrderId | TEXT | Related work order | Foreign Key (optional) |
| InstalledItemId | TEXT | Related install | Foreign Key (optional) |
| EntryDescriptionId | TEXT | Related entry | Foreign Key (optional) |
| Source | INTEGER | Item source type | |
| ServiceDates | TEXT | Date range | For service items |
| FeeTotal | REAL | Applied fees | |
| DiscountTotal | REAL | Applied discounts | |
| Amount | REAL | Line total | Quantity * Rate |
| Subtotal | REAL | Pre-adjustment total | |
| ProductId | TEXT | Product reference | Foreign Key (optional) |
| WorkOrderTypeId | TEXT | Work type | Foreign Key (optional) |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → InvoiceLocation
- **Many:1** → RouteStop (if service item)
- **Many:1** → WorkOrder (if work item)
- **Many:1** → InstalledItem (if part)
- **Many:1** → Product (if product)
- **Many:1** → EntryDescription (if chemical/reading)
- **Many:1** → WorkOrderType (if work type)

**Key Business Rules**:
- Amount = Quantity * Rate + FeeTotal - DiscountTotal
- IsTaxable determines if TaxRate applies
- Source tracks where item came from

**Common Queries**:
```sql
-- Most profitable service types
SELECT ed.Description,
       COUNT(*) as item_count,
       SUM((ii.Rate - ii.Cost) * ii.Quantity) as total_profit
FROM InvoiceItem ii
JOIN EntryDescription ed ON ii.EntryDescriptionId = ed.id
WHERE ii.Cost > 0
GROUP BY ed.Description
ORDER BY total_profit DESC
LIMIT 10;
```

---

### Payment
**Purpose**: Customer payments received

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique payment identifier | Primary Key |
| CustomerId | TEXT | Paying customer | Foreign Key |
| InvoiceId | TEXT | Invoice paid | Foreign Key |
| PaymentDate | DATETIME | When received | |
| PaymentOrigin | TEXT | Payment source | Online, Manual, etc. |
| PaymentType | TEXT | Payment method | Credit, Check, Cash, etc. |
| PaymentMethod | TEXT | Method details | Last 4 digits, etc. |
| Status | TEXT | Payment status | Succeeded, Failed, Pending |
| StatusMessage | TEXT | Status details | Error messages |
| Reference | TEXT | Transaction reference | Check number, etc. |
| Currency | TEXT | Currency code | USD, etc. |
| Amount | REAL | Payment amount | |
| PaymentIntentId | TEXT | Stripe payment intent | For online payments |
| PaymentIntentStatus | TEXT | Stripe status | |
| PaymentFeeId | TEXT | Processing fee ID | |
| ApplicationFee | REAL | Processing fee amount | |
| AmountRefundedOnline | REAL | Online refund total | |
| AmountRefundedOffline | REAL | Offline refund total | |
| ErrorCode | TEXT | Error code | If failed |
| DeclineCode | TEXT | Decline reason | If declined |
| PayoutId | TEXT | Stripe payout ID | |
| IsCustomerInitiated | BOOLEAN | Customer payment | vs manual entry |
| PaymentMethodId | TEXT | Saved payment method | |
| SourcePaymentMethod | TEXT | Payment source | |
| IsAutopay | BOOLEAN | Automatic payment | |
| VoidReason | TEXT | Why voided | If voided |
| LastFailedDate | DATETIME | Last failure | For retry logic |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → Customer
- **Many:1** → Invoice

**Key Business Rules**:
- Status must be 'Succeeded' to apply to invoice
- Refunds tracked separately (online vs offline)
- IsAutopay indicates recurring payment

**Common Queries**:
```sql
-- Failed payments needing attention
SELECT p.*, c.FirstName || ' ' || c.LastName as CustomerName,
       i.InvoiceNumber
FROM Payment p
JOIN Customer c ON p.CustomerId = c.id
JOIN Invoice i ON p.InvoiceId = i.id
WHERE p.Status = 'Failed'
  AND p.LastFailedDate >= date('now', '-7 days')
ORDER BY p.LastFailedDate DESC;

-- Payment method breakdown
SELECT PaymentType,
       COUNT(*) as payment_count,
       SUM(Amount) as total_amount
FROM Payment
WHERE Status = 'Succeeded'
  AND PaymentDate >= date('now', '-30 days')
GROUP BY PaymentType
ORDER BY total_amount DESC;
```

---

## Equipment & Parts

### EquipmentItem
**Purpose**: Pool equipment inventory (pumps, filters, heaters, etc.)

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique equipment ID | Primary Key |
| PoolId | TEXT | Pool location | Foreign Key to Pool |
| Description | TEXT | Equipment description | |
| PartCategoryId | TEXT | Equipment type | Foreign Key to PartCategory |
| PartMakeId | TEXT | Manufacturer | Foreign Key to PartMake |
| PartModelId | TEXT | Model | Foreign Key to PartModel |
| SoftDeleted | BOOLEAN | Removed flag | For history |
| Notes | TEXT | Equipment notes | |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → Pool
- **Many:1** → PartCategory (type)
- **Many:1** → PartMake (manufacturer)
- **Many:1** → PartModel (model)
- **1:Many** → InstalledItem (replacements)
- **1:Many** → ShoppingListItem (needed parts)

**Key Business Rules**:
- PartCategory → PartMake → PartModel hierarchy
- SoftDeleted keeps history without deletion

---

### PartCategory
**Purpose**: Equipment categories (Pump, Filter, Heater, etc.)

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| Description | TEXT | Category name |
| ItemDescription | TEXT | Display name |

---

### PartMake
**Purpose**: Equipment manufacturers

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| PartCategoryId | TEXT | Foreign Key to PartCategory |
| Description | TEXT | Manufacturer name |

---

### PartModel
**Purpose**: Specific equipment models

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| PartMakeId | TEXT | Foreign Key to PartMake |
| Description | TEXT | Model name |

---

### InstalledItem
**Purpose**: Parts and equipment installed during service

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique install ID | Primary Key |
| ServiceStopId | TEXT | Service visit | Foreign Key to ServiceStop |
| WorkOrderId | TEXT | Work order | Foreign Key to WorkOrder |
| Description | TEXT | Item description | |
| EquipmentItemId | TEXT | Equipment ref | Foreign Key to EquipmentItem |
| ChemicalId | TEXT | Chemical ref | Foreign Key to Chemical |
| ProductId | TEXT | Product ref | Foreign Key to Product |
| ItemType | TEXT | Item category | Equipment, Chemical, Product |
| PreviousStatus | TEXT | Old condition | For replacements |
| Quantity | FLOAT | Amount installed | |
| Price | FLOAT | Customer price | |
| DescriptionDisplay | TEXT | Display text | Formatted |
| EquipmentDisplay | TEXT | Equipment info | Formatted |
| DateDisplay | TEXT | Date formatted | |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → ServiceStop
- **Many:1** → WorkOrder
- **Many:1** → EquipmentItem
- **Many:1** → Chemical
- **Many:1** → Product
- **1:Many** → InvoiceItem (for billing)

---

### ShoppingListItem
**Purpose**: Parts needed for service (shopping list for techs)

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique item ID | Primary Key |
| Description | TEXT | Item description | |
| PoolId | TEXT | Pool reference | Foreign Key |
| EquipmentItemId | TEXT | Equipment reference | Foreign Key |
| PartCategoryId | TEXT | Category | Foreign Key |
| PartMakeId | TEXT | Manufacturer | Foreign Key |
| PartModelId | TEXT | Model | Foreign Key |
| ChemicalId | TEXT | Chemical reference | Foreign Key |
| ProductId | TEXT | Product reference | Foreign Key |
| Quantity | FLOAT | Quantity needed | |
| Price | FLOAT | Estimated price | |
| CustomerName | TEXT | Customer name | Denormalized |
| AddedBy | TEXT | Who added | |
| AddedByAccountId | TEXT | Account reference | Foreign Key |
| ItemType | TEXT | Item type | Equipment, Chemical, etc. |
| ItemStatus | TEXT | Status | Needed, Ordered, Installed |
| WorkOrderId | TEXT | Related work order | Foreign Key |
| InstalledItemId | TEXT | When installed | Foreign Key |
| CompanyId | TEXT | Company reference | Foreign Key |

**Relationships**:
- **Many:1** → Pool
- **Many:1** → EquipmentItem
- **Many:1** → Product
- **Many:1** → Chemical
- **Many:1** → Account (who added)
- **Many:1** → WorkOrder
- **1:1** → InstalledItem (when installed)

**Key Business Rules**:
- ItemStatus tracks workflow (Needed → Ordered → Installed)
- When installed, creates InstalledItem record

---

## Products & Chemicals

### Product
**Purpose**: Products available for sale/use

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| Name | TEXT | Product name |
| DefaultDescription | TEXT | Description |
| ProductCategoryId | TEXT | Foreign Key to ProductCategory |
| DefaultPrice | FLOAT | Standard price |
| IsTaxable | BOOLEAN | Subject to tax |
| QboItemId | TEXT | QuickBooks reference |
| CompanyId | TEXT | Foreign Key |

---

### ProductCategory
**Purpose**: Product categorization

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| Description | TEXT | Category name |
| CompanyId | TEXT | Foreign Key |

---

### Chemical
**Purpose**: Chemicals used in pool service

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| Description | TEXT | Chemical name (Chlorine, Acid, etc.) |

**Relationships**:
- **1:Many** → ServiceStopEntry (chemical readings/additions)
- **1:Many** → InstalledItem (chemicals added)
- **1:Many** → ShoppingListItem (chemicals needed)

---

### EntryDescription
**Purpose**: Templates for service readings and chemical additions

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Primary Key | |
| Description | TEXT | Entry name | pH, Chlorine, etc. |
| UnitOfMeasure | TEXT | Unit | oz, lbs, ppm, etc. |
| EntryType | TEXT | Category | Reading, Dosage, Observation |
| ReadingType | TEXT | Sub-category | |
| DosageType | TEXT | Dosage category | |
| SelectedIndex | INTEGER | Default selection | |
| Sequence | INTEGER | Display order | |
| Cost | FLOAT | Cost per unit | |
| Price | FLOAT | Price per unit | |
| CanIncludeWithService | BOOLEAN | Billable flag | |
| ColumnSequence | INTEGER | Column position | |
| CompanyId | TEXT | Foreign Key | |

**Relationships**:
- **1:Many** → ServiceStopEntry (actual entries)
- **1:Many** → EntryValue (preset values)
- **1:Many** → InvoiceItem (if billable)

---

### EntryValue
**Purpose**: Preset values for entry descriptions

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| EntryDescriptionId | TEXT | Foreign Key to EntryDescription |
| Value | FLOAT | Preset value |
| CompanyId | TEXT | Foreign Key |

---

## Quotes & Proposals

### Quote
**Purpose**: Customer proposals for one-time or project work (repairs, renovations, equipment installs)

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique quote identifier | Primary Key |
| CompanyId | TEXT | Company reference | Foreign Key to Company |
| CustomerId | TEXT | Customer reference | Foreign Key to Customer |
| CustomerDisplayName | TEXT | Denormalized customer name | For display |
| CustomerAddress | TEXT | Denormalized billing address | |
| CustomerCity | TEXT | Billing city | |
| CustomerState | TEXT | Billing state | |
| CustomerZip | TEXT | Billing zip | |
| CustomerEmailAddresses | TEXT | Customer emails | For sending quotes |
| QuoteNumber | INTEGER | Sequential quote number | Unique per company |
| QuoteDate | DATETIME | Date quote was created | |
| ExpirationDate | DATETIME | When quote expires | |
| SentDate | DATETIME | When sent to customer | Null if not sent |
| StatusDate | DATETIME | Last status change | |
| Status | TEXT | Quote status | e.g., Draft, Sent, Accepted, Rejected |
| Total | FLOAT | Quote total including tax | |
| Subtotal | FLOAT | Quote subtotal before tax | |
| TaxAmount | FLOAT | Tax amount | |
| DiscountName | TEXT | Discount label | |
| DiscountTotal | FLOAT | Total discount applied | |
| FeeName | TEXT | Fee label | |
| FeeTotal | FLOAT | Total fees applied | |
| Margin | FLOAT | Profit margin | |
| Message | TEXT | Customer-facing message | |
| InternalNotes | TEXT | Internal notes | Not visible to customer |
| RejectReason | TEXT | Why customer rejected | Populated on rejection |
| Signature | TEXT | Customer signature data | |
| IsArchived | BOOLEAN | Archive flag | |
| DepositTotal | FLOAT | Required deposit amount | |
| DepositStatus | TEXT | Deposit payment status | |
| JobId | TEXT | Linked job/work order | |
| CreatedAt | DATETIME | Record creation timestamp | |
| UpdatedAt | DATETIME | Last modification timestamp | |
| Deleted | BOOLEAN | Soft delete flag | |

**Relationships**:
- **Many:1** → Customer
- **1:Many** → QuoteLocation (service locations on this quote)
- **1:Many** → QuoteAttachment (photos, documents)
- **Many:Many** → Tag (via QuoteTag)

### QuoteLocation
**Purpose**: Service location line grouping within a quote (quotes can span multiple locations)

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique identifier | Primary Key |
| CompanyId | TEXT | Company reference | Foreign Key |
| QuoteId | TEXT | Parent quote | Foreign Key to Quote |
| ServiceLocationId | TEXT | Service location | Foreign Key to ServiceLocation |
| ServiceLocationAddress | TEXT | Denormalized address | |
| ServiceLocationCity | TEXT | Denormalized city | |
| ServiceLocationState | TEXT | Denormalized state | |
| ServiceLocationZip | TEXT | Denormalized zip | |
| TaxGroupId | TEXT | Tax group reference | Foreign Key to TaxGroup |
| ServiceLocationTaxGroupName | TEXT | Denormalized tax group | |
| ServiceLocationTaxGroupRate | FLOAT | Denormalized tax rate | |
| DiscountFlat | FLOAT | Location-level flat discount | |
| DiscountPercent | FLOAT | Location-level % discount | |
| FeeFlat | FLOAT | Location-level flat fee | |
| FeePercent | FLOAT | Location-level % fee | |

**Relationships**:
- **Many:1** → Quote
- **Many:1** → ServiceLocation
- **1:Many** → QuoteItem (line items)

### QuoteItem
**Purpose**: Individual line items on a quote (products, labor, work order types)

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique identifier | Primary Key |
| CompanyId | TEXT | Company reference | Foreign Key |
| QuoteLocationId | TEXT | Parent location group | Foreign Key to QuoteLocation |
| Sequence | INTEGER | Display order | |
| Item | TEXT | Line item name | |
| Description | TEXT | Line item description | |
| Quantity | FLOAT | Quantity | |
| Rate | FLOAT | Unit price | |
| Cost | FLOAT | Unit cost | For margin calculation |
| IsTaxable | BOOLEAN | Subject to tax | |
| Source | TEXT | Origin type | |
| ProductId | TEXT | Product reference | Foreign Key to Product (optional) |
| WorkOrderTypeId | TEXT | Work order type | Foreign Key to WorkOrderType (optional) |

**Relationships**:
- **Many:1** → QuoteLocation
- **Many:1** → Product (optional)
- **Many:1** → WorkOrderType (optional)

### QuoteAttachment
**Purpose**: Files attached to quotes (photos, PDFs, documents)

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique identifier | Primary Key |
| CompanyId | TEXT | Company reference | Foreign Key |
| QuoteId | TEXT | Parent quote | Foreign Key to Quote |
| FileName | TEXT | Original filename | |
| FilePath | TEXT | Storage path | |
| FileUrl | TEXT | Public URL | |
| ContentType | TEXT | MIME type | |
| Caption | TEXT | Description | |
| Sequence | INTEGER | Display order | |
| AddedByAccountId | TEXT | Uploaded by | Foreign Key to Account |

**Relationships**:
- **Many:1** → Quote
- **Many:1** → Account (uploader)

### QuoteTag
**Purpose**: Junction table linking quotes to tags for categorization

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Unique identifier | Primary Key |
| CompanyId | TEXT | Company reference | Foreign Key |
| QuoteId | TEXT | Quote reference | Foreign Key to Quote |
| TagId | TEXT | Tag reference | Foreign Key to Tag |

**Relationships**:
- **Many:1** → Quote
- **Many:1** → Tag

---

## System & Configuration

### WorkOrderType
**Purpose**: Categories and templates for work orders

| Column | Type | Description | Business Rules |
|--------|------|-------------|----------------|
| id | TEXT | Primary Key | |
| Description | TEXT | Work type name | Equipment Repair, Green Pool, etc. |
| ColorCode | TEXT | Display color | For calendar |
| RecurMonths | INTEGER | Recurrence months | For recurring work |
| Recurs | BOOLEAN | Is recurring | |
| RecurType | TEXT | Recurrence pattern | |
| RecurValue | INTEGER | Recurrence value | |
| DefaultWorkNeeded | TEXT | Default problem description | |
| DefaultWorkPerformed | TEXT | Default work description | |
| DefaultMinutes | INTEGER | Est. time | |
| DefaultLaborCost | FLOAT | Default cost | |
| DefaultPrice | FLOAT | Default price | |
| AllowTechsToAdd | BOOLEAN | Techs can create | Permission |
| NeedsToBeInvoiced | BOOLEAN | Requires billing | |
| SendAlert | BOOLEAN | Alert office | |
| SendFinishedAlert | BOOLEAN | Alert when complete | |
| PhotoIsRequired | BOOLEAN | Requires photo | |
| SendEmail | BOOLEAN | Email customer | |
| DefaultEmailSubject | TEXT | Email template | |
| DefaultEmailHeader | TEXT | Email template | |
| DefaultEmailMessage | TEXT | Email template | |
| SoftDeleted | BOOLEAN | Inactive flag | |
| Sequence | INTEGER | Display order | |
| CompanyId | TEXT | Foreign Key | |

**Relationships**:
- **1:Many** → WorkOrder
- **1:Many** → LocationWorkOrderType (recurring setup)
- **1:Many** → WorkOrderTypeShoppingListItem (default parts)

---

### LocationWorkOrderType
**Purpose**: Recurring work order configuration per location

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| ServiceLocationId | TEXT | Foreign Key to ServiceLocation |
| WorkOrderTypeId | TEXT | Foreign Key to WorkOrderType |
| LastDoneDate | DATETIME | Last completion |
| PreviousLastDoneDate | DATETIME | Previous completion |
| LaborCost | FLOAT | Location-specific cost |
| Price | FLOAT | Location-specific price |
| CompanyId | TEXT | Foreign Key |

---

### CompanySetting
**Purpose**: Company-wide configuration

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| CompanyId | TEXT | Foreign Key to Company |
| MinutesAtStop | INTEGER | Default visit duration |
| MinutesToLocation | INTEGER | Default travel time |
| MinutesPerMile | FLOAT | Route calculation |
| ShowTechCustomerPhone | BOOLEAN | Privacy setting |
| ShowTechCustomerEmail | BOOLEAN | Privacy setting |
| SortCustomersByFirstName | BOOLEAN | Display preference |
| ServiceHistoryColumns | TEXT | UI configuration |
| RequireSkippedStopReason | BOOLEAN | Workflow enforcement |

---

### Tag
**Purpose**: Customer tagging/categorization

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| Name | TEXT | Tag name |
| CompanyId | TEXT | Foreign Key |

**Relationships**:
- **Many:Many** → Customer (via CustomerTag)

---

### CustomerTag
**Purpose**: Junction table for customer tags

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| CustomerId | TEXT | Foreign Key to Customer |
| TagId | TEXT | Foreign Key to Tag |
| CompanyId | TEXT | Foreign Key |

---

### TaxGroup
**Purpose**: Tax configuration groups

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| Name | TEXT | Group name |
| IsActive | BOOLEAN | Status |
| CompanyId | TEXT | Foreign Key |

**Relationships**:
- **Many:Many** → TaxRate (via TaxGroupRate)
- **1:Many** → InvoiceLocation

---

### TaxRate
**Purpose**: Individual tax rates

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| Name | TEXT | Tax name (State Sales Tax, etc.) |
| Rate | FLOAT | Tax percentage |
| IsActive | BOOLEAN | Status |
| CompanyId | TEXT | Foreign Key |

**Relationships**:
- **Many:Many** → TaxGroup (via TaxGroupRate)

---

### TaxGroupRate
**Purpose**: Junction table for tax groups and rates

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| TaxGroupId | TEXT | Foreign Key to TaxGroup |
| TaxRateId | TEXT | Foreign Key to TaxRate |
| CompanyId | TEXT | Foreign Key |

---

### InvoiceLocation
**Purpose**: Groups invoice items by service location

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| ServiceLocationId | TEXT | Foreign Key to ServiceLocation |
| InvoiceId | TEXT | Foreign Key to Invoice |
| TaxGroupId | TEXT | Foreign Key to TaxGroup |
| FeeFlat | REAL | Fixed fee |
| FeePercent | REAL | Percentage fee |
| DiscountFlat | REAL | Fixed discount |
| DiscountPercent | REAL | Percentage discount |
| RateType | INTEGER | Billing type |
| CompanyId | TEXT | Foreign Key |

**Relationships**:
- **Many:1** → Invoice
- **Many:1** → ServiceLocation
- **Many:1** → TaxGroup
- **1:Many** → InvoiceItem

---

### SkippedStopReason
**Purpose**: Predefined reasons for skipping stops

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| CompanyId | TEXT | Foreign Key |
| Reason | TEXT | Skip reason (Gate locked, Dog loose, etc.) |
| Sequence | INTEGER | Display order |

**Relationships**:
- **1:Many** → RouteStop

---

### CompanyAddress
**Purpose**: Company office locations

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| Description | TEXT | Location name |
| Address | TEXT | Street address |
| City | TEXT | City |
| State | TEXT | State |
| Zip | TEXT | Postal code |
| Latitude | FLOAT | GPS latitude |
| Longitude | FLOAT | GPS longitude |
| CompanyId | TEXT | Foreign Key |

---

### ServiceStopCalculatorEntry
**Purpose**: Chemical dosage calculations

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| ServiceStopId | TEXT | Foreign Key to ServiceStop |
| WorkOrderId | TEXT | Foreign Key to WorkOrder |
| PoolId | TEXT | Foreign Key to Pool |
| EntryType | TEXT | Calculation type |
| Value | FLOAT | Calculated amount |
| ServiceDate | DATETIME | Date |
| CompanyId | TEXT | Foreign Key |

**Relationships**:
- **Many:1** → ServiceStop
- **Many:1** → WorkOrder
- **Many:1** → Pool

---

### WorkOrderTypeShoppingListItem
**Purpose**: Default parts/products for work order types

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary Key |
| WorkOrderTypeId | TEXT | Foreign Key to WorkOrderType |
| Description | TEXT | Item description |
| ChemicalId | TEXT | Foreign Key to Chemical |
| ItemType | TEXT | Item category |
| ProductId | TEXT | Foreign Key to Product |
| Quantity | REAL | Default quantity |
| Price | NUMERIC | Default price |
| CompanyId | TEXT | Foreign Key |

**Relationships**:
- **Many:1** → WorkOrderType
- **Many:1** → Product
- **Many:1** → Chemical

---

## Relationship Summary

### Core Business Flow

```
Company
  └── Customer
        └── ServiceLocation
              ├── Pool
              │     ├── EquipmentItem → PartCategory → PartMake → PartModel
              │     └── ServiceStop → ServiceStopEntry → EntryDescription
              │
              ├── RouteAssignment → RouteStop → ServiceStop
              │
              ├── WorkOrder → InstalledItem → [Equipment/Chemical/Product]
              │
              └── Invoice → InvoiceLocation → InvoiceItem
                                  └── Payment
```

### Key Relationship Patterns

**Customer to Revenue:**
```
Customer → ServiceLocation → RouteStop → ServiceStop → ServiceStopEntry
                           → WorkOrder → InstalledItem → InvoiceItem → Invoice → Payment
```

**Scheduling Flow:**
```
Account (Technician) + ServiceLocation → RouteAssignment (recurring)
                                       → RouteStop (individual visits)
                                       → ServiceStop (per-pool service)
                                       → ServiceStopEntry (readings/chemicals)
```

**Equipment Management:**
```
Pool → EquipmentItem (inventory)
     → ShoppingListItem (parts needed)
     → InstalledItem (parts installed)
     → InvoiceItem (parts billed)
```

**Billing Chain:**
```
ServiceStop/WorkOrder → InvoiceItem → InvoiceLocation → Invoice → Payment
                                                       → TaxGroup → TaxRate
```

### Foreign Key Reference Guide

| Child Table | Parent Table | Foreign Key Column | Relationship Type |
|------------|--------------|-------------------|-------------------|
| Customer | Company | CompanyId | Many:1 |
| ServiceLocation | Customer | CustomerId | Many:1 |
| Pool | ServiceLocation | ServiceLocationId | Many:1 |
| EquipmentItem | Pool | PoolId | Many:1 |
| RouteAssignment | ServiceLocation | ServiceLocationId | Many:1 |
| RouteAssignment | Account | AccountId | Many:1 |
| RouteStop | RouteAssignment | RouteAssignmentId | Many:1 |
| RouteStop | Account | AccountId | Many:1 |
| RouteStop | ServiceLocation | ServiceLocationId | Many:1 |
| ServiceStop | RouteStop | RouteStopId | Many:1 |
| ServiceStop | Pool | PoolId | Many:1 |
| ServiceStopEntry | ServiceStop | ServiceStopId | Many:1 |
| ServiceStopEntry | EntryDescription | EntryDescriptionId | Many:1 |
| WorkOrder | ServiceLocation | ServiceLocationId | Many:1 |
| WorkOrder | WorkOrderType | WorkOrderTypeId | Many:1 |
| WorkOrder | Account | AccountId | Many:1 |
| InstalledItem | ServiceStop | ServiceStopId | Many:1 |
| InstalledItem | WorkOrder | WorkOrderId | Many:1 |
| Invoice | Customer | CustomerId | Many:1 |
| InvoiceLocation | Invoice | InvoiceId | Many:1 |
| InvoiceLocation | ServiceLocation | ServiceLocationId | Many:1 |
| InvoiceItem | InvoiceLocation | InvoiceLocationId | Many:1 |
| Payment | Invoice | InvoiceId | Many:1 |
| Payment | Customer | CustomerId | Many:1 |

### Critical Business Queries

**1. Customer Lifetime Value:**
```sql
SELECT c.id, c.FirstName || ' ' || c.LastName as CustomerName,
       COUNT(DISTINCT i.id) as invoice_count,
       SUM(i.Total) as lifetime_revenue,
       AVG(i.Total) as avg_invoice,
       MIN(i.InvoiceDate) as first_invoice,
       MAX(i.InvoiceDate) as last_invoice
FROM Customer c
LEFT JOIN Invoice i ON c.id = i.CustomerId
WHERE i.Status != 'Void'
GROUP BY c.id
ORDER BY lifetime_revenue DESC;
```

**2. Route Efficiency:**
```sql
SELECT a.FirstName || ' ' || a.LastName as Technician,
       DATE(rs.ServiceDate) as Date,
       COUNT(*) as stops_completed,
       SUM(rs.MinutesAtStop) as total_minutes,
       AVG(rs.MinutesAtStop) as avg_time_per_stop
FROM RouteStop rs
JOIN Account a ON rs.AccountId = a.id
WHERE rs.CompleteTime IS NOT NULL
  AND rs.ServiceDate >= date('now', '-30 days')
GROUP BY a.id, DATE(rs.ServiceDate)
ORDER BY Date DESC, Technician;
```

**3. Equipment Failure Analysis:**
```sql
SELECT pc.Description as EquipmentType,
       pm.Description as Make,
       COUNT(*) as replacement_count,
       AVG(julianday(ii.ServiceStopId) - julianday(ei.CreatedAt)) as avg_lifespan_days
FROM InstalledItem ii
JOIN EquipmentItem ei ON ii.EquipmentItemId = ei.id
JOIN PartCategory pc ON ei.PartCategoryId = pc.id
JOIN PartMake pm ON ei.PartMakeId = pm.id
WHERE ii.ItemType = 'Equipment'
  AND ii.PreviousStatus = 'Replaced'
GROUP BY pc.Description, pm.Description
ORDER BY replacement_count DESC;
```

**4. Chemical Usage Trends:**
```sql
SELECT ed.Description as Chemical,
       strftime('%Y-%m', sse.ServiceDate) as Month,
       SUM(sse.Value) as total_used,
       ed.UnitOfMeasure,
       COUNT(DISTINCT sse.PoolId) as pools_serviced
FROM ServiceStopEntry sse
JOIN EntryDescription ed ON sse.EntryDescriptionId = ed.id
WHERE ed.EntryType = 'Dosage'
  AND sse.ServiceDate >= date('now', '-12 months')
GROUP BY ed.Description, strftime('%Y-%m', sse.ServiceDate)
ORDER BY Month, total_used DESC;
```

**5. Revenue by Service Type:**
```sql
SELECT 
  CASE 
    WHEN ii.RouteStopId IS NOT NULL THEN 'Regular Service'
    WHEN ii.WorkOrderId IS NOT NULL THEN 'Work Orders'
    WHEN ii.ProductId IS NOT NULL THEN 'Products'
    ELSE 'Other'
  END as ServiceType,
  COUNT(*) as item_count,
  SUM(ii.Amount) as total_revenue,
  AVG(ii.Amount) as avg_amount
FROM InvoiceItem ii
JOIN InvoiceLocation il ON ii.InvoiceLocationId = il.id
JOIN Invoice i ON il.InvoiceId = i.id
WHERE i.Status != 'Void'
  AND i.InvoiceDate >= date('now', '-30 days')
GROUP BY ServiceType
ORDER BY total_revenue DESC;
```

---

## Usage Notes

### Data Integrity Rules
1. **Soft Deletes**: Many tables use `Deleted` or `SoftDeleted` boolean flags rather than hard deletes
2. **CompanyId**: All tables have CompanyId for multi-tenancy isolation
3. **Timestamps**: CreatedAt/UpdatedAt track record lifecycle
4. **Foreign Keys**: Not enforced at database level but application enforced

### Denormalization Strategy
Several tables contain JSON fields with denormalized data for performance:
- Customer.ServiceLocations
- ServiceLocation.Pools, RouteAssignments
- Pool.EquipmentItems
- RouteStop.ServiceStops
- Account.Company

### Query Optimization Tips
1. Always filter by CompanyId first
2. Use indexes on frequently joined columns (CustomerId, ServiceLocationId, PoolId)
3. Date range queries benefit from indexes on ServiceDate, InvoiceDate, etc.
4. JSON fields should not be queried directly - use normalized relationships

### Common AI Query Patterns
When generating insights, prefer queries that:
1. Join across business domains (Customer → Service → Revenue)
2. Aggregate over time periods (monthly/quarterly trends)
3. Compare performance metrics (technician efficiency, customer value)
4. Identify anomalies (unusual costs, failed equipment, payment issues)
5. Calculate business KPIs (LTV, churn, utilization, profitability)

---

**End of Data Dictionary**
