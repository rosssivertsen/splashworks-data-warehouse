# Database Union Guide

## Overview

The Skimmer AI Query Visualization application now supports unioning multiple SQLite databases into a single unified database. This feature is particularly useful when you have data from multiple pool service companies or locations that share the same schema structure.

## How It Works

### In-Memory Union Process

The union functionality uses an in-memory approach that:

1. **Creates a unified schema** - Uses the first database as a template to create the schema
2. **Copies all data** - Iterates through each database and copies all data from all tables
3. **Preserves company identity** - Maintains the CompanyId field to distinguish between different companies
4. **Saves persistently** - Stores the unified database in IndexedDB for future use
5. **Tracks metadata** - Records which databases were merged and their company names

### Key Features

- **Schema validation** - Ensures all databases have compatible schemas
- **Transaction-based copying** - Uses SQL transactions for performance
- **Company tracking** - Maintains metadata about source databases
- **Error handling** - Continues processing even if individual tables fail
- **Progress logging** - Detailed console output for debugging

## Using Database Union

### Step 1: Access the Upload Interface

1. Navigate to the "Upload Database" tab
2. You'll see two mode options:
   - **Single Database** - Upload one database (default behavior)
   - **Union Multiple** - Merge multiple databases

### Step 2: Switch to Union Mode

Click the "Union Multiple" button in the mode toggle. The interface will change to show:
- Purple-themed upload area
- Multi-file selection support
- File list management

### Step 3: Select Databases

You can add databases in two ways:

**Option A: Browse Files**
1. Click "Select Multiple Files"
2. Hold Ctrl/Cmd and click multiple database files
3. Click "Open"

**Option B: Drag & Drop**
1. Select multiple database files in your file explorer
2. Drag them into the purple upload area
3. Release to add them to the list

### Step 4: Review Selected Files

After selecting files, you'll see:
- A list of all selected databases
- File names and sizes
- Option to remove individual files (X button)
- Total count of selected databases

### Step 5: Union the Databases

1. Ensure at least 2 databases are selected (union requires minimum 2)
2. Click the "Union X Databases" button
3. Wait for the process to complete (may take a moment for large databases)
4. Upon success, you'll be redirected to the AI Assistant tab

## Technical Details

### Schema Requirements

For databases to be compatible for union:
- All databases must have the **same table structure**
- Table names must match exactly
- Column names and types must be identical
- Foreign key relationships should be consistent

### Company Identification

After union, companies are distinguished by:
- **CompanyId** field present in most tables
- Company names are tracked in metadata
- You can query across companies or filter by specific CompanyId

### Performance Considerations

- **Small databases (< 10MB each)**: Union completes in seconds
- **Medium databases (10-50MB each)**: May take 10-30 seconds
- **Large databases (> 50MB each)**: Can take 1-2 minutes

The process uses SQL transactions and prepared statements for optimal performance.

### Storage

The unified database is stored in:
1. **IndexedDB** - For persistence across browser sessions
2. **Memory** - For active querying and analysis

Metadata about the union includes:
- Source file names
- Company names from each database
- Timestamp of union operation
- Total number of databases merged

## Querying Unified Data

### Cross-Company Queries

After union, you can run queries across all companies:

```sql
SELECT 
    c.Name as CompanyName,
    COUNT(DISTINCT cu.id) as TotalCustomers,
    COUNT(ss.id) as TotalServiceStops
FROM Company c
LEFT JOIN Customer cu ON cu.CompanyId = c.id
LEFT JOIN ServiceLocation sl ON sl.CustomerId = cu.id
LEFT JOIN RouteStop rs ON rs.ServiceLocationId = sl.id
LEFT JOIN ServiceStop ss ON ss.RouteStopId = rs.id
GROUP BY c.id, c.Name
ORDER BY TotalCustomers DESC;
```

### Company-Specific Queries

Filter by CompanyId to analyze specific companies:

```sql
SELECT * FROM Customer 
WHERE CompanyId = 'specific-company-id'
```

### Comparison Queries

Compare metrics between companies:

```sql
SELECT 
    c.Name,
    AVG(i.Total) as AvgInvoiceAmount,
    COUNT(i.id) as TotalInvoices
FROM Company c
JOIN Customer cu ON cu.CompanyId = c.id
JOIN Invoice i ON i.CustomerId = cu.id
GROUP BY c.id, c.Name
ORDER BY AvgInvoiceAmount DESC;
```

## Use Cases

### Multi-Location Analysis
- Compare performance across different service areas
- Identify best practices from high-performing locations
- Aggregate metrics for corporate reporting

### Franchise Operations
- Union data from multiple franchise locations
- Track company-wide KPIs
- Benchmark individual franchises against the group

### Merger & Acquisition
- Combine databases after business acquisitions
- Analyze combined customer base
- Identify synergies and optimization opportunities

### Seasonal Comparisons
- Union databases from different time periods
- Track year-over-year trends
- Analyze seasonal patterns across multiple companies

## Troubleshooting

### "No tables found in the first database"
- Ensure the first file is a valid SQLite database
- Try a different database as the first file
- Check that the database file isn't corrupted

### "Failed to union databases: Schema mismatch"
- Verify all databases have the same schema version
- Check that table structures are identical
- Ensure all databases are from the same Skimmer version

### Union process is slow
- This is normal for large databases
- Check console for progress logs
- Close other browser tabs to free up memory

### Union database not persisting
- Check browser storage limits
- Clear old databases from IndexedDB if needed
- Ensure sufficient disk space

## Best Practices

1. **Test with small databases first** - Verify schema compatibility before processing large files

2. **Order matters** - Use the most complete/representative database as the first file

3. **Clean data beforehand** - Remove test data or invalid records before union

4. **Document company IDs** - Keep track of which CompanyId corresponds to which business

5. **Regular backups** - Keep copies of original databases before union

6. **Monitor browser memory** - Close unnecessary tabs during large unions

## API Reference

### unionDatabases(files: File[])

**Parameters:**
- `files` - Array of File objects representing SQLite databases

**Returns:**
- Promise<Database> - The unified SQL.js database instance

**Throws:**
- Error if less than 2 files provided
- Error if schema incompatibilities detected
- Error if SQL.js not initialized

**Example:**
```javascript
const files = [file1, file2, file3];
const unifiedDb = await unionDatabases(files);
```

### getCompanies()

Retrieves all companies from the unified database.

**Returns:**
- Array<{id: string, name: string}> - List of companies

**Example:**
```javascript
const companies = getCompanies();
// [{id: 'abc123', name: 'A Quality Pool Service'}, ...]
```

## Future Enhancements

Planned features for future versions:

- **Conflict resolution** - Handle duplicate customer records
- **Selective union** - Choose specific tables to merge
- **Company filtering in UI** - Filter dashboards by company
- **Export unified database** - Download the merged database
- **Incremental updates** - Add new companies to existing union
- **Schema migration** - Automatically upgrade older database versions

## Support

For issues or questions about database union:

1. Check console logs for detailed error messages
2. Verify database files are valid SQLite databases
3. Ensure minimum 2 files selected for union
4. Report issues through the standard support channels

---

**Last Updated:** January 3, 2025  
**Version:** 1.0.0  
**Feature Status:** Production Ready
