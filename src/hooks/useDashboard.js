import { useState, useCallback } from 'react';
import useLocalStorage from './useLocalStorage';

/**
 * Custom hook for managing dashboard state and operations
 * Centralizes dashboard CRUD operations, persistence, and state management
 */
const useDashboard = () => {
  const [dashboards, setDashboards] = useLocalStorage('dashboards', []);
  const [selectedDashboardId, setSelectedDashboardId] = useLocalStorage('selectedDashboardId', null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);

  // Get selectedDashboard from dashboards array using the persisted ID
  const selectedDashboard = dashboards.find(d => d.id === selectedDashboardId) || null;

  // Create a new dashboard
  const createDashboard = useCallback((name = 'New Dashboard', options = {}) => {
    const newDashboard = {
      id: Date.now() + Math.random(),
      name,
      description: options.description || '',
      charts: [],
      layout: options.layout || [],
      settings: {
        theme: options.theme || 'light',
        autoRefresh: options.autoRefresh || false,
        refreshInterval: options.refreshInterval || 30000,
        showGrid: options.showGrid || true,
        ...options.settings
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...options
    };

    setDashboards(prev => [...prev, newDashboard]);
    setSelectedDashboardId(newDashboard.id);
    return newDashboard;
  }, [setDashboards]);

  // Update dashboard
  const updateDashboard = useCallback((dashboardId, updates) => {
    setDashboards(prev => prev.map(dashboard => 
      dashboard.id === dashboardId 
        ? { 
            ...dashboard, 
            ...updates, 
            updatedAt: new Date().toISOString() 
          }
        : dashboard
    ));

    // Update selected dashboard if it's the one being updated
    // Note: selectedDashboard is derived from dashboards array, so it updates automatically
  }, [setDashboards]);

  // Delete dashboard
  const deleteDashboard = useCallback((dashboardId) => {
    setDashboards(prev => prev.filter(dashboard => dashboard.id !== dashboardId));
    
    // Clear selection if deleted dashboard was selected
    if (selectedDashboard && selectedDashboard.id === dashboardId) {
      setSelectedDashboardId(null);
    }
  }, [setDashboards, selectedDashboard]);

  // Duplicate dashboard
  const duplicateDashboard = useCallback((dashboardId, newName) => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const duplicated = {
      ...dashboard,
      id: Date.now() + Math.random(),
      name: newName || `${dashboard.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setDashboards(prev => [...prev, duplicated]);
    return duplicated;
  }, [dashboards, setDashboards]);

  // Add chart to dashboard
  const addChart = useCallback((dashboardId, chartConfig) => {
    const chart = {
      id: Date.now() + Math.random(),
      type: chartConfig.type || 'bar',
      title: chartConfig.title || 'Untitled Chart',
      query: chartConfig.query || '',
      description: chartConfig.description || '',
      config: chartConfig.config || {},
      position: chartConfig.position || { x: 0, y: 0, w: 6, h: 4 },
      createdAt: new Date().toISOString(),
      ...chartConfig
    };

    updateDashboard(dashboardId, {
      charts: [...(getDashboard(dashboardId)?.charts || []), chart]
    });

    return chart;
  }, [updateDashboard, dashboards]);

  // Update chart in dashboard
  const updateChart = useCallback((dashboardId, chartId, updates) => {
    const dashboard = getDashboard(dashboardId);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const updatedCharts = dashboard.charts.map(chart =>
      chart.id === chartId 
        ? { ...chart, ...updates, updatedAt: new Date().toISOString() }
        : chart
    );

    updateDashboard(dashboardId, { charts: updatedCharts });
  }, [updateDashboard, dashboards]);

  // Remove chart from dashboard
  const removeChart = useCallback((dashboardId, chartId) => {
    const dashboard = getDashboard(dashboardId);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const updatedCharts = dashboard.charts.filter(chart => chart.id !== chartId);
    updateDashboard(dashboardId, { charts: updatedCharts });
  }, [updateDashboard, dashboards]);

  // Get dashboard by ID
  const getDashboard = useCallback((dashboardId) => {
    return dashboards.find(dashboard => dashboard.id === dashboardId);
  }, [dashboards]);

  // Get chart by ID within a dashboard
  const getChart = useCallback((dashboardId, chartId) => {
    const dashboard = getDashboard(dashboardId);
    return dashboard?.charts.find(chart => chart.id === chartId);
  }, [getDashboard]);

  // Generate AI-powered dashboard
  const generateAIDashboard = useCallback(async (database, apiKey, name = 'AI Generated Dashboard') => {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for AI dashboard generation');
    }

    setIsGenerating(true);
    setDashboardError(null);

    try {
      // Get database schema
      let schema = 'Database Schema:\n\n';
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
          } catch (error) {
            schema += ` - Error reading columns\n`;
          }
          schema += '\n';
        });
      }

      // Generate dashboard configuration using AI
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
              content: `You are a BI dashboard expert. Create a comprehensive dashboard configuration based on the database schema.

${schema}

Return a JSON object with this structure:
{
  "name": "Dashboard Name",
  "description": "Brief description",
  "charts": [
    {
      "title": "Chart Title",
      "type": "bar|line|pie|area",
      "query": "SQL query for the chart",
      "description": "What this chart shows"
    }
  ]
}

Rules:
1. Create 3-6 relevant charts
2. Use different chart types appropriately
3. Focus on key business metrics
4. Ensure all SQL queries are valid
5. Make queries insightful and useful`
            },
            {
              role: 'user',
              content: 'Generate a comprehensive dashboard for this database'
            }
          ],
          max_tokens: 1500,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const dashboardConfig = JSON.parse(data.choices[0].message.content.trim());

      // Create the dashboard
      const aiDashboard = createDashboard(dashboardConfig.name || name, {
        description: dashboardConfig.description || 'AI-generated dashboard',
        charts: dashboardConfig.charts.map((chart, index) => ({
          ...chart,
          id: Date.now() + index,
          position: { 
            x: (index % 2) * 6, 
            y: Math.floor(index / 2) * 4, 
            w: 6, 
            h: 4 
          },
          createdAt: new Date().toISOString()
        }))
      });

      return aiDashboard;

    } catch (error) {
      const errorMessage = `Failed to generate AI dashboard: ${error.message}`;
      setDashboardError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [createDashboard]);

  // Export dashboard configuration
  const exportDashboard = useCallback((dashboardId, format = 'json') => {
    const dashboard = getDashboard(dashboardId);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const exportData = {
      ...dashboard,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    let content, filename, mimeType;

    switch (format.toLowerCase()) {
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        filename = `${dashboard.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    return filename;
  }, [getDashboard]);

  // Import dashboard configuration
  const importDashboard = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target.result);
          
          // Validate structure
          if (!importData.name || !Array.isArray(importData.charts)) {
            throw new Error('Invalid dashboard format');
          }

          // Create new dashboard with imported data
          const imported = createDashboard(importData.name, {
            ...importData,
            id: Date.now() + Math.random(), // New ID to avoid conflicts
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          resolve(imported);
        } catch (error) {
          reject(new Error(`Failed to import dashboard: ${error.message}`));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }, [createDashboard]);

  // Clear all dashboards
  const clearAllDashboards = useCallback(() => {
    setDashboards([]);
    setSelectedDashboardId(null);
  }, [setDashboards, setSelectedDashboardId]);

  // Get dashboard statistics
  const getDashboardStats = useCallback(() => {
    const totalDashboards = dashboards.length;
    const totalCharts = dashboards.reduce((sum, d) => sum + d.charts.length, 0);
    const avgChartsPerDashboard = totalDashboards ? (totalCharts / totalDashboards).toFixed(1) : 0;
    
    const chartTypes = {};
    dashboards.forEach(dashboard => {
      dashboard.charts.forEach(chart => {
        chartTypes[chart.type] = (chartTypes[chart.type] || 0) + 1;
      });
    });

    return {
      totalDashboards,
      totalCharts,
      avgChartsPerDashboard,
      chartTypes,
      mostRecentUpdate: dashboards.length > 0 
        ? Math.max(...dashboards.map(d => new Date(d.updatedAt).getTime()))
        : null
    };
  }, [dashboards]);

  // Create default dashboard if none exist
  const createDefaultDashboard = useCallback(() => {
    if (dashboards.length === 0) {
      return createDashboard('Executive Dashboard', {
        description: 'Default dashboard for key business metrics'
      });
    }
    return null;
  }, [dashboards, createDashboard]);

  return {
    // State
    dashboards,
    selectedDashboard,
    isGenerating,
    dashboardError,

    // Dashboard operations
    createDashboard,
    updateDashboard,
    deleteDashboard,
    duplicateDashboard,
    getDashboard,
    
    // Chart operations
    addChart,
    updateChart,
    removeChart,
    getChart,

    // AI operations
    generateAIDashboard,

    // Import/Export
    exportDashboard,
    importDashboard,

    // Utilities
    clearAllDashboards,
    getDashboardStats,
    createDefaultDashboard,
    
    // Selection management
    setSelectedDashboard: (dashboard) => {
      setSelectedDashboardId(dashboard ? dashboard.id : null);
    },
    setDashboards
  };
};

export default useDashboard;