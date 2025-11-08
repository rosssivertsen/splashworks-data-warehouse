import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import * as FiIcons from 'react-icons/fi';
    import SafeIcon from '../common/SafeIcon';
    import ChartRenderer from './ChartRenderer';
    import DashboardFormatter from './DashboardFormatter';

    const { FiPlus, FiEdit2, FiTrash2, FiGrid, FiBarChart2, FiPieChart, FiTrendingUp, FiLayout, FiDownload, FiFileText } = FiIcons;

const DashboardView = ({
  database,
  dashboards,
  setDashboards,
  selectedDashboard,
  setSelectedDashboard,
  apiKey,
  onQueryExecute,
  isLoading,
  setIsLoading,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [dashboardName, setDashboardName] = useState('');

  // Debug logging for dashboard props (only on significant changes)
  useEffect(() => {
    if (selectedDashboard) {
      console.log('🎯 DashboardView: Dashboard loaded -', selectedDashboard.name, 'with', selectedDashboard.charts?.length || 0, 'charts');
    }
  }, [selectedDashboard?.id]); // Only log when dashboard ID changes

  const generateAIDashboard = async () => {
    if (!apiKey) {
      alert('Please set your OpenAI API key in Settings to use AI dashboard generation.');
      return;
    }

    setIsGenerating(true);
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

    try {
          // Get database schema
          let schema = 'Database Schema:\n\n';
          try {
            const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
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
                  console.error(`Error getting schema for table ${tableName}:`, err);
                  schema += ` - (Schema unavailable)\n\n`;
                }
              });
            } else {
              throw new Error('No tables found in database');
            }
          } catch (error) {
            throw new Error(`Failed to read database schema: ${error.message}`);
          }

          const prompt = `Based on this database schema, suggest 3-4 executive dashboard charts that would provide valuable business insights: ${schema}

For each chart, provide:
1. Chart type (bar, line, pie, area)
2. Title
3. SQL query
4. Description of what it shows

Format as JSON array with objects containing: type, title, query, description

Important:
- Return ONLY valid JSON without any explanation or formatting
- SQL queries must be valid SQLite syntax
- Chart types must be one of: bar, line, pie, area
- Each object must have all 4 required fields`;

      console.log('Sending prompt to OpenAI:', prompt);

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
              content: 'You are a BI expert. Create executive dashboard suggestions based on database schema. Return valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 800,
          temperature: 0.3
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('OpenAI response:', data);

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from OpenAI API');
      }

      const content = data.choices[0].message.content.trim();
      console.log('Generated content:', content);

      let chartSuggestions;
      try {
        // Try to parse as JSON directly
        chartSuggestions = JSON.parse(content);
      } catch (parseError) {
        // If direct parsing fails, try to extract JSON from the content
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          chartSuggestions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
        }
      }

      if (!Array.isArray(chartSuggestions)) {
        throw new Error('AI response is not an array of charts');
      }

      console.log('Parsed chart suggestions:', chartSuggestions);

      // Execute queries and create charts
      const newCharts = [];
      for (const suggestion of chartSuggestions) {
        try {
          if (!suggestion.query || !suggestion.title || !suggestion.type) {
            console.warn('Skipping invalid chart suggestion:', suggestion);
            continue;
          }

          const result = database.exec(suggestion.query);
          if (result.length > 0) {
            newCharts.push({
              id: Date.now() + Math.random(),
              type: suggestion.type,
              title: suggestion.title,
              query: suggestion.query,
              description: suggestion.description || '',
              data: {
                columns: result[0].columns,
                values: result[0].values
              },
              position: { x: 0, y: 0, w: 6, h: 4 }
            });
          } else {
            console.warn('No data returned for query:', suggestion.query);
          }
        } catch (error) {
          console.error('Error executing chart query:', error, 'Query:', suggestion.query);
        }
      }

      if (newCharts.length === 0) {
        throw new Error('No valid charts could be generated from the AI suggestions');
      }

      // Update dashboard with new charts
      const updatedDashboard = { ...selectedDashboard, charts: newCharts };
      setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
      setSelectedDashboard(updatedDashboard);

      console.log(`Successfully generated ${newCharts.length} charts`);
    } catch (error) {
      if (error.name === 'AbortError') {
        error.message = 'Request timed out after 30 seconds.';
      }
      console.error('Error generating AI dashboard:', error);
      alert(`Failed to generate AI dashboard: ${error.message}`);
    } finally {
      clearTimeout(timeoutId);
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

      const createNewDashboard = () => {
        const newDashboard = {
          id: Date.now(),
          name: `Dashboard ${dashboards.length + 1}`,
          charts: [],
          layout: [],
          createdAt: new Date().toISOString()
        };
        setDashboards([...dashboards, newDashboard]);
        setSelectedDashboard(newDashboard);
      };

      const deleteDashboard = (dashboardId) => {
        if (confirm('Are you sure you want to delete this dashboard?')) {
          const updatedDashboards = dashboards.filter(d => d.id !== dashboardId);
          setDashboards(updatedDashboards);
          
          if (selectedDashboard?.id === dashboardId) {
            // If we're deleting the selected dashboard, select the first remaining one
            setSelectedDashboard(updatedDashboards.length > 0 ? updatedDashboards[0] : null);
          }
        }
      };

      const updateDashboardName = () => {
        if (dashboardName.trim()) {
          const updatedDashboard = { ...selectedDashboard, name: dashboardName.trim() };
          setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
          setSelectedDashboard(updatedDashboard);
          setEditingName(false);
        }
      };

      const exportDashboardToPDF = async () => {
        if (!selectedDashboard || selectedDashboard.charts.length === 0) return;

        try {
          const { jsPDF } = await import('jspdf');
          const doc = new jsPDF();

          // Add title
          doc.setFontSize(20);
          doc.text('Executive Dashboard Report', 20, 20);
          
          // Add dashboard name
          doc.setFontSize(16);
          doc.text(selectedDashboard.name, 20, 35);
          
          // Add timestamp
          doc.setFontSize(10);
          doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 45);
          
          // Add summary
          doc.setFontSize(12);
          doc.text(`Summary: ${selectedDashboard.charts.length} charts`, 20, 55);

          let yPosition = 70;

          // Add each chart section
          for (let i = 0; i < selectedDashboard.charts.length; i++) {
            const chart = selectedDashboard.charts[i];

            // Add new page if needed
            if (yPosition > 230) {
              doc.addPage();
              yPosition = 20;
            }

            // Chart title
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`${i + 1}. ${chart.title}`, 20, yPosition);
            yPosition += 10;

            // Chart description
            if (chart.description) {
              doc.setFontSize(10);
              doc.setFont(undefined, 'normal');
              const descLines = doc.splitTextToSize(chart.description, 170);
              doc.text(descLines, 20, yPosition);
              yPosition += descLines.length * 5 + 5;
            }

            // Chart type
            doc.setFontSize(10);
            doc.setFont(undefined, 'italic');
            doc.text(`Type: ${chart.type}`, 20, yPosition);
            yPosition += 8;

            // Data summary
            if (chart.data && chart.data.values) {
              doc.setFont(undefined, 'normal');
              doc.text(`Data Points: ${chart.data.values.length}`, 20, yPosition);
              yPosition += 6;

              // Add sample data (first 5 rows)
              if (chart.data.values.length > 0) {
                doc.text('Sample Data:', 20, yPosition);
                yPosition += 6;

                // Headers
                doc.setFont(undefined, 'bold');
                const headerRow = chart.data.columns.slice(0, 3).join(' | ');
                doc.text(headerRow.substring(0, 60), 25, yPosition);
                yPosition += 5;

                // Sample rows
                doc.setFont(undefined, 'normal');
                const sampleRows = Math.min(3, chart.data.values.length);
                for (let j = 0; j < sampleRows; j++) {
                  const dataRow = chart.data.values[j].slice(0, 3).map(v => 
                    v === null ? 'NULL' : String(v).substring(0, 15)
                  ).join(' | ');
                  doc.text(dataRow.substring(0, 60), 25, yPosition);
                  yPosition += 5;
                }

                if (chart.data.values.length > 3) {
                  doc.text(`... and ${chart.data.values.length - 3} more rows`, 25, yPosition);
                  yPosition += 5;
                }
              }
            }

            yPosition += 10; // Space between charts
          }

          // Add footer
          doc.setFontSize(8);
          doc.text('Generated by AI BI Visualization Tool', 20, 280);

          // Save the PDF
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const safeName = selectedDashboard.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          doc.save(`dashboard_${safeName}_${timestamp}.pdf`);
        } catch (error) {
          console.error('Error generating dashboard PDF:', error);
          alert('Failed to generate PDF. Please try again.');
        }
      };

      if (isFormatting) {
        return (
          <DashboardFormatter
            selectedDashboard={selectedDashboard}
            setSelectedDashboard={setSelectedDashboard}
            dashboards={dashboards}
            setDashboards={setDashboards}
            onClose={() => setIsFormatting(false)}
          />
        );
      }

      return (
        <div className="space-y-6">
          {/* Dashboard Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <select
                value={selectedDashboard?.id || ''}
                onChange={(e) => {
                  const dashboard = dashboards.find(d => d.id === parseInt(e.target.value));
                  setSelectedDashboard(dashboard);
                }}
                className="text-lg font-semibold bg-transparent border-b-2 border-gray-300 focus:border-blue-500 outline-none"
              >
                {dashboards.map(dashboard => (
                  <option key={dashboard.id} value={dashboard.id}>
                    {dashboard.name}
                  </option>
                ))}
              </select>
              {selectedDashboard && (
                <>
                  <button
                    onClick={() => {
                      setEditingName(true);
                      setDashboardName(selectedDashboard.name);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <SafeIcon icon={FiEdit2} className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteDashboard(selectedDashboard.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={createNewDashboard}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center space-x-2"
              >
                <SafeIcon icon={FiPlus} className="w-4 h-4" />
                <span>New Dashboard</span>
              </button>
              {selectedDashboard && selectedDashboard.charts.length > 0 && (
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={exportDashboardToPDF}
                    className="px-3 py-2 rounded-md text-sm transition-colors hover:bg-white hover:shadow-sm"
                    title="Export Dashboard as PDF"
                  >
                    <SafeIcon icon={FiFileText} className="w-4 h-4" />
                  </button>
                </div>
              )}
              {selectedDashboard && (
                <>
                  <button
                    onClick={() => setIsFormatting(true)}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center space-x-2"
                  >
                    <SafeIcon icon={FiLayout} className="w-4 h-4" />
                    <span>Format</span>
                  </button>
                  <button
                    onClick={generateAIDashboard}
                    disabled={isGenerating || !apiKey}
                    className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 flex items-center space-x-2"
                  >
                    {isGenerating ? (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      <SafeIcon icon={FiTrendingUp} className="w-4 h-4" />
                    )}
                    <span>{isGenerating ? 'Generating...' : 'AI Generate'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Edit Name Modal */}
          {editingName && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-96">
                <h3 className="text-lg font-semibold mb-4">Rename Dashboard</h3>
                <input
                  type="text"
                  value={dashboardName}
                  onChange={(e) => setDashboardName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                  autoFocus
                />
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingName(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateDashboardName}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Content */}
          {selectedDashboard ? (
            selectedDashboard.charts.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-lg">
                <SafeIcon icon={FiGrid} className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No charts yet</h3>
                <p className="text-gray-600 mb-6">
                  Generate charts with AI or create them manually in the Charts tab
                </p>
                <button
                  onClick={generateAIDashboard}
                  disabled={isGenerating || !apiKey}
                  className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 flex items-center justify-center"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    'Generate AI Dashboard'
                  )}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-2">
                {selectedDashboard.charts.map((chart, index) => (
                  <motion.div
                    key={chart.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    style={{ gridColumn: `span ${chart.position?.w || 6}`, gridRow: `span ${chart.position?.h || 4}` }}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <ChartRenderer chart={chart} />
                  </motion.div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-16 bg-gray-50 rounded-lg">
              <SafeIcon icon={FiBarChart2} className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No dashboard selected</h3>
              <p className="text-gray-600">Create a new dashboard to get started</p>
            </div>
          )}
        </div>
      );
    };

    export default DashboardView;
