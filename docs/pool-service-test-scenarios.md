# Pool Service Management System - Business Test Scenarios

## AI Query Test Cases for Pool Service Domain

### Executive Dashboard Scenarios

#### 1. Revenue and Financial Analysis
```sql
-- Monthly revenue trending
SELECT 
    strftime('%Y-%m', InvoiceDate) as month,
    COUNT(*) as invoice_count,
    SUM(Total) as monthly_revenue,
    AVG(Total) as avg_invoice_value
FROM Invoice 
WHERE InvoiceDate >= date('now', '-12 months')
GROUP BY strftime('%Y-%m', InvoiceDate)
ORDER BY month;

-- Customer payment analysis  
SELECT 
    PaymentStatus,
    COUNT(*) as count,
    SUM(Total) as total_amount
FROM Invoice
GROUP BY PaymentStatus;
```

#### 2. Operational Efficiency Metrics
```sql
-- Technician productivity by route completion
SELECT 
    a.FirstName || ' ' || a.LastName as technician,
    COUNT(rs.id) as stops_completed,
    AVG(rs.MinutesAtStop) as avg_minutes_per_stop,
    COUNT(CASE WHEN rs.IsSkipped = 1 THEN 1 END) as skipped_stops
FROM Account a
JOIN RouteStop rs ON a.id = rs.AccountId
WHERE rs.ServiceDate >= date('now', '-30 days')
GROUP BY a.id, a.FirstName, a.LastName;

-- Service location performance
SELECT 
    sl.City,
    sl.State,
    COUNT(rs.id) as total_stops,
    AVG(rs.MinutesAtStop) as avg_service_time
FROM ServiceLocation sl
JOIN RouteStop rs ON sl.id = rs.ServiceLocationId
WHERE rs.ServiceDate >= date('now', '-90 days')
GROUP BY sl.City, sl.State
ORDER BY total_stops DESC;
```

#### 3. Customer Analysis & Retention
```sql
-- Customer service frequency and value
SELECT 
    c.FirstName || ' ' || c.LastName as customer_name,
    COUNT(DISTINCT rs.ServiceDate) as service_visits,
    SUM(i.Total) as total_spent,
    MAX(rs.ServiceDate) as last_service_date
FROM Customer c
LEFT JOIN ServiceLocation sl ON c.id = sl.CustomerId
LEFT JOIN RouteStop rs ON sl.id = rs.ServiceLocationId  
LEFT JOIN Invoice i ON c.id = i.CustomerId
WHERE rs.ServiceDate >= date('now', '-12 months')
GROUP BY c.id, c.FirstName, c.LastName
ORDER BY total_spent DESC;

-- Geographic customer distribution
SELECT 
    City,
    State,
    COUNT(*) as customer_count,
    COUNT(CASE WHEN IsInactive = 0 THEN 1 END) as active_customers
FROM Customer
GROUP BY City, State
ORDER BY customer_count DESC;
```

#### 4. Work Order and Equipment Management
```sql
-- Work order completion rates by type
SELECT 
    wot.Description as work_order_type,
    COUNT(wo.id) as total_orders,
    COUNT(CASE WHEN wo.CompleteTime IS NOT NULL THEN 1 END) as completed_orders,
    AVG(wo.Price) as avg_price
FROM WorkOrderType wot
LEFT JOIN WorkOrder wo ON wot.id = wo.WorkOrderTypeId
WHERE wo.ServiceDate >= date('now', '-90 days')
GROUP BY wot.id, wot.Description;

-- Equipment and chemical usage patterns
SELECT 
    p.Name as product_name,
    pc.Description as category,
    COUNT(ii.id) as times_used,
    AVG(ii.Price) as avg_price
FROM Product p
JOIN ProductCategory pc ON p.ProductCategoryId = pc.id
JOIN InstalledItem ii ON p.id = ii.ProductId
WHERE ii.CreatedAt >= date('now', '-90 days')
GROUP BY p.id, p.Name, pc.Description
ORDER BY times_used DESC;
```

### Natural Language Test Queries

#### Business Intelligence Questions
1. **"What are our top 10 customers by revenue this year?"**
2. **"Show me the average service time per technician this month"**
3. **"Which cities have the most active customers?"**
4. **"What's our monthly revenue trend over the past year?"**
5. **"How many work orders are pending completion?"**
6. **"What chemicals are used most frequently?"**
7. **"Which routes have the highest skip rates?"**
8. **"Show me payment status breakdown for recent invoices"**
9. **"What's the average time between service visits per customer?"**
10. **"Which equipment items need the most maintenance?"**

#### Operational Questions
1. **"How many pools did we service yesterday?"**
2. **"What's the average invoice amount by service location?"**
3. **"Show me customers who haven't been serviced in 30 days"**
4. **"Which technicians completed the most stops last week?"**
5. **"What are the most common reasons for skipped stops?"**

### Chart Generation Test Cases

#### Dashboard Chart Suggestions
1. **Revenue Trend Line Chart**: Monthly revenue over time
2. **Customer Distribution Pie Chart**: Active vs Inactive customers by state
3. **Service Efficiency Bar Chart**: Average service time by technician
4. **Work Order Status Bar Chart**: Completed vs Pending work orders
5. **Product Usage Pie Chart**: Most frequently used chemicals/products
6. **Geographic Heat Map**: Customer concentration by city
7. **Payment Status Breakdown**: Invoice payment statuses
8. **Route Performance**: Completion rates by route/day

### Insights Generation Test Scenarios

#### Expected Business Insights Categories

**Trends:**
- Seasonal service patterns (summer vs winter)
- Revenue growth/decline patterns
- Customer acquisition/retention trends
- Equipment replacement cycles

**Anomalies:**
- Unusual spike in skipped stops
- Abnormal service times for specific locations
- Irregular payment patterns
- Equipment failure patterns

**Opportunities:**
- Underserviced geographic areas
- High-value customer segments
- Cross-selling opportunities (additional services)
- Route optimization potential

**Warnings:**
- Customers at risk of churn (long gaps between service)
- Overdue invoices requiring attention
- Equipment nearing replacement schedules
- Technician capacity constraints

### Performance Test Data Points

#### Expected Query Performance (AQPS.db - 54MB)
- Simple customer queries: < 100ms
- Route aggregation queries: < 500ms
- Revenue analysis queries: < 1s
- Complex multi-table JOINs: < 2s

#### Expected Query Performance (JOMO.sqlite - 140MB)  
- Simple customer queries: < 200ms
- Route aggregation queries: < 1s
- Revenue analysis queries: < 3s
- Complex multi-table JOINs: < 5s

### Error Handling Test Cases

#### Business Logic Errors
- Queries referencing non-existent date ranges
- Invalid customer/location references
- Malformed service date filters
- Division by zero in average calculations

#### Data Quality Scenarios
- NULL values in critical fields
- Orphaned records (customers without locations)
- Invalid geographic coordinates
- Negative monetary values

---

**Note**: These test scenarios are specifically designed for the pool service management domain represented in the AQPS.db and JOMO.sqlite databases.