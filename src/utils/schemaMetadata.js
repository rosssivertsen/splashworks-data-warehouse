/**
 * Skimmer Database Schema Metadata
 * 
 * This module provides comprehensive relationship information for the Skimmer database
 * to enable intelligent, relationship-aware AI query generation.
 * 
 * Key Features:
 * - Foreign key relationships with cardinality
 * - Join path suggestions for common queries
 * - Business context for each table
 * - Query templates for multi-table operations
 */

// ============================================================================
// TABLE DEFINITIONS WITH BUSINESS CONTEXT
// ============================================================================

export const tables = {
  // Core Business Entities
  Company: {
    primaryKey: 'id',
    description: 'Root entity representing the pool service business',
    businessContext: 'Multi-tenant isolation - all other tables reference CompanyId',
    commonFilters: ['ActiveUntil > current_date'],
    relationships: ['Customer', 'Account', 'CompanySetting']
  },
  
  Customer: {
    primaryKey: 'id',
    description: 'Pool service customers (residential or commercial)',
    businessContext: 'Revenue source, can have multiple service locations',
    commonFilters: ['IsInactive = 0', 'CompanyId = ?'],
    relationships: ['ServiceLocation', 'Invoice', 'Payment', 'CustomerTag'],
    keyMetrics: ['lifetime_revenue', 'location_count', 'payment_history']
  },
  
  ServiceLocation: {
    primaryKey: 'id',
    description: 'Physical addresses where pool service is performed',
    businessContext: 'Core operational unit - where service happens',
    commonFilters: ['CompanyId = ?'],
    relationships: ['Customer', 'Pool', 'RouteAssignment', 'RouteStop', 'WorkOrder', 'InvoiceLocation'],
    keyMetrics: ['service_frequency', 'revenue_per_location', 'pool_count']
  },
  
  Pool: {
    primaryKey: 'id',
    description: 'Individual pools/bodies of water at a service location',
    businessContext: 'Service target - chemical calculations based on gallons',
    commonFilters: ['CompanyId = ?'],
    relationships: ['ServiceLocation', 'EquipmentItem', 'ServiceStop', 'ServiceStopEntry'],
    keyMetrics: ['chemical_usage', 'maintenance_frequency', 'equipment_age']
  },
  
  Account: {
    primaryKey: 'id',
    description: 'Technicians and administrators',
    businessContext: 'Users who perform service and manage operations',
    commonFilters: ['IsActive = 1', 'CompanyId = ?'],
    relationships: ['Company', 'RouteAssignment', 'RouteStop', 'WorkOrder'],
    keyMetrics: ['stops_per_day', 'revenue_generated', 'customer_satisfaction']
  },
  
  // Scheduling & Routing
  RouteAssignment: {
    primaryKey: 'id',
    description: 'Regular recurring service schedule',
    businessContext: 'Generates RouteStop records based on frequency',
    commonFilters: ['Status = "Active"', 'EndDate IS NULL OR EndDate >= date("now")'],
    relationships: ['ServiceLocation', 'Account', 'RouteStop', 'RouteSkip', 'RouteMove'],
    keyMetrics: ['schedule_adherence', 'route_efficiency']
  },
  
  RouteStop: {
    primaryKey: 'id',
    description: 'Individual service visits',
    businessContext: 'Daily operational unit - technician visits',
    commonFilters: ['CompanyId = ?', 'ServiceDate >= date("now", "-30 days")'],
    relationships: ['Account', 'ServiceLocation', 'RouteAssignment', 'ServiceStop', 'SkippedStopReason'],
    keyMetrics: ['completion_rate', 'time_at_stop', 'skip_rate']
  },
  
  ServiceStop: {
    primaryKey: 'id',
    description: 'Service record for a specific pool',
    businessContext: 'Per-pool service details within a visit',
    commonFilters: ['CompanyId = ?'],
    relationships: ['RouteStop', 'Pool', 'ServiceStopEntry', 'InstalledItem'],
    keyMetrics: ['chemical_balance', 'alert_frequency']
  },
  
  ServiceStopEntry: {
    primaryKey: 'id',
    description: 'Individual readings, chemicals, observations',
    businessContext: 'Detailed service data - pH, chlorine, chemicals added',
    commonFilters: ['CompanyId = ?', 'ServiceDate >= date("now", "-30 days")'],
    relationships: ['ServiceStop', 'Pool', 'EntryDescription', 'WorkOrder'],
    keyMetrics: ['reading_trends', 'chemical_consumption', 'dosage_accuracy']
  },
  
  // Work Orders
  WorkOrder: {
    primaryKey: 'id',
    description: 'Repair and maintenance work orders',
    businessContext: 'Non-routine work - repairs, green pool, equipment issues',
    commonFilters: ['CompanyId = ?', 'CompleteTime IS NULL'],
    relationships: ['WorkOrderType', 'ServiceLocation', 'Account', 'InstalledItem', 'ShoppingListItem', 'InvoiceItem'],
    keyMetrics: ['completion_time', 'profitability', 'recurrence']
  },
  
  // Billing & Revenue
  Invoice: {
    primaryKey: 'id',
    description: 'Customer billing documents',
    businessContext: 'Revenue tracking - combines service and work orders',
    commonFilters: ['Status != "Void"', 'CompanyId = ?'],
    relationships: ['Customer', 'InvoiceLocation', 'InvoiceItem', 'Payment'],
    keyMetrics: ['collection_rate', 'average_invoice', 'aging']
  },
  
  InvoiceItem: {
    primaryKey: 'id',
    description: 'Line items on invoices',
    businessContext: 'Revenue detail - what was charged',
    commonFilters: ['CompanyId = ?'],
    relationships: ['InvoiceLocation', 'RouteStop', 'WorkOrder', 'Product', 'EntryDescription'],
    keyMetrics: ['profit_margin', 'item_mix']
  },
  
  Payment: {
    primaryKey: 'id',
    description: 'Customer payments received',
    businessContext: 'Cash flow tracking',
    commonFilters: ['Status = "Succeeded"', 'CompanyId = ?'],
    relationships: ['Customer', 'Invoice'],
    keyMetrics: ['payment_speed', 'failure_rate', 'method_preference']
  },
  
  // Equipment & Parts
  EquipmentItem: {
    primaryKey: 'id',
    description: 'Pool equipment inventory',
    businessContext: 'Maintenance tracking - pumps, filters, heaters',
    commonFilters: ['SoftDeleted = 0', 'CompanyId = ?'],
    relationships: ['Pool', 'PartCategory', 'PartMake', 'PartModel', 'InstalledItem', 'ShoppingListItem'],
    keyMetrics: ['lifespan', 'failure_rate', 'replacement_cost']
  },
  
  InstalledItem: {
    primaryKey: 'id',
    description: 'Parts/equipment installed during service',
    businessContext: 'Tracks what was installed and billed',
    commonFilters: ['CompanyId = ?'],
    relationships: ['ServiceStop', 'WorkOrder', 'EquipmentItem', 'Chemical', 'Product', 'InvoiceItem'],
    keyMetrics: ['installation_frequency', 'part_costs']
  }
};

// ============================================================================
// FOREIGN KEY RELATIONSHIPS
// ============================================================================

export const foreignKeys = [
  // Format: { table, column, references, cardinality, required }
  
  // Core Business Entities
  { table: 'Customer', column: 'CompanyId', references: 'Company', cardinality: 'many:1', required: true },
  { table: 'ServiceLocation', column: 'CustomerId', references: 'Customer', cardinality: 'many:1', required: true },
  { table: 'ServiceLocation', column: 'CompanyId', references: 'Company', cardinality: 'many:1', required: true },
  { table: 'Pool', column: 'ServiceLocationId', references: 'ServiceLocation', cardinality: 'many:1', required: true },
  { table: 'Pool', column: 'CompanyId', references: 'Company', cardinality: 'many:1', required: true },
  { table: 'Account', column: 'CompanyId', references: 'Company', cardinality: 'many:1', required: true },
  
  // Scheduling
  { table: 'RouteAssignment', column: 'ServiceLocationId', references: 'ServiceLocation', cardinality: 'many:1', required: true },
  { table: 'RouteAssignment', column: 'AccountId', references: 'Account', cardinality: 'many:1', required: true },
  { table: 'RouteStop', column: 'AccountId', references: 'Account', cardinality: 'many:1', required: true },
  { table: 'RouteStop', column: 'ServiceLocationId', references: 'ServiceLocation', cardinality: 'many:1', required: true },
  { table: 'RouteStop', column: 'RouteAssignmentId', references: 'RouteAssignment', cardinality: 'many:1', required: true },
  { table: 'RouteStop', column: 'SkippedStopReasonId', references: 'SkippedStopReason', cardinality: 'many:1', required: false },
  
  // Service Operations
  { table: 'ServiceStop', column: 'RouteStopId', references: 'RouteStop', cardinality: 'many:1', required: true },
  { table: 'ServiceStop', column: 'PoolId', references: 'Pool', cardinality: 'many:1', required: true },
  { table: 'ServiceStopEntry', column: 'ServiceStopId', references: 'ServiceStop', cardinality: 'many:1', required: true },
  { table: 'ServiceStopEntry', column: 'PoolId', references: 'Pool', cardinality: 'many:1', required: true },
  { table: 'ServiceStopEntry', column: 'EntryDescriptionId', references: 'EntryDescription', cardinality: 'many:1', required: true },
  { table: 'ServiceStopEntry', column: 'WorkOrderId', references: 'WorkOrder', cardinality: 'many:1', required: false },
  
  // Work Orders
  { table: 'WorkOrder', column: 'WorkOrderTypeId', references: 'WorkOrderType', cardinality: 'many:1', required: true },
  { table: 'WorkOrder', column: 'ServiceLocationId', references: 'ServiceLocation', cardinality: 'many:1', required: true },
  { table: 'WorkOrder', column: 'AccountId', references: 'Account', cardinality: 'many:1', required: false },
  { table: 'WorkOrder', column: 'AddedByAccountId', references: 'Account', cardinality: 'many:1', required: true },
  
  // Billing
  { table: 'Invoice', column: 'CustomerId', references: 'Customer', cardinality: 'many:1', required: true },
  { table: 'InvoiceLocation', column: 'InvoiceId', references: 'Invoice', cardinality: 'many:1', required: true },
  { table: 'InvoiceLocation', column: 'ServiceLocationId', references: 'ServiceLocation', cardinality: 'many:1', required: true },
  { table: 'InvoiceLocation', column: 'TaxGroupId', references: 'TaxGroup', cardinality: 'many:1', required: false },
  { table: 'InvoiceItem', column: 'InvoiceLocationId', references: 'InvoiceLocation', cardinality: 'many:1', required: true },
  { table: 'InvoiceItem', column: 'RouteStopId', references: 'RouteStop', cardinality: 'many:1', required: false },
  { table: 'InvoiceItem', column: 'WorkOrderId', references: 'WorkOrder', cardinality: 'many:1', required: false },
  { table: 'InvoiceItem', column: 'ProductId', references: 'Product', cardinality: 'many:1', required: false },
  { table: 'Payment', column: 'CustomerId', references: 'Customer', cardinality: 'many:1', required: true },
  { table: 'Payment', column: 'InvoiceId', references: 'Invoice', cardinality: 'many:1', required: true },
  
  // Equipment
  { table: 'EquipmentItem', column: 'PoolId', references: 'Pool', cardinality: 'many:1', required: true },
  { table: 'EquipmentItem', column: 'PartCategoryId', references: 'PartCategory', cardinality: 'many:1', required: false },
  { table: 'EquipmentItem', column: 'PartMakeId', references: 'PartMake', cardinality: 'many:1', required: false },
  { table: 'EquipmentItem', column: 'PartModelId', references: 'PartModel', cardinality: 'many:1', required: false },
  { table: 'InstalledItem', column: 'ServiceStopId', references: 'ServiceStop', cardinality: 'many:1', required: false },
  { table: 'InstalledItem', column: 'WorkOrderId', references: 'WorkOrder', cardinality: 'many:1', required: false },
  { table: 'InstalledItem', column: 'EquipmentItemId', references: 'EquipmentItem', cardinality: 'many:1', required: false },
  { table: 'InstalledItem', column: 'ChemicalId', references: 'Chemical', cardinality: 'many:1', required: false },
  { table: 'InstalledItem', column: 'ProductId', references: 'Product', cardinality: 'many:1', required: false },
};

// ============================================================================
// COMMON JOIN PATHS (FOR AI QUERY GENERATION)
// ============================================================================

export const joinPaths = {
  customerToRevenue: {
    description: 'Customer → ServiceLocation → InvoiceLocation → Invoice → Payment',
    tables: ['Customer', 'ServiceLocation', 'InvoiceLocation', 'Invoice', 'Payment'],
    joins: [
      'ServiceLocation ON Customer.id = ServiceLocation.CustomerId',
      'InvoiceLocation ON ServiceLocation.id = InvoiceLocation.ServiceLocationId',
      'Invoice ON InvoiceLocation.InvoiceId = Invoice.id',
      'Payment ON Invoice.id = Payment.InvoiceId'
    ],
    useCase: 'Calculate customer lifetime value, revenue analysis'
  },
  
  technicianPerformance: {
    description: 'Account → RouteStop → ServiceStop → ServiceStopEntry',
    tables: ['Account', 'RouteStop', 'ServiceStop', 'ServiceStopEntry'],
    joins: [
      'RouteStop ON Account.id = RouteStop.AccountId',
      'ServiceStop ON RouteStop.id = ServiceStop.RouteStopId',
      'ServiceStopEntry ON ServiceStop.id = ServiceStopEntry.ServiceStopId'
    ],
    useCase: 'Technician efficiency, service quality metrics'
  },
  
  serviceToInvoice: {
    description: 'RouteStop → ServiceStop → InvoiceItem → InvoiceLocation → Invoice',
    tables: ['RouteStop', 'ServiceStop', 'InvoiceItem', 'InvoiceLocation', 'Invoice'],
    joins: [
      'ServiceStop ON RouteStop.id = ServiceStop.RouteStopId',
      'InvoiceItem ON RouteStop.id = InvoiceItem.RouteStopId',
      'InvoiceLocation ON InvoiceItem.InvoiceLocationId = InvoiceLocation.id',
      'Invoice ON InvoiceLocation.InvoiceId = Invoice.id'
    ],
    useCase: 'Service revenue tracking, billing analysis'
  },
  
  workOrderToRevenue: {
    description: 'WorkOrder → InstalledItem → InvoiceItem → Invoice',
    tables: ['WorkOrder', 'InstalledItem', 'InvoiceItem', 'InvoiceLocation', 'Invoice'],
    joins: [
      'InstalledItem ON WorkOrder.id = InstalledItem.WorkOrderId',
      'InvoiceItem ON WorkOrder.id = InvoiceItem.WorkOrderId',
      'InvoiceLocation ON InvoiceItem.InvoiceLocationId = InvoiceLocation.id',
      'Invoice ON InvoiceLocation.InvoiceId = Invoice.id'
    ],
    useCase: 'Work order profitability, repair revenue'
  },
  
  equipmentLifecycle: {
    description: 'Pool → EquipmentItem → InstalledItem → InvoiceItem',
    tables: ['Pool', 'EquipmentItem', 'InstalledItem', 'InvoiceItem'],
    joins: [
      'EquipmentItem ON Pool.id = EquipmentItem.PoolId',
      'InstalledItem ON EquipmentItem.id = InstalledItem.EquipmentItemId',
      'InvoiceItem ON InstalledItem.id = InvoiceItem.InstalledItemId'
    ],
    useCase: 'Equipment replacement tracking, maintenance costs'
  },
  
  chemicalUsage: {
    description: 'Pool → ServiceStop → ServiceStopEntry → EntryDescription',
    tables: ['Pool', 'ServiceStop', 'ServiceStopEntry', 'EntryDescription'],
    joins: [
      'ServiceStop ON Pool.id = ServiceStop.PoolId',
      'ServiceStopEntry ON ServiceStop.id = ServiceStopEntry.ServiceStopId',
      'EntryDescription ON ServiceStopEntry.EntryDescriptionId = EntryDescription.id'
    ],
    useCase: 'Chemical consumption trends, dosage analysis'
  },
  
  customerService: {
    description: 'Customer → ServiceLocation → Pool → ServiceStop',
    tables: ['Customer', 'ServiceLocation', 'Pool', 'RouteStop', 'ServiceStop'],
    joins: [
      'ServiceLocation ON Customer.id = ServiceLocation.CustomerId',
      'Pool ON ServiceLocation.id = Pool.ServiceLocationId',
      'RouteStop ON ServiceLocation.id = RouteStop.ServiceLocationId',
      'ServiceStop ON Pool.id = ServiceStop.PoolId AND RouteStop.id = ServiceStop.RouteStopId'
    ],
    useCase: 'Customer service history, quality metrics'
  }
};

// ============================================================================
// QUERY TEMPLATES FOR COMMON BUSINESS QUESTIONS
// ============================================================================

export const queryTemplates = {
  customerLifetimeValue: {
    description: 'Calculate total revenue per customer',
    template: `
      SELECT 
        c.id,
        c.FirstName || ' ' || c.LastName as CustomerName,
        COUNT(DISTINCT i.id) as invoice_count,
        SUM(i.Total) as lifetime_revenue,
        AVG(i.Total) as avg_invoice,
        MIN(i.InvoiceDate) as first_invoice,
        MAX(i.InvoiceDate) as last_invoice
      FROM Customer c
      LEFT JOIN Invoice i ON c.id = i.CustomerId
      WHERE i.Status != 'Void'
        AND c.CompanyId = ?
      GROUP BY c.id
      ORDER BY lifetime_revenue DESC
    `,
    parameters: ['companyId'],
    returnType: 'aggregation'
  },
  
  technicianEfficiency: {
    description: 'Daily stops completed and time metrics by technician',
    template: `
      SELECT 
        a.FirstName || ' ' || a.LastName as Technician,
        DATE(rs.ServiceDate) as Date,
        COUNT(*) as stops_completed,
        SUM(rs.MinutesAtStop) as total_minutes,
        AVG(rs.MinutesAtStop) as avg_time_per_stop,
        SUM(CASE WHEN rs.IsSkipped = 1 THEN 1 ELSE 0 END) as skipped_count
      FROM RouteStop rs
      JOIN Account a ON rs.AccountId = a.id
      WHERE rs.CompleteTime IS NOT NULL
        AND rs.ServiceDate >= date('now', ?)
        AND rs.CompanyId = ?
      GROUP BY a.id, DATE(rs.ServiceDate)
      ORDER BY Date DESC, Technician
    `,
    parameters: ['daysBack', 'companyId'],
    returnType: 'timeSeries'
  },
  
  chemicalUsageTrends: {
    description: 'Chemical consumption over time',
    template: `
      SELECT 
        ed.Description as Chemical,
        strftime('%Y-%m', sse.ServiceDate) as Month,
        SUM(sse.Value) as total_used,
        ed.UnitOfMeasure,
        COUNT(DISTINCT sse.PoolId) as pools_serviced,
        COUNT(*) as application_count
      FROM ServiceStopEntry sse
      JOIN EntryDescription ed ON sse.EntryDescriptionId = ed.id
      WHERE ed.EntryType = 'Dosage'
        AND sse.ServiceDate >= date('now', ?)
        AND sse.CompanyId = ?
      GROUP BY ed.Description, strftime('%Y-%m', sse.ServiceDate)
      ORDER BY Month DESC, total_used DESC
    `,
    parameters: ['daysBack', 'companyId'],
    returnType: 'timeSeries'
  },
  
  revenueByServiceType: {
    description: 'Break down revenue by service type',
    template: `
      SELECT 
        CASE 
          WHEN ii.RouteStopId IS NOT NULL THEN 'Regular Service'
          WHEN ii.WorkOrderId IS NOT NULL THEN 'Work Orders'
          WHEN ii.ProductId IS NOT NULL THEN 'Product Sales'
          ELSE 'Other'
        END as ServiceType,
        COUNT(*) as item_count,
        SUM(ii.Amount) as total_revenue,
        AVG(ii.Amount) as avg_amount,
        SUM(ii.Amount - (ii.Cost * ii.Quantity)) as gross_profit
      FROM InvoiceItem ii
      JOIN InvoiceLocation il ON ii.InvoiceLocationId = il.id
      JOIN Invoice i ON il.InvoiceId = i.id
      WHERE i.Status != 'Void'
        AND i.InvoiceDate >= date('now', ?)
        AND i.CompanyId = ?
      GROUP BY ServiceType
      ORDER BY total_revenue DESC
    `,
    parameters: ['daysBack', 'companyId'],
    returnType: 'aggregation'
  },
  
  equipmentFailureRate: {
    description: 'Equipment types with highest replacement frequency',
    template: `
      SELECT 
        pc.Description as EquipmentType,
        pm.Description as Manufacturer,
        COUNT(*) as replacement_count,
        AVG(julianday(ii.CreatedAt) - julianday(ei.CreatedAt)) as avg_lifespan_days,
        SUM(ii.Price) as replacement_revenue
      FROM InstalledItem ii
      JOIN EquipmentItem ei ON ii.EquipmentItemId = ei.id
      JOIN PartCategory pc ON ei.PartCategoryId = pc.id
      LEFT JOIN PartMake pm ON ei.PartMakeId = pm.id
      WHERE ii.ItemType = 'Equipment'
        AND ii.PreviousStatus = 'Replaced'
        AND ii.CompanyId = ?
      GROUP BY pc.Description, pm.Description
      ORDER BY replacement_count DESC
    `,
    parameters: ['companyId'],
    returnType: 'aggregation'
  },
  
  outstandingInvoices: {
    description: 'Accounts receivable aging report',
    template: `
      SELECT 
        i.*,
        c.FirstName || ' ' || c.LastName as CustomerName,
        c.PrimaryEmail,
        julianday('now') - julianday(i.DueDate) as days_overdue,
        CASE 
          WHEN julianday('now') - julianday(i.DueDate) <= 30 THEN 'Current'
          WHEN julianday('now') - julianday(i.DueDate) <= 60 THEN '30-60 Days'
          WHEN julianday('now') - julianday(i.DueDate) <= 90 THEN '60-90 Days'
          ELSE '90+ Days'
        END as aging_bucket
      FROM Invoice i
      JOIN Customer c ON i.CustomerId = c.id
      WHERE i.PaymentStatus != 'Paid'
        AND i.Status != 'Void'
        AND i.CompanyId = ?
      ORDER BY days_overdue DESC
    `,
    parameters: ['companyId'],
    returnType: 'detail'
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all tables that a given table is related to
 * @param {string} tableName - Name of the table
 * @returns {string[]} - Array of related table names
 */
export function getRelatedTables(tableName) {
  const table = tables[tableName];
  return table ? table.relationships || [] : [];
}

/**
 * Find foreign keys for a given table
 * @param {string} tableName - Name of the table
 * @returns {Array} - Array of foreign key definitions
 */
export function getForeignKeys(tableName) {
  return foreignKeys.filter(fk => fk.table === tableName);
}

/**
 * Get business context for a table
 * @param {string} tableName - Name of the table
 * @returns {Object|null} - Table metadata or null if not found
 */
export function getTableContext(tableName) {
  return tables[tableName] || null;
}

/**
 * Get suggested join path for a use case
 * @param {string} useCase - The use case keyword (e.g., 'revenue', 'performance')
 * @returns {Object|null} - Join path definition or null
 */
export function getJoinPathForUseCase(useCase) {
  const lowerCase = useCase.toLowerCase();
  for (const [key, path] of Object.entries(joinPaths)) {
    if (path.useCase.toLowerCase().includes(lowerCase) || 
        path.description.toLowerCase().includes(lowerCase)) {
      return path;
    }
  }
  return null;
}

/**
 * Build schema context string for AI prompts
 * @param {Object} database - SQL.js database instance
 * @returns {string} - Formatted schema with relationships
 */
export function buildEnhancedSchemaContext(database) {
  let context = 'Database Schema with Relationships:\n\n';
  
  try {
    const tablesResult = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
    if (tablesResult.length === 0) return context;
    
    tablesResult[0].values.forEach(([tableName]) => {
      context += `Table: ${tableName}\n`;
      
      // Add business context if available
      const tableInfo = tables[tableName];
      if (tableInfo) {
        context += `  Purpose: ${tableInfo.description}\n`;
        context += `  Business Context: ${tableInfo.businessContext}\n`;
      }
      
      // Add columns
      try {
        const columns = database.exec(`PRAGMA table_info(${tableName})`);
        if (columns.length > 0) {
          context += '  Columns:\n';
          columns[0].values.forEach(([, name, type, notNull, defaultValue, pk]) => {
            context += `    - ${name} (${type})`;
            if (pk) context += ' PRIMARY KEY';
            if (notNull) context += ' NOT NULL';
            context += '\n';
          });
        }
      } catch (err) {
        console.error(`Error getting columns for ${tableName}:`, err);
      }
      
      // Add foreign key relationships
      const fks = getForeignKeys(tableName);
      if (fks.length > 0) {
        context += '  Foreign Keys:\n';
        fks.forEach(fk => {
          context += `    - ${fk.column} → ${fk.references} (${fk.cardinality})`;
          if (fk.required) context += ' REQUIRED';
          context += '\n';
        });
      }
      
      // Add related tables
      if (tableInfo && tableInfo.relationships) {
        context += `  Related Tables: ${tableInfo.relationships.join(', ')}\n`;
      }
      
      context += '\n';
    });
    
    // Add common join paths
    context += '\n=== Common Query Patterns ===\n\n';
    Object.entries(joinPaths).forEach(([key, path]) => {
      context += `${key}:\n`;
      context += `  Use Case: ${path.useCase}\n`;
      context += `  Path: ${path.description}\n`;
      context += `  Tables: ${path.tables.join(' → ')}\n\n`;
    });
    
  } catch (error) {
    console.error('Error building schema context:', error);
  }
  
  return context;
}

/**
 * Generate SQL query suggestions based on user question
 * @param {string} question - User's natural language question
 * @returns {Object} - Suggested query approach
 */
export function suggestQueryApproach(question) {
  const lowerQuestion = question.toLowerCase();
  
  // Check for revenue-related queries
  if (lowerQuestion.includes('revenue') || lowerQuestion.includes('income') || 
      lowerQuestion.includes('sales') || lowerQuestion.includes('payment')) {
    return {
      approach: 'revenue_analysis',
      joinPath: joinPaths.customerToRevenue,
      suggestedTemplate: queryTemplates.customerLifetimeValue,
      tables: ['Customer', 'Invoice', 'InvoiceItem', 'Payment']
    };
  }
  
  // Check for technician/performance queries
  if (lowerQuestion.includes('technician') || lowerQuestion.includes('route') ||
      lowerQuestion.includes('efficiency') || lowerQuestion.includes('performance')) {
    return {
      approach: 'technician_performance',
      joinPath: joinPaths.technicianPerformance,
      suggestedTemplate: queryTemplates.technicianEfficiency,
      tables: ['Account', 'RouteStop', 'ServiceStop']
    };
  }
  
  // Check for chemical/service queries
  if (lowerQuestion.includes('chemical') || lowerQuestion.includes('chlorine') ||
      lowerQuestion.includes('ph') || lowerQuestion.includes('dosage')) {
    return {
      approach: 'chemical_analysis',
      joinPath: joinPaths.chemicalUsage,
      suggestedTemplate: queryTemplates.chemicalUsageTrends,
      tables: ['Pool', 'ServiceStop', 'ServiceStopEntry', 'EntryDescription']
    };
  }
  
  // Check for equipment queries
  if (lowerQuestion.includes('equipment') || lowerQuestion.includes('pump') ||
      lowerQuestion.includes('filter') || lowerQuestion.includes('repair')) {
    return {
      approach: 'equipment_analysis',
      joinPath: joinPaths.equipmentLifecycle,
      suggestedTemplate: queryTemplates.equipmentFailureRate,
      tables: ['EquipmentItem', 'InstalledItem', 'WorkOrder']
    };
  }
  
  // Check for customer queries
  if (lowerQuestion.includes('customer') || lowerQuestion.includes('client')) {
    return {
      approach: 'customer_analysis',
      joinPath: joinPaths.customerService,
      suggestedTemplate: queryTemplates.customerLifetimeValue,
      tables: ['Customer', 'ServiceLocation', 'Invoice']
    };
  }
  
  // Default: general query
  return {
    approach: 'general',
    joinPath: null,
    suggestedTemplate: null,
    tables: []
  };
}
