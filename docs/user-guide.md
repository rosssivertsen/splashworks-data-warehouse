# AI BI Visualization Tool - User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Interface Overview](#interface-overview)
4. [Database Management](#database-management)
5. [AI Assistant](#ai-assistant)
6. [AI Query Interface](#ai-query-interface)
7. [Dashboard Creation](#dashboard-creation)
8. [Chart Building](#chart-building)
9. [Business Insights](#business-insights)
10. [Data Exploration](#data-exploration)
11. [Export Options](#export-options)
12. [Settings Configuration](#settings-configuration)
13. [Tips and Best Practices](#tips-and-best-practices)
14. [Troubleshooting](#troubleshooting)

## Introduction

The AI BI Visualization Tool is a powerful, user-friendly platform that transforms your SQLite databases into interactive, AI-powered business intelligence dashboards. With natural language querying, automated insight generation, and beautiful visualizations, you can uncover valuable insights from your data without writing complex SQL queries.

### Key Benefits
- **No SQL Knowledge Required**: Ask questions in plain English
- **AI-Powered Insights**: Automatically discover trends and opportunities
- **Beautiful Dashboards**: Create professional visualizations in seconds
- **Data Security**: All processing happens in your browser
- **Export Capabilities**: Share insights via PDF and CSV exports

## Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for AI features
- SQLite database file (.db, .sqlite, .sqlite3)

### Step 1: Upload Your Database
1. Launch the application
2. You'll see the **Database** tab automatically
3. Drag and drop your SQLite file or click "Browse Files"
4. Wait for the database to load (you'll see a success message)

### Step 2: Configure AI Features
1. Navigate to the **Settings** tab
2. Enter your OpenAI API key
3. Save your key (it will be stored securely in your browser)

### Step 3: Start Exploring
You're now ready to use all features! Here's what you can do:
- Chat with the AI Assistant
- Ask natural language questions
- Generate automated dashboards
- Create custom charts
- Explore your data

## Interface Overview

### Main Navigation
The application uses a tab-based interface with the following sections:

| Tab | Purpose | Icon |
|-----|---------|------|
| **Database** | Upload and manage SQLite files | 🗄️ |
| **AI Assistant** | Conversational AI interface | 🤖 |
| **AI Query** | Natural language to SQL conversion | 💬 |
| **Dashboard** | View and manage dashboards | 📊 |
| **Charts** | Create custom charts | 📈 |
| **Insights** | AI-generated business insights | 💡 |
| **Explore** | Browse database structure | 🔍 |
| **Settings** | Configure API keys and preferences | ⚙️ |

### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│                    Header Bar                          │
├─────────────────────────────────────────────────────────┤
│  Tab Navigation (Database, AI Assistant, etc.)        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                  Main Content Area                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                  Query Results (if applicable)          │
└─────────────────────────────────────────────────────────┘
```

## Recent Improvements (October 2025)

### Enhanced User Experience
The application has undergone significant architectural improvements that enhance the user experience:

- **Faster Performance**: Improved component loading and responsiveness
- **Better Reliability**: More robust error handling and recovery
- **Smoother Interactions**: Enhanced animations and transitions
- **Improved Accessibility**: Better keyboard navigation and screen reader support

### Technical Improvements (Behind the Scenes)
- **Modular Design**: Components are now smaller and more focused
- **Better Maintainability**: Easier to fix issues and add new features
- **Improved Code Quality**: Higher standards for reliability and performance
- **Future-Ready Architecture**: Prepared for upcoming enhancements

**No Changes to Your Workflow**: All these improvements maintain the same intuitive interface you're familiar with while providing a more robust foundation for future features.

## Database Management

### Supported File Types
- `.db` files
- `.sqlite` files  
- `.sqlite3` files

### Upload Process
1. **Drag and Drop**: Simply drag your file onto the upload area
2. **Browse Files**: Click the button to select a file from your computer
3. **Validation**: The system automatically validates file types
4. **Loading**: Watch the progress indicator as your database loads
5. **Success**: You'll see a confirmation message when complete

### What Happens During Upload?
- File is read into browser memory
- Database structure is analyzed
- Table schemas are extracted
- Sample data is prepared for AI analysis

## AI Assistant

The AI Assistant is your conversational partner for data analysis and dashboard creation.

### Quick Actions
When you first open the AI Assistant, you'll see four quick action buttons:

| Action | Purpose | Example |
|--------|---------|---------|
| **Create Dashboard** | Generate complete dashboards | "Create a sales dashboard" |
| **Add Chart** | Add charts to existing dashboards | "Add a revenue trend chart" |
| **Generate Insights** | Discover business insights | "Analyze customer behavior" |
| **Query Data** | Ask specific questions | "Show me top products" |

### Conversation Features
- **Natural Language**: Type questions as if talking to a data analyst
- **Context Awareness**: AI remembers your conversation history
- **Intent Detection**: Automatically understands what you want to do
- **Rich Responses**: Gets insights, charts, and dashboards

### Example Conversations

#### Creating a Dashboard
```
You: Create a sales dashboard for last quarter
AI: I'll create a comprehensive sales dashboard with key metrics...
[Generates dashboard with revenue, sales by region, top products, etc.]
```

#### Analyzing Data
```
You: What are our best-selling products?
AI: Let me analyze your product data...
[Shows query results with top products]
```

#### Adding Charts
```
You: Add a monthly revenue trend chart to the current dashboard
AI: I'll create a line chart showing monthly revenue...
[Adds chart to dashboard]
```

## AI Query Interface

This tab specializes in converting natural language questions into SQL queries.

### Features
- **Natural Language Input**: Ask questions in plain English
- **Automatic SQL Generation**: AI converts questions to SQL
- **Conversation History**: See your previous questions and results
- **Example Questions**: Get started with pre-written examples

### Date Formatting
All dates are automatically formatted to ISO 8601 standard (YYYY-MM-DD HH:MM:SS) for consistency.

### Example Questions
- "Show me records created today"
- "Find all customers from California"
- "What were sales in Q4 2023?"
- "List products with inventory below 10"

### Using the Interface
1. Type your question in the text area
2. Press Enter or click "Ask AI"
3. Watch as AI generates and executes the SQL
4. Review results in the table below
5. Export results if needed

## Dashboard Creation

### Automatic Dashboard Generation
The AI can create complete dashboards automatically:

1. Go to the **Dashboard** tab
2. Click "AI Generate" (or use the AI Assistant)
3. Wait for AI to analyze your database
4. Review the generated dashboard with 3-4 charts

### Manual Dashboard Management
- **Create New**: Click "New Dashboard" for a blank canvas
- **Rename**: Click the edit icon next to the dashboard name
- **Delete**: Remove dashboards with the trash icon
- **Switch**: Use the dropdown to select different dashboards

### Dashboard Features
- **Grid Layout**: Charts automatically arrange in a responsive grid
- **Export**: Save entire dashboard as PDF
- **Format**: Use the formatter to adjust chart sizes and positions
- **Real-time**: Charts update based on latest data

## Chart Building

Create custom charts with the Chart Builder:

### Chart Types
| Type | Best For | Example |
|------|----------|---------|
| **Bar Chart** | Comparing categories | Sales by product |
| **Line Chart** | Trends over time | Revenue growth |
| **Pie Chart** | Proportions | Market share |
| **Area Chart** | Cumulative trends | Cumulative sales |

### Building Steps
1. **Select Chart Type**: Choose from bar, line, pie, or area
2. **Configure Details**: Add title and description
3. **Generate Query**: Use AI to create the SQL query
4. **Preview**: See real-time chart preview
5. **Save**: Add to your selected dashboard

### AI Query Generation
Click "AI Generate" to let the AI create the SQL query based on:
- Your chart type
- Database schema
- Chart title and description

## Business Insights

The Insights panel automatically analyzes your data for business value:

### Insight Categories
- **Trends**: Patterns and changes over time
- **Anomalies**: Unusual data points or outliers
- **Opportunities**: Areas for improvement or growth
- **Warnings**: Potential issues or risks

### Impact Levels
- **High**: Critical insights requiring immediate attention
- **Medium**: Important insights for strategic planning
- **Low**: Nice-to-know insights for optimization

### Using Insights
1. Click "Generate Insights" in the Insights tab
2. Review automatically generated insights
3. Click "View Data" to see the underlying data
4. Copy SQL queries for further analysis
5. Export insights as PDF for sharing

### Insight Features
- **Data Preview**: See sample data for each insight
- **SQL Queries**: Copy and modify queries
- **Impact Assessment**: Prioritize by business importance
- **Type Classification**: Understand insight categories

## Data Exploration

The Explore tab provides traditional database browsing:

### Features
- **Table Browser**: View all database tables
- **Schema Inspector**: See column details and constraints
- **Data Search**: Search across all table data
- **Custom Queries**: Write and execute SQL directly
- **Statistics**: View table metrics and summaries

### Navigation
1. **Select Table**: Click a table name from the left panel
2. **View Schema**: See column types, constraints, and keys
3. **Browse Data**: Review table data with pagination
4. **Search**: Use the search box to filter data
5. **Custom SQL**: Write queries in the bottom panel

### Table Statistics
For numeric columns, you'll see:
- Row count
- Average, minimum, maximum values
- Standard deviation
- Data distribution

## Export Options

### CSV Export
- **Data**: Current query results or table data
- **Format**: UTF-8 with BOM for Excel compatibility
- **Features**: Proper escaping for special characters
- **Filename**: Automatically includes timestamp

### PDF Export
- **Dashboards**: Complete dashboard with all charts
- **Query Results**: Formatted tables with metadata
- **Insights**: Business insights with data summaries
- **Features**: Headers, footers, page numbers

### Export Process
1. Locate the export buttons (usually in the top-right of panels)
2. Click your desired export format
3. Wait for processing
4. File downloads automatically

## Settings Configuration

### OpenAI API Key
1. Navigate to the **Settings** tab
2. Enter your OpenAI API key
3. The key is saved locally in your browser
4. Required for all AI features

### Getting an API Key
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new key
5. Copy and paste into the settings

### Key Security
- Keys are stored only in your browser
- Never shared with third parties
- Used exclusively for OpenAI API calls
- Can be removed at any time

## Tips and Best Practices

### For Better AI Results
1. **Be Specific**: Detailed questions get better answers
2. **Provide Context**: Include timeframes and criteria
3. **Use Business Terms**: Speak in your domain language
4. **Iterate**: Refine questions based on initial results

### Database Preparation
1. **Clean Data**: Ensure consistent formatting
2. **Descriptive Names**: Use clear table and column names
3. **Proper Types**: Define appropriate data types
4. **Relationships**: Establish foreign key constraints

### Dashboard Design
1. **Purpose-Driven**: Create dashboards for specific audiences
2. **Logical Flow**: Arrange charts in a logical sequence
3. **Consistent Colors**: Use color schemes consistently
4. **Clear Labels**: Ensure all charts have descriptive titles

### Performance Optimization
1. **Limit Data**: Use WHERE clauses to reduce result sets
2. **Index Columns**: Add indexes for frequently queried columns
3. **Avoid Large Text**: Don't include large text fields in charts
4. **Pagination**: Use pagination for large result sets

## Troubleshooting

### Common Issues

#### Database Upload Problems
- **File Not Supported**: Ensure it's a valid SQLite file
- **Upload Fails**: Check file size and try again
- **No Tables**: Verify the database contains data

#### AI Features Not Working
- **API Key Error**: Check your OpenAI API key in Settings
- **Rate Limits**: Wait if you've made too many requests
- **Network Issues**: Check your internet connection

#### Chart Display Issues
- **No Data**: Verify the query returns results
- **Large Data**: Reduce result set size with LIMIT
- **Date Issues**: Check date formatting in your data

#### Export Problems
- **Download Blocked**: Check browser download settings
- **File Empty**: Ensure there's data to export
- **PDF Errors**: Try reducing data size or using Chrome

### Getting Help
1. **Check Console**: Open browser dev tools for error messages
2. **Refresh Page**: Sometimes a simple reload fixes issues
3. **Clear Cache**: Clear browser cache if problems persist
4. **Try Different Browser**: Test with Chrome or Firefox

### Performance Tips
- **Large Databases**: Consider using queries to filter data
- **Memory Issues**: Close other browser tabs
- **Slow Queries**: Use EXPLAIN to analyze query performance
- **Browser Updates**: Keep your browser updated for best performance

## Keyboard Shortcuts

### Navigation
- **Tab**: Navigate between form fields
- **Enter**: Submit forms or execute queries
- **Shift + Enter**: New line in text areas
- **Escape**: Close modals or cancel operations

### Quick Actions
- **Ctrl/Cmd + S**: Save (where applicable)
- **Ctrl/Cmd + C**: Copy (for queries and insights)
- **Ctrl/Cmd + F**: Search (in data tables)

## Conclusion

The AI BI Visualization Tool makes data analysis accessible to everyone, regardless of technical expertise. By following this guide, you can unlock valuable insights from your SQLite databases and create professional dashboards that drive informed decision-making.

Remember:
- Start with simple questions and build complexity
- Use the AI Assistant as your data analysis partner
- Export and share your insights with stakeholders
- Experiment with different chart types and dashboard layouts

Happy data exploring! 🚀