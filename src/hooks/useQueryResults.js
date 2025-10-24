import { useState, useCallback } from 'react';
import { formatDateWithDefaults, getCurrentDateTime } from '../utils/dateUtils';

/**
 * Custom hook for managing SQL query execution and results
 * Centralizes query processing, error handling, and result formatting
 */
const useQueryResults = () => {
  const [queryResults, setQueryResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);

  // Execute SQL query with error handling and result formatting
  const executeQuery = useCallback(async (database, query, metadata = {}) => {
    if (!database) {
      const error = new Error('No database loaded');
      setQueryError(error);
      throw error;
    }

    setIsLoading(true);
    setQueryError(null);
    
    try {
      const startTime = Date.now();
      const result = database.exec(query);
      const endTime = Date.now();
      
      if (result.length === 0) {
        const emptyResult = {
          query,
          columns: [],
          values: [],
          rowCount: 0,
          message: 'Query executed successfully but returned no results',
          executionTime: endTime - startTime,
          timestamp: new Date().toISOString(),
          ...metadata
        };
        
        setQueryResults(emptyResult);
        addToHistory(emptyResult);
        return emptyResult;
      }

      // Format the results
      const formattedResult = {
        query,
        columns: result[0].columns,
        values: result[0].values,
        rowCount: result[0].values.length,
        message: `Query executed successfully. ${result[0].values.length} rows returned.`,
        executionTime: endTime - startTime,
        timestamp: new Date().toISOString(),
        ...metadata
      };

      setQueryResults(formattedResult);
      addToHistory(formattedResult);
      return formattedResult;

    } catch (error) {
      const formattedError = new Error(`SQL Error: ${error.message}`);
      setQueryError(formattedError);
      
      // Add failed query to history
      const errorEntry = {
        query,
        error: formattedError.message,
        timestamp: new Date().toISOString(),
        ...metadata
      };
      addToHistory(errorEntry);
      
      throw formattedError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Execute query with AI-generated context
  const executeAIQuery = useCallback(async (database, aiQuery, originalQuestion, apiKey) => {
    return executeQuery(database, aiQuery, {
      originalQuestion,
      type: 'ai-generated',
      aiProcessed: true
    });
  }, [executeQuery]);

  // Execute custom user query
  const executeCustomQuery = useCallback(async (database, userQuery) => {
    return executeQuery(database, userQuery, {
      type: 'custom',
      userGenerated: true
    });
  }, [executeQuery]);

  // Generate AI query from natural language
  const generateAIQuery = useCallback(async (question, dbSchema, apiKey) => {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for AI query generation');
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a SQL expert. Convert natural language questions to SQL queries.

${dbSchema}

Rules:
1. Return only valid SQL query, no explanations
2. Use ISO 8601 format for dates (YYYY-MM-DD HH:MM:SS)
3. Handle date comparisons carefully
4. For "today" use: ${getCurrentDateTime().split(' ')[0]}
5. For relative dates, calculate from current date
6. Use LIMIT clause for large datasets (default LIMIT 100)
7. Always validate table and column names exist in schema`
            },
            {
              role: 'user',
              content: question
            }
          ],
          max_tokens: 200,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedQuery = data.choices[0].message.content.trim();
      
      // Clean up the query (remove any markdown formatting)
      const cleanQuery = generatedQuery
        .replace(/```sql/g, '')
        .replace(/```/g, '')
        .trim();

      return cleanQuery;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add query result to history
  const addToHistory = useCallback((result) => {
    setQueryHistory(prev => [
      {
        id: Date.now() + Math.random(),
        ...result
      },
      ...prev.slice(0, 49) // Keep last 50 queries
    ]);
  }, []);

  // Clear query history
  const clearHistory = useCallback(() => {
    setQueryHistory([]);
  }, []);

  // Get query history filtered by type
  const getHistoryByType = useCallback((type) => {
    return queryHistory.filter(entry => entry.type === type);
  }, [queryHistory]);

  // Export query results to different formats
  const exportResults = useCallback(async (format = 'csv') => {
    if (!queryResults || !queryResults.values.length) {
      throw new Error('No query results to export');
    }

    const { columns, values } = queryResults;

    switch (format.toLowerCase()) {
      case 'csv': {
        const csvContent = [
          columns.join(','),
          ...values.map(row => 
            row.map(cell => 
              typeof cell === 'string' && cell.includes(',') 
                ? `"${cell}"` 
                : cell
            ).join(',')
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `query_results_${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        break;
      }
      
      case 'json': {
        const jsonData = values.map(row => {
          const obj = {};
          columns.forEach((col, index) => {
            obj[col] = row[index];
          });
          return obj;
        });

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { 
          type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `query_results_${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        break;
      }
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }, [queryResults]);

  // Clear current results
  const clearResults = useCallback(() => {
    setQueryResults(null);
    setQueryError(null);
  }, []);

  // Get query statistics
  const getQueryStats = useCallback(() => {
    const totalQueries = queryHistory.length;
    const successfulQueries = queryHistory.filter(q => !q.error).length;
    const failedQueries = totalQueries - successfulQueries;
    const avgExecutionTime = queryHistory
      .filter(q => q.executionTime)
      .reduce((sum, q) => sum + q.executionTime, 0) / successfulQueries || 0;

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      successRate: totalQueries ? (successfulQueries / totalQueries * 100).toFixed(1) : 0,
      avgExecutionTime: avgExecutionTime.toFixed(2)
    };
  }, [queryHistory]);

  return {
    // State
    queryResults,
    isLoading,
    queryError,
    queryHistory,

    // Actions
    executeQuery,
    executeAIQuery,
    executeCustomQuery,
    generateAIQuery,
    exportResults,
    clearResults,
    clearHistory,
    
    // Utilities
    getHistoryByType,
    getQueryStats,
    
    // Internal setters (for backward compatibility)
    setQueryResults,
    setIsLoading
  };
};

export default useQueryResults;