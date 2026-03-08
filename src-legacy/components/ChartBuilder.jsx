import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import ReactECharts from 'echarts-for-react';

const { FiPlus, FiSave, FiPlay, FiBarChart2, FiPieChart, FiTrendingUp } = FiIcons;

const ChartBuilder = ({ 
  database, 
  apiKey, 
  onQueryExecute, 
  dashboards, 
  setDashboards, 
  selectedDashboard,
  setSelectedDashboard,
  isLoading,
  setIsLoading
}) => {
  const [chartConfig, setChartConfig] = useState({
    type: 'bar',
    title: '',
    query: '',
    description: ''
  });
  const [previewData, setPreviewData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const chartTypes = [
    { value: 'bar', label: 'Bar Chart', icon: FiBarChart2 },
    { value: 'line', label: 'Line Chart', icon: FiTrendingUp },
    { value: 'pie', label: 'Pie Chart', icon: FiPieChart },
    { value: 'area', label: 'Area Chart', icon: FiTrendingUp }
  ];

  const generateChartQuery = async () => {
    if (!apiKey) {
      alert('Please set your OpenAI API key in Settings to use AI chart generation.');
      return;
    }

    setIsGenerating(true);
    setIsLoading(true);
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

      const prompt = `Based on this database schema, generate a SQL query for a ${chartConfig.type} chart with the title "${chartConfig.title}":

${schema}

The chart description is: "${chartConfig.description}"

Return only the SQL query without any explanation.

Important:
- Return ONLY the SQL query, no formatting or explanation
- The query must be valid SQLite syntax
- The query should return data suitable for a ${chartConfig.type} chart`;

      console.log('Sending chart generation prompt to OpenAI');

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
              content: 'You are a SQL expert. Generate SQL queries for data visualization. Return only the SQL query without any explanation.'
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
        throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('OpenAI chart response:', data);
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from OpenAI API');
      }

      const generatedQuery = data.choices[0].message.content.trim();
      console.log('Generated query:', generatedQuery);
      
      // Clean up the query - remove any formatting or explanation
      const cleanQuery = generatedQuery
        .replace(/^```sql\s*/i, '')
        .replace(/^```\s*$/, '')
        .replace(/^SQL:\s*/i, '')
        .trim();

      setChartConfig(prev => ({
        ...prev,
        query: cleanQuery
      }));

      // Auto-preview the generated query
      previewChartQuery(cleanQuery);

    } catch (error) {
      console.error('Error generating chart query:', error);
      alert(`Failed to generate chart query: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  const previewChartQuery = (query = chartConfig.query) => {
    if (!query.trim()) return;

    try {
      const result = database.exec(query);
      if (result.length > 0) {
        setPreviewData({
          columns: result[0].columns,
          values: result[0].values
        });
      } else {
        setPreviewData(null);
      }
    } catch (error) {
      setPreviewData({ error: error.message });
    }
  };

  const saveChart = () => {
    if (!chartConfig.title.trim() || !chartConfig.query.trim()) {
      alert('Please provide a title and query for the chart.');
      return;
    }

    if (!selectedDashboard) {
      alert('Please select a dashboard first.');
      return;
    }

    const newChart = {
      id: Date.now(),
      ...chartConfig,
      data: previewData?.error ? null : previewData,
      position: { x: 0, y: 0, w: 6, h: 4 }
    };

    const updatedDashboard = {
      ...selectedDashboard,
      charts: [...selectedDashboard.charts, newChart]
    };

    setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
    setSelectedDashboard(updatedDashboard);

    // Reset form
    setChartConfig({
      type: 'bar',
      title: '',
      query: '',
      description: ''
    });
    setPreviewData(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Chart Configuration</h3>
          
          {/* Chart Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
            <div className="grid grid-cols-2 gap-2">
              {chartTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setChartConfig(prev => ({ ...prev, type: type.value }))}
                  className={`p-3 border rounded-lg flex items-center space-x-2 transition-colors ${
                    chartConfig.type === type.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <SafeIcon icon={type.icon} className="w-4 h-4" />
                  <span className="text-sm">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chart Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Chart Title</label>
            <input
              type="text"
              value={chartConfig.title}
              onChange={(e) => setChartConfig(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter chart title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Chart Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={chartConfig.description}
              onChange={(e) => setChartConfig(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this chart shows"
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* SQL Query */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">SQL Query</label>
              <button
                onClick={generateChartQuery}
                disabled={isGenerating || !apiKey || !chartConfig.title.trim()}
                className="text-sm bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 disabled:bg-gray-300"
              >
                {isGenerating ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
            <textarea
              value={chartConfig.query}
              onChange={(e) => setChartConfig(prev => ({ ...prev, query: e.target.value }))}
              placeholder="Enter your SQL query or generate with AI"
              rows="6"
              className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={() => previewChartQuery()}
              disabled={!chartConfig.query.trim()}
              className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 disabled:bg-gray-300 flex items-center justify-center space-x-2"
            >
              <SafeIcon icon={FiPlay} className="w-4 h-4" />
              <span>Preview</span>
            </button>
            <button
              onClick={saveChart}
              disabled={!chartConfig.title.trim() || !chartConfig.query.trim() || !previewData || previewData.error}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 flex items-center justify-center space-x-2"
            >
              <SafeIcon icon={FiSave} className="w-4 h-4" />
              <span>Save Chart</span>
            </button>
          </div>
        </div>

        {/* Chart Preview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
          <div className="bg-gray-50 rounded-lg p-4 h-96">
            {previewData ? (
              previewData.error ? (
                <div className="h-full flex items-center justify-center text-red-600">
                  <div className="text-center">
                    <p className="font-medium">Query Error</p>
                    <p className="text-sm mt-1">{previewData.error}</p>
                  </div>
                </div>
              ) : (
                <div className="h-full">
                  <ReactECharts
                    option={{
                      tooltip: { trigger: 'axis' },
                      xAxis: {
                        type: 'category',
                        data: previewData.values.map(row => row[0]),
                        axisLabel: { rotate: 45 }
                      },
                      yAxis: { type: 'value' },
                      series: [{
                        name: previewData.columns[1] || 'Value',
                        type: chartConfig.type === 'pie' ? 'pie' : chartConfig.type,
                        data: chartConfig.type === 'pie' 
                          ? previewData.values.map(row => ({ name: row[0], value: row[1] }))
                          : previewData.values.map(row => row[1]),
                        ...(chartConfig.type === 'area' && { areaStyle: {} })
                      }]
                    }}
                    style={{ height: '100%', width: '100%' }}
                  />
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <p>Run a query to see preview</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Preview */}
      {previewData && !previewData.error && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Data Preview</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {previewData.columns.map((col, i) => (
                    <th key={i} className="text-left py-2 px-3 font-medium text-gray-700">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.values.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {row.map((cell, j) => (
                      <td key={j} className="py-2 px-3 text-gray-600">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.values.length > 10 && (
              <p className="text-xs text-gray-500 mt-2">
                Showing 10 of {previewData.values.length} rows
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartBuilder;