# Semantic Layer Integration

## Overview

The semantic layer is a business-oriented abstraction layer that sits between the raw database schema and the AI query generation system. It provides business context, metrics, verified queries, and domain-specific patterns to dramatically improve AI query results.

## Architecture

```
User Question
     ↓
AIQueryInterface → buildEnhancedSchemaContext(database, question)
     ↓                           ↓
     ↓                    schemaMetadata.js
     ↓                           ↓
     ↓                    buildSemanticContext(question)
     ↓                           ↓
     ↓                    semanticLayer.js
     ↓                           ↓
     ↓                    skimmer-semantic-layer.yaml
     ↓                           ↓
     ↓←──────────────────────────┘
     ↓
AI (GPT-3.5) with enriched context
     ↓
SQL Query with proper JOINs and business logic
```

## Components

### 1. Semantic Layer YAML (`docs/skimmer-semantic-layer.yaml`)

The source of truth for business knowledge, containing:

- **Business Terms**: Natural language mappings with SQL patterns
  - Example: "chlorine_usage" → `WHERE Description LIKE '%Chlorine%'`
  - Includes synonyms for flexible matching
  - Specifies required tables and units
  - Documents recurrence patterns (e.g., filter cleaning every 4 weeks)

- **Metrics**: KPI definitions with formulas and targets
  - Example: "filter_maintenance_compliance" → 95%+ target
  - Data availability indicators (✅ AVAILABLE, ❌ NOT AVAILABLE, ⚠️ PARTIAL)
  - Business context for interpretation

- **Verified Queries**: Pre-validated SQL with expected results
  - Tested against real production data
  - Documented business logic rules
  - Expected result columns specified

- **Relationships**: Extended join path documentation
  - Common business query patterns
  - Multi-table relationship chains
  - Usage examples

- **LSI Calculation**: Water chemistry formula implementation
  - Complete factor tables
  - Input source mappings
  - Interpretation guidelines

### 2. Semantic Layer Module (`src/utils/semanticLayer.js`)

JavaScript module that loads and processes the YAML configuration:

**Key Functions:**

```javascript
// Load semantic layer on app startup
await loadSemanticLayer()

// Find business terms matching a question
const terms = findRelevantBusinessTerms("filter cleaning compliance")
// Returns: [{key: "filter_cleaning", description: "...", sql_pattern: "..."}]

// Find metrics related to a question
const metrics = findRelevantMetrics("compliance rate")
// Returns: [{key: "filter_maintenance_compliance", target: "95%+", ...}]

// Get a verified query if one matches
const verified = getVerifiedQuery("average pool size by location")
// Returns: {question: "...", sql_query: "...", expected_result_columns: [...]}

// Build context string for AI prompts
const context = buildSemanticContext("show filter maintenance")
// Returns formatted string with relevant business terms, metrics, and patterns
```

### 3. Enhanced Schema Metadata (`src/utils/schemaMetadata.js`)

Updated to integrate semantic layer:

```javascript
// Now accepts optional question parameter
export function buildEnhancedSchemaContext(database, question = '') {
  let context = '...'; // Build schema as before
  
  // Add semantic layer context if question provided
  if (question) {
    const semanticContext = buildSemanticContext(question);
    context += semanticContext;
  }
  
  return context;
}
```

### 4. AI Query Interface (`src/components/AIQueryInterface.jsx`)

Updated to pass user questions to schema builder:

```javascript
const handleSubmit = async () => {
  // Regenerate schema with semantic context for this specific question
  generateDatabaseSchema(question);
  
  // Generate SQL with enriched context
  const sqlQuery = await generateSQLFromQuestion(question);
  // ...
}
```

### 5. Insight Generator (`src/hooks/useInsightGenerator.js`)

Enhanced to include business terms and metrics:

```javascript
// Add semantic layer context for better insights
const businessTerms = getAllBusinessTerms();
const metrics = getAllMetrics();

// Include in AI prompt
const prompt = `...
${schema}
${semanticInfo}

IMPORTANT GUIDANCE:
- Consider the business terms and metrics defined above
- Focus on metrics with targets and data availability indicators
...`;
```

## Benefits

### 1. Improved Query Accuracy

**Before Semantic Layer:**
```sql
-- User asks: "Show chlorine usage"
-- AI generates: WHERE Description = 'Chlorine'
-- Result: 0 rows (chemical names include units: "Chlorine (Oz)")
```

**After Semantic Layer:**
```sql
-- User asks: "Show chlorine usage"
-- AI receives business term with SQL pattern
-- AI generates: WHERE Description LIKE '%Chlorine%'
-- Result: Correct data including "Chlorine (Oz)", "Chlorine (gal)"
```

### 2. Business Context Understanding

The AI now understands:
- Filter cleaning happens every 4 weeks
- Salt cell cleaning happens every 12 weeks
- LSI readings should be between -0.3 and +0.3
- Target compliance rates for maintenance tasks
- Which metrics have available data vs. require implementation

### 3. Synonym Recognition

Users can ask questions in multiple ways:
- "filter cleaning" = "filter service" = "filter maintenance"
- "chlorine usage" = "chlorine dosage" = "chlorine added"
- "active customers" = "current customers" = "paying customers"

### 4. Verified Query Reuse

When a question closely matches a verified query:
```javascript
// User asks: "What is the average pool size?"
// System finds verified query with tested SQL
// Returns pre-validated query instead of generating new one
// Guarantees correct results
```

### 5. Data Availability Awareness

The AI can inform users about data limitations:
- ✅ AVAILABLE: Query will work with current data
- ⚠️ PARTIAL: Query needs additional data sources
- ❌ NOT AVAILABLE: Feature requires implementation (e.g., LSI calculation)

## Usage Examples

### Example 1: Filter Maintenance Compliance

**User Question:** "Show me filter maintenance compliance"

**Semantic Layer Provides:**
```yaml
filter_cleaning:
  description: "Scheduled filter cleaning every 4 weeks"
  sql_pattern: |
    WHERE ServiceStopEntry.EntryType = 'Task'
    AND EntryDescription.Description LIKE '%Filter%'
    AND ServiceStopEntry.ServiceDate >= DATE('now', '-4 weeks')
  recurrence: "Every 4 weeks (monthly)"

filter_maintenance_compliance:
  formula: "(Pools with filter cleaning in last 4 weeks / Total active pools) * 100"
  target: "95%+ compliance"
  data_availability: "✅ AVAILABLE"
```

**AI Generates:**
```sql
SELECT 
  COUNT(DISTINCT CASE 
    WHEN sse.ServiceDate >= DATE('now', '-4 weeks') 
    THEN p.id 
  END) * 100.0 / COUNT(DISTINCT p.id) AS compliance_rate,
  COUNT(DISTINCT p.id) AS total_pools,
  COUNT(DISTINCT CASE 
    WHEN sse.ServiceDate >= DATE('now', '-4 weeks') 
    THEN p.id 
  END) AS pools_serviced
FROM Pool p
LEFT JOIN ServiceStop ss ON p.id = ss.PoolId
LEFT JOIN ServiceStopEntry sse ON ss.id = sse.ServiceStopId
LEFT JOIN EntryDescription ed ON sse.EntryDescriptionId = ed.id
WHERE ed.Description LIKE '%Filter%'
  AND sse.EntryType = 'Task'
  AND p.Deleted = 0
```

### Example 2: Chemical Usage Analysis

**User Question:** "Which pools use the most chlorine?"

**Semantic Layer Provides:**
```yaml
chlorine_usage:
  description: "Total chlorine chemicals added to pools"
  sql_pattern: |
    WHERE EntryDescription.Description LIKE '%Chlorine%'
    AND ServiceStopEntry.EntryType = 'Dosage'
  tables_required: [ServiceStopEntry, EntryDescription, Pool]
  unit: "Measured in EntryDescription.UnitOfMeasure (oz, lbs, gallons)"
  synonyms: ["chlorine dosage", "chlorine added"]
```

**AI Generates:**
```sql
SELECT 
  p.id,
  p.Address,
  SUM(sse.Value) AS total_chlorine_usage,
  ed.UnitOfMeasure,
  COUNT(*) AS application_count
FROM Pool p
JOIN ServiceStop ss ON p.id = ss.PoolId
JOIN ServiceStopEntry sse ON ss.id = sse.ServiceStopId
JOIN EntryDescription ed ON sse.EntryDescriptionId = ed.id
WHERE ed.Description LIKE '%Chlorine%'
  AND sse.EntryType = 'Dosage'
GROUP BY p.id
ORDER BY total_chlorine_usage DESC
LIMIT 10
```

## Integration Checklist

- [x] Install js-yaml library
- [x] Create semanticLayer.js utility module
- [x] Enhance schemaMetadata.js with semantic integration
- [x] Update AIQueryInterface to pass questions to schema builder
- [x] Update useInsightGenerator to include metrics
- [x] Test with development server
- [ ] Validate queries against test databases
- [ ] Add more business terms as needed
- [ ] Expand metrics definitions
- [ ] Create additional verified queries

## Maintenance

### Adding New Business Terms

Edit `docs/skimmer-semantic-layer.yaml`:

```yaml
business_terms:
  new_term:
    description: "Clear business description"
    sql_pattern: |
      WHERE condition = 'value'
      AND another_condition LIKE '%pattern%'
    tables_required: [Table1, Table2]
    unit: "Unit of measurement"
    synonyms: ["alternative term 1", "alternative term 2"]
    recurrence: "If applicable (e.g., weekly, monthly)"
```

### Adding New Metrics

```yaml
metrics:
  new_metric:
    description: "What this metric measures"
    formula: "Calculation logic"
    tables_required: [RequiredTable1, RequiredTable2]
    unit: "Percentage (%) or other unit"
    target: "Desired value or range"
    data_availability: "✅ AVAILABLE / ⚠️ PARTIAL / ❌ NOT AVAILABLE"
```

### Adding Verified Queries

```yaml
verified_queries:
  - question: "Natural language question"
    sql_query: |
      SELECT columns
      FROM tables
      WHERE conditions
    expected_result_columns: ["Column1", "Column2"]
    data_availability: "✅ AVAILABLE"
    business_logic:
      - "Rule 1"
      - "Rule 2"
```

## Performance Considerations

1. **YAML Loading**: The semantic layer is loaded once on app startup and cached in memory
2. **Context Building**: Semantic context is only built when needed (on query submission)
3. **Pattern Matching**: Uses efficient string matching for finding relevant terms
4. **Verified Query Matching**: Uses word overlap algorithm (50% threshold)

## Future Enhancements

1. **LSI Calculation Implementation**: Add automated water balance calculations
2. **Real-time Compliance Monitoring**: Dashboard widgets for maintenance schedules
3. **Predictive Analytics**: Use historical patterns to predict maintenance needs
4. **Custom Business Rules**: User-definable business terms and metrics
5. **Multi-language Support**: Translate business terms for international users
6. **Query Optimization**: Cache frequently-used semantic contexts

## Troubleshooting

### Semantic Layer Not Loading

**Symptom**: Queries don't use business terms or patterns

**Solution**:
```javascript
// Check browser console for errors
// Verify YAML file is accessible at /docs/skimmer-semantic-layer.yaml
// Check semanticLayer.js initialization:
import { loadSemanticLayer } from './utils/semanticLayer';
await loadSemanticLayer(); // Should return parsed YAML object
```

### Business Terms Not Matching

**Symptom**: Expected business term context not included

**Solution**:
```javascript
// Test term matching
import { findRelevantBusinessTerms } from './utils/semanticLayer';
const matches = findRelevantBusinessTerms("your question");
console.log('Matched terms:', matches);
// If no matches, check synonyms in YAML or adjust question wording
```

### Verified Query Not Selected

**Symptom**: AI generates new query instead of using verified one

**Solution**:
```javascript
// Test query matching
import { getVerifiedQuery } from './utils/semanticLayer';
const verified = getVerifiedQuery("your question");
console.log('Matched query:', verified);
// Increase word overlap or add more similar questions to YAML
```

## Conclusion

The semantic layer integration transforms the AI query interface from a simple natural language to SQL converter into an intelligent business analytics tool that understands domain-specific concepts, patterns, and best practices. This results in:

- 🎯 More accurate queries
- 🚀 Faster query generation
- 💡 Better business insights
- ✅ Higher user satisfaction
- 📊 Consistent results

By continuously expanding the semantic layer with new business terms, metrics, and verified queries, the system becomes increasingly intelligent and valuable over time.
