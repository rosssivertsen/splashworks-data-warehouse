import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import * as FiIcons from 'react-icons/fi';
    import SafeIcon from '../common/SafeIcon';
    import { formatDateWithDefaults, getCurrentDateTime, getDefaultDate } from '../utils/dateUtils';

    const { FiMessageSquare, FiSend, FiLoader, FiDatabase, FiZap } = FiIcons;

    const AIQueryInterface = ({ database, apiKey, onQueryExecute, isLoading, setIsLoading }) => {
      const [question, setQuestion] = useState('');
      const [conversation, setConversation] = useState([]);
      const [dbSchema, setDbSchema] = useState('');
      const [error, setError] = useState(null);

      useEffect(() => {
        if (database) {
          generateDatabaseSchema();
        }
      }, [database]);

      const generateDatabaseSchema = () => {
        try {
          const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
          let schema = 'Database Schema:\n\n';
          if (tables.length > 0) {
            tables[0].values.forEach(([tableName]) => {
              schema += `Table: ${tableName}\n`;
              try {
                const columns = database.exec(`PRAGMA table_info(${tableName})`);
                if (columns.length > 0) {
                  columns[0].values.forEach(([, name, type, notNull, defaultValue, pk]) => {
                    schema += ` - ${name} (${type})`;
                    if (pk) schema += ' PRIMARY KEY';
                    if (notNull) schema += ' NOT NULL';
                    if (defaultValue) schema += ` DEFAULT ${defaultValue}`;
                    schema += '\n';
                  });
                }
                schema += '\n';
              } catch (err) {
                console.error(`Error getting schema for table ${tableName}:`, err);
              }
            });
          }
          setDbSchema(schema);
        } catch (error) {
          console.error('Error generating database schema:', error);
        }
      };

      const generateSQLFromQuestion = async (userQuestion) => {
        if (!apiKey) {
          throw new Error('OpenAI API key is required. Please set it in the Settings tab.');
        }

        const currentDate = getCurrentDateTime();
        const defaultDate = getDefaultDate();

        const prompt = `Given this SQLite database schema: ${dbSchema}

    Convert this natural language question into a SQL query: "${userQuestion}"

    Pay close attention to all values and conditions specified in the question.

    IMPORTANT DATE FORMATTING RULES:
    - All date columns should be returned in ISO 8601 format: "YYYY-MM-DD HH:MM:SS"
    - If a time is not specified in the question, default to "00:00:00" (midnight)
    - If a date is not specified in the question, default to "1980-01-01 00:00:00"
    - Current datetime is: ${currentDate}
    - Use strftime('%Y-%m-%d %H:%M:%S', column_name) to format dates properly
    - For date comparisons, use the ISO format consistently

    Return only the SQL query without any explanation or formatting. The query should be valid SQLite syntax and follow the date formatting rules above.`;

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
                  content: 'You are a SQL expert. Convert natural language questions to SQL queries for SQLite databases. Return only the SQL query without any explanation. Always format dates as YYYY-MM-DD HH:MM:SS.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              max_tokens: 200,
              temperature: 0.1
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to generate SQL query');
          }

          const data = await response.json();
          let query = data.choices[0].message.content.trim();

          // Clean up the query - remove any markdown formatting or explanation
          query = query.replace(/```sql/gi, '').replace(/```/g, '').trim();

          // Post-process the query to ensure date formatting
          query = query.replace(
            /SELECT\s+(.+?)\s+FROM/gi,
            (match, selectClause) => {
              // Check if there are any date/time columns in the select clause
              const hasDateColumns = dbSchema.toLowerCase().includes('date') || 
                                   dbSchema.toLowerCase().includes('time') ||
                                   userQuestion.toLowerCase().includes('date') ||
                                   userQuestion.toLowerCase().includes('time');
              
              if (hasDateColumns && !selectClause.includes('strftime')) {
                // Add date formatting to the select clause if it contains date-like columns
                const formattedSelect = selectClause.replace(
                  /(\w+)/g,
                  (match) => {
                    // Check if this might be a date column based on common naming patterns
                    if (match.toLowerCase().includes('date') || 
                        match.toLowerCase().includes('time') ||
                        match.toLowerCase().includes('created') ||
                        match.toLowerCase().includes('updated')) {
                      return `strftime('%Y-%m-%d %H:%M:%S', ${match})`;
                    }
                    return match;
                  }
                );
                return `SELECT ${formattedSelect} FROM`;
              }
              return match;
            }
          );

          return query;
        } catch (error) {
          throw new Error(`AI API Error: ${error.message}`);
        }
      };

      const handleSubmit = async () => {
        if (!question.trim()) return;
        setIsLoading(true);
        setError(null);

        const userMessage = { type: 'user', content: question };
        setConversation(prev => [...prev, userMessage]);

        try {
          // Generate SQL from natural language
          const sqlQuery = await generateSQLFromQuestion(question);
          const aiMessage = { type: 'ai', content: `Generated SQL: \`${sqlQuery}\`` };
          setConversation(prev => [...prev, aiMessage]);

          // Execute the generated SQL
          const result = database.exec(sqlQuery);
          if (result.length > 0) {
            onQueryExecute({
              query: sqlQuery,
              columns: result[0].columns,
              values: result[0].values,
              rowCount: result[0].values.length,
              originalQuestion: question
            });
            const resultMessage = { type: 'result', content: `Found ${result[0].values.length} rows. Results displayed below.` };
            setConversation(prev => [...prev, resultMessage]);
          } else {
            onQueryExecute({
              query: sqlQuery,
              columns: [],
              values: [],
              rowCount: 0,
              message: 'Query executed successfully (no results returned)',
              originalQuestion: question
            });
            const resultMessage = { type: 'result', content: 'Query executed successfully, but no results were returned.' };
            setConversation(prev => [...prev, resultMessage]);
          }
        } catch (error) {
          setError(error.message);
          const errorMessage = { type: 'error', content: error.message };
          setConversation(prev => [...prev, errorMessage]);
        } finally {
          setIsLoading(false);
          setQuestion('');
        }
      };

      const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      };

      const exampleQuestions = [
        `Show me records created today (${getCurrentDateTime().split(' ')[0]})`,
        `Find all records from 1980-01-01`,
        `Show me records between 2024-01-01 and 2024-12-31`,
        `List records with timestamps after 00:00:00`,
        `Show me recent records from the last 30 days`
      ];

      return (
        <div className="space-y-6">
          <div className="text-center">
            <SafeIcon icon={FiZap} className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              AI-Powered Database Queries
            </h2>
            <p className="text-gray-600">
              Ask questions in natural language and get SQL results with ISO 8601 date formatting
            </p>
          </div>

          {/* Conversation History */}
          {conversation.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
              {conversation.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-100 text-blue-800 ml-8'
                      : message.type === 'ai'
                      ? 'bg-purple-100 text-purple-800 mr-8'
                      : message.type === 'result'
                      ? 'bg-green-100 text-green-800 mr-8'
                      : 'bg-red-100 text-red-800 mr-8'
                  }`}
                >
                  <div className="text-sm font-medium mb-1">
                    {message.type === 'user' ? 'You' : message.type === 'ai' ? 'AI' : message.type === 'result' ? 'Result' : 'Error'}
                  </div>
                  <div className="text-sm">{message.content}</div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Query Input */}
          <div className="space-y-4">
            <div className="flex space-x-4">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question about your database... (e.g., 'Show me all users who signed up last month')"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows="3"
              />
              <button
                onClick={handleSubmit}
                disabled={!question.trim() || isLoading || !apiKey}
                className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors self-end"
              >
                {isLoading ? (
                  <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" />
                ) : (
                  <SafeIcon icon={FiSend} className="w-5 h-5" />
                )}
                <span>{isLoading ? 'Processing...' : 'Ask AI'}</span>
              </button>
            </div>

            {!apiKey && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                  Please set your OpenAI API key in the Settings tab to use AI queries.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Example Questions */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Example Questions:</h3>
            <div className="flex flex-wrap gap-2">
              {exampleQuestions.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setQuestion(example)}
                  className="text-sm bg-white border border-gray-200 px-3 py-2 rounded-full hover:bg-gray-50 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    };

    export default AIQueryInterface;