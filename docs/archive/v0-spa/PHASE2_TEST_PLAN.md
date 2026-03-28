# Phase 2 AI Integration - Test Plan

**Date**: October 26, 2025  
**Version**: 2.0  
**Status**: Ready for Testing

---

## Overview

This test plan covers the Phase 2 AI Integration features that enhance the system with relationship-aware query generation and intelligent schema context.

### What Changed in Phase 2

1. **useInsightGenerator.js** - Enhanced with schema metadata for multi-table insights
2. **AIQueryInterface.jsx** - Added intelligent query routing based on question analysis
3. **Schema Metadata System** - New utility providing relationship intelligence to AI

---

## Pre-Test Setup

### Prerequisites
- ✅ Node.js and npm installed
- ✅ OpenAI API key configured in Settings
- ✅ Test databases available (AQPS.db or JOMO.sqlite)
- ✅ Development server running (`npm run dev`)

### Test Data
- **AQPS.db**: 1,874 customers, 2,091 pools, 2,935 recent route stops
- **JOMO.sqlite**: 3,797 customers, 4,117 pools, 7,115 recent route stops

---

## Test Suite 1: Enhanced AI Insights

### Test 1.1: Generate AI Insights with Relationships
**Objective**: Verify AI insights now include multi-table queries with proper JOINs

**Steps**:
1. Upload test database (AQPS.db or JOMO.sqlite)
2. Configure OpenAI API key in Settings
3. Navigate to Insights tab
4. Click "Generate AI Insights" button
5. Wait for insights to generate

**Expected Results**:
- ✅ 5 insights generated successfully
- ✅ Insights include multi-table queries (e.g., Customer→ServiceLocation→Invoice)
- ✅ SQL queries show proper JOIN statements
- ✅ Queries use foreign keys (CustomerId, ServiceLocationId, etc.)
- ✅ Each insight has title, description, query, impact level, type
- ✅ Insights are business-focused (revenue, efficiency, service quality)

**Sample Expected Insight**:
```
Title: "Customer Lifetime Value Analysis"
Query: SELECT c.*, SUM(i.Total) FROM Customer c 
       JOIN ServiceLocation sl ON c.id = sl.CustomerId
       JOIN InvoiceLocation il ON sl.id = il.ServiceLocationId
       JOIN Invoice i ON il.InvoiceId = i.id
       GROUP BY c.id
```

---

### Test 1.2: Verify Insight Query Execution
**Objective**: Confirm generated insight queries execute successfully

**Steps**:
1. After generating insights, review each insight card
2. Check that data is displayed for each insight
3. Verify row counts are shown
4. Check for any query errors

**Expected Results**:
- ✅ All insight queries execute without errors
- ✅ Each insight shows actual data (not just the query)
- ✅ Row counts are accurate
- ✅ No SQL syntax errors
- ✅ JOIN operations return meaningful results

---

## Test Suite 2: Intelligent AI Query Interface

### Test 2.1: Customer-Related Queries
**Objective**: Test AI's ability to generate customer analysis queries

**Test Cases**:

#### 2.1a: Customer Count Query
- **Question**: "How many active customers have pools that are 10000 gallons?"
- **Expected SQL**:
  ```sql
  SELECT COUNT(DISTINCT c.id) 
  FROM Customer c
  JOIN ServiceLocation sl ON c.id = sl.CustomerId
  JOIN Pool p ON sl.id = p.ServiceLocationId
  WHERE c.IsInactive = 0 AND p.Gallons = 10000
  ```
- **Expected Result**: Number (e.g., 11 customers)
- **Export Test**: Click CSV export button, verify download

#### 2.1b: Customer Details Query
- **Question**: "Show me top 10 customers by revenue"
- **Expected SQL**: Should include Customer→ServiceLocation→Invoice joins
- **Expected Result**: Table with customer names and revenue totals
- **Export Test**: Click PDF export button, verify download

#### 2.1c: Multi-Location Customers
- **Question**: "List customers with multiple service locations"
- **Expected SQL**: 
  ```sql
  SELECT c.*, COUNT(sl.id) as location_count
  FROM Customer c
  JOIN ServiceLocation sl ON c.id = sl.CustomerId
  GROUP BY c.id
  HAVING COUNT(sl.id) > 1
  ```
- **Expected Result**: Customers with location_count > 1

---

### Test 2.2: Technician Performance Queries
**Objective**: Verify AI can generate operational efficiency queries

**Test Cases**:

#### 2.2a: Technician Efficiency
- **Question**: "Which technicians completed the most service stops last month?"
- **Expected SQL**: Should include Account→RouteStop joins with date filters
- **Expected Result**: List of technicians with stop counts
- **Verify**: Date filtering works (last 30 days)

#### 2.2b: Route Completion Rates
- **Question**: "Show technician completion rates for the last week"
- **Expected SQL**: RouteStop with completion status
- **Expected Result**: Technicians with percentage completed

---

### Test 2.3: Chemical Usage Queries
**Objective**: Test service operation queries with chemical data

**Test Cases**:

#### 2.3a: Chemical Usage by Pool
- **Question**: "Show pools that received the most chlorine in the last 30 days"
- **Expected SQL**:
  ```sql
  SELECT p.*, SUM(sse.Value) as total_chlorine
  FROM Pool p
  JOIN ServiceStop ss ON p.id = ss.PoolId
  JOIN ServiceStopEntry sse ON ss.id = sse.ServiceStopId
  JOIN EntryDescription ed ON sse.EntryDescriptionId = ed.id
  WHERE ed.Description LIKE '%chlorine%'
  AND sse.ServiceDate >= date('now', '-30 days')
  GROUP BY p.id
  ORDER BY total_chlorine DESC
  ```
- **Expected Result**: Pools with chlorine usage totals

#### 2.3b: Chemical Readings Outside Normal Range
- **Question**: "Show service stops with chemical readings outside normal range"
- **Expected SQL**: ServiceStop→ServiceStopEntry with value filters
- **Expected Result**: Service records with abnormal readings

---

### Test 2.4: Work Order Queries
**Objective**: Test work order and maintenance queries

**Test Cases**:

#### 2.4a: Common Work Order Types
- **Question**: "What are the most common work order types?"
- **Expected SQL**:
  ```sql
  SELECT wot.Description, COUNT(*) as count
  FROM WorkOrder wo
  JOIN WorkOrderType wot ON wo.WorkOrderTypeId = wot.id
  GROUP BY wot.Description
  ORDER BY count DESC
  ```
- **Expected Result**: Work order types with counts

#### 2.4b: Pending Work Orders
- **Question**: "Show all incomplete work orders"
- **Expected SQL**: WorkOrder with CompleteTime IS NULL filter
- **Expected Result**: List of open work orders

---

## Test Suite 3: Query Routing Intelligence

### Test 3.1: Revenue Query Routing
**Objective**: Verify suggestQueryApproach() detects revenue queries

**Test**:
1. Ask: "Show me customer revenue"
2. Check browser console for routing decision
3. Verify AI receives revenue-specific guidance

**Expected**:
- Console shows: `approach: 'revenue_analysis'`
- Join path: `customerToRevenue`
- Query includes Customer→Invoice chain

---

### Test 3.2: Performance Query Routing
**Objective**: Verify routing for technician/performance queries

**Test**:
1. Ask: "How efficient are my technicians?"
2. Check console for routing decision

**Expected**:
- Console shows: `approach: 'technician_performance'`
- Join path: `technicianPerformance`
- Query includes Account→RouteStop→ServiceStop

---

### Test 3.3: Equipment Query Routing
**Objective**: Verify routing for equipment queries

**Test**:
1. Ask: "Which equipment fails most often?"
2. Check console for routing decision

**Expected**:
- Console shows: `approach: 'equipment_analysis'`
- Join path: `equipmentLifecycle`
- Query includes EquipmentItem→InstalledItem

---

## Test Suite 4: Export Functionality

### Test 4.1: CSV Export
**Objective**: Verify CSV export works with multi-table results

**Steps**:
1. Execute any query that returns results
2. Click CSV export button (📥)
3. Check downloaded file

**Expected Results**:
- ✅ CSV file downloads with timestamp filename
- ✅ File opens correctly in Excel/Sheets
- ✅ All columns are present with headers
- ✅ Data is properly formatted
- ✅ Special characters are escaped correctly
- ✅ UTF-8 encoding works (no garbled text)

---

### Test 4.2: PDF Export
**Objective**: Verify PDF export includes query details

**Steps**:
1. Execute query: "Show top 10 customers by revenue"
2. Click PDF export button (📄)
3. Open downloaded PDF

**Expected Results**:
- ✅ PDF includes original question
- ✅ PDF includes SQL query
- ✅ PDF includes results summary (row count)
- ✅ PDF includes data table (up to 50 rows)
- ✅ PDF is formatted and readable
- ✅ Page numbers present

---

## Test Suite 5: Edge Cases & Error Handling

### Test 5.1: No API Key
**Test
