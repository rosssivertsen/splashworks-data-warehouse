import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { aiService } from '../services/aiService';
import { useAISettings } from '../hooks/useLocalStorage';

    const {
      FiMessageSquare, FiSend, FiLoader, FiDatabase, FiTrendingUp,
      FiBarChart2, FiPlus, FiEdit, FiRefreshCw, FiClock, FiUser
    } = FiIcons;

    const AIAssistant = ({
      database, apiKey, onQueryExecute, dashboards, setDashboards,
      selectedDashboard, setSelectedDashboard, isLoading, setIsLoading
    }) => {
      const { settings } = useAISettings();
      const [messages, setMessages] = useState([]);
      const [inputMessage, setInputMessage] = useState('');
      const [isProcessing, setIsProcessing] = useState(false);
      const [dbSchema, setDbSchema] = useState('');
      const messagesEndRef = useRef(null);
      const inputRef = useRef(null);

      const quickActions = [
        { icon: FiPlus, label: 'Create Dashboard', prompt: 'Create a new dashboard with key metrics' },
        { icon: FiBarChart2, label: 'Add Chart', prompt: 'Add a chart to the current dashboard' },
        { icon: FiTrendingUp, label: 'Generate Insights', prompt: 'Analyze the data and provide insights' },
        { icon: FiDatabase, label: 'Query Data', prompt: 'Show me interesting data patterns' }
      ];

      useEffect(() => {
        if (database) {
          generateDatabaseSchema();
        }
      }, [database]);

      useEffect(() => {
        scrollToBottom();
      }, [messages]);

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
                  columns[0].values.forEach(([, name, type]) => {
                    schema += ` - ${name} (${type})\n`;
                  });
                }
                schema += '\n';
              } catch (err) {
                schema += ` - (Schema unavailable)\n\n`;
              }
            });
          }
          setDbSchema(schema);
        } catch (error) {
          console.error('Error generating database schema:', error);
        }
      };

      const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      };

      const detectIntent = (message) => {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('dashboard') || lowerMessage.includes('create dashboard')) {
          return 'create_dashboard';
        } else if (lowerMessage.includes('chart') || lowerMessage.includes('add chart') || lowerMessage.includes('visualize')) {
          return 'create_chart';
        } else if (lowerMessage.includes('insight') || lowerMessage.includes('analyze') || lowerMessage.includes('trend') || lowerMessage.includes('anomaly')) {
          return 'generate_insights';
        } else if (lowerMessage.includes('show me') || lowerMessage.includes('what') || lowerMessage.includes('list') || lowerMessage.includes('find')) {
          return 'query_data';
        } else {
          return 'general';
        }
      };

      const processAIResponse = async (userMessage, intent) => {
        const context = {
          currentDashboard: selectedDashboard?.name || 'none',
          availableDashboards: dashboards.map(d => d.name).join(','),
          totalDashboards: dashboards.length,
        };
    
        let prompt = '';
        let action = '';
    
        switch (intent) {
          case 'create_dashboard':
            prompt = `Based on this database schema, create a comprehensive dashboard: ${dbSchema}\n\nUser request: "${userMessage}"\n\nCurrent context: ${JSON.stringify(context)}\n\nGenerate 3-4 relevant charts as a JSON array. Each chart should have: type (bar/line/pie/area), title, query, description. Return ONLY valid JSON array.`;
            action = 'create_dashboard';
            break;
          case 'create_chart':
            if (!selectedDashboard) {
              return "Please select a dashboard first, or ask me to create one.";
            }
            prompt = `Based on this database schema and the user's request for a chart: ${dbSchema}\n\nUser request: "${userMessage}"\n\nCurrent dashboard: ${selectedDashboard.name}\n\nGenerate ONE chart as a JSON object with: type (bar/line/pie/area), title, query, description. Return ONLY valid JSON object.`;
            action = 'create_chart';
            break;
          case 'generate_insights':
            prompt = `Analyze this database schema and provide business insights: ${dbSchema}\n\nUser request: "${userMessage}"\n\nGenerate 3-5 insights as a JSON array. Each insight should have: title, description, query, impact (High/Medium/Low), type (Trend/Anomaly/Opportunity/Warning). Return ONLY valid JSON array.`;
            action = 'generate_insights';
            break;
          case 'query_data':
            prompt = `Convert this natural language request to SQL: "${userMessage}"\n\nDatabase schema: ${dbSchema}\n\nReturn ONLY the SQL query without any explanation.`;
            action = 'query_data';
            break;
          default:
            prompt = `User request: "${userMessage}"\n\nDatabase schema: ${dbSchema}\n\nContext: ${JSON.stringify(context)}\n\nRespond helpfully about what I can help with regarding this database.`;
            action = 'general_response';
        }
    
        try {
          // Get current API key and model based on provider
          const currentApiKey = settings.provider === 'openai' 
            ? settings.openaiApiKey 
            : settings.anthropicApiKey;
          const currentModel = settings.provider === 'openai'
            ? settings.openaiModel
            : settings.anthropicModel;

          if (!currentApiKey) {
            throw new Error('Please set your API key in Settings');
          }

          const content = await aiService.generateSQL({
            provider: settings.provider,
            apiKey: currentApiKey,
            model: currentModel,
            prompt: prompt,
            systemPrompt: 'You are a BI assistant. Respond with valid JSON when requested, otherwise provide helpful responses.',
            maxTokens: 1000,
            temperature: 0.3
          });
    
          if (action === 'general_response') {
            return content;
          }
          
          if (action === 'query_data') {
            const cleanQuery = content.replace(/```sql/gi, '').replace(/```/g, '').trim();
            return await handleQueryData(cleanQuery);
          }
    
          // The remaining actions expect JSON
          let parsedContent;
          try {
            parsedContent = JSON.parse(content);
          } catch (e) {
            const jsonMatch = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsedContent = JSON.parse(jsonMatch[0]);
                } catch (jsonError) {
                    throw new Error('Failed to parse JSON from AI response.');
                }
            } else {
              throw new Error('Invalid response format');
            }
          }
    
          // Execute the action based on intent
          switch (action) {
            case 'create_dashboard':
              return await handleCreateDashboard(parsedContent);
            case 'create_chart':
              return await handleCreateChart(parsedContent);
            case 'generate_insights':
              return await handleGenerateInsights(parsedContent);
            default:
              return content;
          }
        } catch (error) {
          console.error('AI processing error:', error);
          throw error;
        }
      };

      const handleCreateDashboard = async (chartsData) => {
        try {
          const newCharts = [];
          for (const chart of chartsData) {
            try {
              const result = database.exec(chart.query);
              if (result.length > 0) {
                newCharts.push({
                  id: Date.now() + Math.random(),
                  type: chart.type,
                  title: chart.title,
                  query: chart.query,
                  description: chart.description || '',
                  data: {
                    columns: result[0].columns,
                    values: result[0].values
                  },
                  position: { x: 0, y: 0, w: 6, h: 4 }
                });
              }
            } catch (error) {
              console.error('Error executing chart query:', error);
            }
          }
          if (newCharts.length === 0) {
            return "I couldn't generate any valid charts. Let me try a different approach.";
          }
          const newDashboard = {
            id: Date.now(),
            name: `AI Dashboard ${dashboards.length + 1}`,
            charts: newCharts,
            layout: [],
            createdAt: new Date().toISOString()
          };
          setDashboards([...dashboards, newDashboard]);
          setSelectedDashboard(newDashboard);
          return `✅ Created new dashboard "${newDashboard.name}" with ${newCharts.length} charts. Switched to the Dashboard tab to view it.`;
        } catch (error) {
          throw new Error(`Failed to create dashboard: ${error.message}`);
        }
      };

      const handleCreateChart = async (chartData) => {
        try {
          const result = database.exec(chartData.query);
          if (result.length > 0) {
            const newChart = {
              id: Date.now(),
              type: chartData.type,
              title: chartData.title,
              query: chartData.query,
              description: chartData.description || '',
              data: {
                columns: result[0].columns,
                values: result[0].values
              },
              position: { x: 0, y: 0, w: 6, h: 4 }
            };
            const updatedDashboard = { ...selectedDashboard, charts: [...selectedDashboard.charts, newChart] };
            setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
            setSelectedDashboard(updatedDashboard);
            return `✅ Added "${chartData.title}" chart to "${selectedDashboard.name}". Check the Dashboard tab to see it.`;
          } else {
            return "The query didn't return any data. Let me try a different approach.";
          }
        } catch (error) {
          throw new Error(`Failed to create chart: ${error.message}`);
        }
      };

      const handleGenerateInsights = async (insightsData) => {
        try {
          const insightsWithResults = [];
          for (const insight of insightsData) {
            try {
              const result = database.exec(insight.query);
              if (result.length > 0) {
                insightsWithResults.push({
                  ...insight,
                  data: {
                    columns: result[0].columns,
                    values: result[0].values.slice(0, 5)
                  },
                  rowCount: result[0].values.length
                });
              }
            } catch (error) {
              console.error('Error executing insight query:', error);
            }
          }
          return {
            text: `🔍 Generated ${insightsWithResults.length} business insights. Here they are:`,
            insights: insightsWithResults
          };
        } catch (error) {
          throw new Error(`Failed to generate insights: ${error.message}`);
        }
      };

      const handleQueryData = async (query) => {
        try {
          const result = database.exec(query);
          if (result.length > 0) {
            onQueryExecute({
              query: query,
              columns: result[0].columns,
              values: result[0].values,
              rowCount: result[0].values.length,
              originalQuestion: inputMessage
            });
            return `📊 Found ${result[0].values.length} results. Check the results table below.`;
          } else {
            return "Query executed successfully but returned no results.";
          }
        } catch (error) {
          throw new Error(`Query failed: ${error.message}`);
        }
      };

      const handleSendMessage = async () => {
        const currentApiKey = settings.provider === 'openai' 
          ? settings.openaiApiKey 
          : settings.anthropicApiKey;
        
        if (!inputMessage.trim() || isProcessing || !currentApiKey) return;
        const userMessage = inputMessage.trim();
        setInputMessage('');
        setIsProcessing(true);

        // Add user message
        const userMsg = {
          id: Date.now(),
          type: 'user',
          content: userMessage,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);

        try {
          const intent = detectIntent(userMessage);
          const aiResponse = await processAIResponse(userMessage, intent);
          const aiMsg = {
            id: Date.now() + 1,
            type: 'ai',
            content: typeof aiResponse === 'string' ? aiResponse : aiResponse.text,
            insights: aiResponse.insights || null,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
          const errorMsg = {
            id: Date.now() + 1,
            type: 'error',
            content: `Sorry, I encountered an error: ${error.message}`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, errorMsg]);
        } finally {
          setIsProcessing(false);
        }
      };

      const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      };

      const handleQuickAction = (prompt) => {
        setInputMessage(prompt);
        inputRef.current?.focus();
      };

      return (
        <div className="flex flex-col h-full space-y-4">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">AI Assistant</h2>
            <p className="text-gray-600">Chat with your data using natural language</p>
          </div>
          {/* Quick Actions */}
          {messages.length === 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickActions.map((action, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="bg-gradient-to-r from-blue-50 to-purple-50 border border-gray-200 rounded-lg p-3 text-center hover:shadow-md transition-all"
                >
                  <SafeIcon icon={action.icon} className="w-5 h-5 text-blue-600 mx-auto mb-2" />
                  <span className="text-sm font-medium text-gray-700">{action.label}</span>
                </motion.button>
              ))}
            </div>
          )}
          {/* Messages */}
          <div className="flex-1 bg-gray-50 rounded-lg p-4 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <SafeIcon icon={FiMessageSquare} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Start a conversation with your data</p>
                <div className="text-sm text-gray-500 space-y-2">
                  <p>• "Create a sales dashboard"</p>
                  <p>• "Show me top products"</p>
                  <p>• "Add a revenue chart"</p>
                  <p>• "Analyze customer trends"</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                      <div className={`flex items-start space-x-2 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === 'user' ? 'bg-blue-500' : message.type === 'error' ? 'bg-red-500' : 'bg-purple-500'}`}>
                          <SafeIcon icon={message.type === 'user' ? FiUser : FiMessageSquare} className="w-4 h-4 text-white" />
                        </div>
                        <div className={`rounded-lg px-4 py-2 ${message.type === 'user' ? 'bg-blue-500 text-white' : message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-white border border-gray-200 text-gray-800'}`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          {/* Insights Display */}
                          {message.insights && (
                            <div className="mt-3 space-y-2">
                              {message.insights.map((insight, index) => (
                                <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-blue-900">{insight.title}</h4>
                                    <span className={`text-xs px-2 py-1 rounded-full ${insight.impact === 'High' ? 'bg-red-100 text-red-700' : insight.impact === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                      {insight.impact} Impact
                                    </span>
                                  </div>
                                  <p className="text-sm text-blue-700 mb-2">{insight.description}</p>
                                  {insight.data && (
                                    <div className="text-xs text-blue-600">
                                      <details>
                                        <summary className="cursor-pointer">View Sample Data ({insight.rowCount} rows)</summary>
                                        <pre className="mt-1 bg-white p-2 rounded border border-blue-100 overflow-x-auto">
                                          {JSON.stringify(insight.data.values.slice(0, 3), null, 2)}
                                        </pre>
                                      </details>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className={`text-xs mt-1 ${message.type === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          {/* Input */}
          <div className="space-y-3">
            {(!settings.openaiApiKey && !settings.anthropicApiKey) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  Please set your AI provider API key in Settings to use the AI Assistant.
                </p>
              </div>
            )}
            <div className="flex space-x-3">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your data..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={2}
                disabled={(!settings.openaiApiKey && !settings.anthropicApiKey) || isProcessing}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isProcessing || (!settings.openaiApiKey && !settings.anthropicApiKey)}
                className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors self-end"
              >
                {isProcessing ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                ) : (
                  <SafeIcon icon={FiSend} className="w-4 h-4" />
                )}
                <span>{isProcessing ? 'Thinking...' : 'Send'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    };

    export default AIAssistant;
