import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import * as FiIcons from 'react-icons/fi';
    import SafeIcon from '../common/SafeIcon';

    const { FiGrid, FiMaximize2, FiMinimize2, FiMove, FiEdit3, FiSave, FiX, FiCopy, FiTrash2, FiLayout, FiAlignLeft, FiAlignCenter, FiAlignRight } = FiIcons;

    const DashboardFormatter = ({
      selectedDashboard,
      setSelectedDashboard,
      dashboards,
      setDashboards,
      onClose
    }) => {
      const [selectedChart, setSelectedChart] = useState(null);
      const [editingChart, setEditingChart] = useState(null);
      const [tempChart, setTempChart] = useState(null);

      const chartSizes = [
        { label: 'Small', w: 3, h: 3 },
        { label: 'Medium', w: 6, h: 4 },
        { label: 'Large', w: 8, h: 6 },
        { label: 'Full Width', w: 12, h: 4 },
        { label: 'Full Height', w: 6, h: 8 }
      ];

      const layoutTemplates = [
        {
          name: 'Executive Summary',
          description: 'Large KPIs on top, detailed charts below',
          layout: [
            { position: { x: 0, y: 0, w: 4, h: 3 }, priority: 0 },
            { position: { x: 4, y: 0, w: 4, h: 3 }, priority: 1 },
            { position: { x: 8, y: 0, w: 4, h: 3 }, priority: 2 },
            { position: { x: 0, y: 3, w: 6, h: 5 }, priority: 3 },
            { position: { x: 6, y: 3, w: 6, h: 5 }, priority: 4 }
          ]
        },
        {
          name: 'Analytics Dashboard',
          description: 'Grid layout with equal-sized charts',
          layout: [
            { position: { x: 0, y: 0, w: 6, h: 4 }, priority: 0 },
            { position: { x: 6, y: 0, w: 6, h: 4 }, priority: 1 },
            { position: { x: 0, y: 4, w: 6, h: 4 }, priority: 2 },
            { position: { x: 6, y: 4, w: 6, h: 4 }, priority: 3 }
          ]
        },
        {
          name: 'KPI Focus',
          description: 'Emphasis on key metrics',
          layout: [
            { position: { x: 0, y: 0, w: 12, h: 2 }, priority: 0 },
            { position: { x: 0, y: 2, w: 6, h: 4 }, priority: 1 },
            { position: { x: 6, y: 2, w: 6, h: 4 }, priority: 2 },
            { position: { x: 0, y: 6, w: 4, h: 4 }, priority: 3 },
            { position: { x: 4, y: 6, w: 4, h: 4 }, priority: 4 },
            { position: { x: 8, y: 6, w: 4, h: 4 }, priority: 5 }
          ]
        }
      ];

      const applyLayoutTemplate = (template) => {
        if (!selectedDashboard || !template.layout) return;

        const updatedCharts = selectedDashboard.charts.map((chart, index) => {
          const layoutItem = template.layout.find(l => l.priority === index) || template.layout[index] || template.layout[0];
          return {
            ...chart,
            position: layoutItem.position
          };
        });

        const updatedDashboard = {
          ...selectedDashboard,
          charts: updatedCharts,
          layout: template.layout
        };

        setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
        setSelectedDashboard(updatedDashboard);
      };

      const updateChartPosition = (chartId, newPosition) => {
        const updatedCharts = selectedDashboard.charts.map(chart =>
          chart.id === chartId ? { ...chart, position: newPosition } : chart
        );

        const updatedDashboard = { ...selectedDashboard, charts: updatedCharts };
        setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
        setSelectedDashboard(updatedDashboard);
      };

      const updateChartSize = (chartId, size) => {
        const updatedCharts = selectedDashboard.charts.map(chart =>
          chart.id === chartId ? { ...chart, position: { ...chart.position, w: size.w, h: size.h } } : chart
        );

        const updatedDashboard = { ...selectedDashboard, charts: updatedCharts };
        setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
        setSelectedDashboard(updatedDashboard);
      };

      const duplicateChart = (chart) => {
        const newChart = {
          ...chart,
          id: Date.now(),
          title: `${chart.title} (Copy)`,
          position: {
            ...chart.position,
            x: (chart.position.x + 1) % 12,
            y: Math.floor((chart.position.x + 1) / 12) + chart.position.y
          }
        };

        const updatedDashboard = {
          ...selectedDashboard,
          charts: [...selectedDashboard.charts, newChart]
        };

        setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
        setSelectedDashboard(updatedDashboard);
      };

      const deleteChart = (chartId) => {
        const updatedCharts = selectedDashboard.charts.filter(chart => chart.id !== chartId);
        const updatedDashboard = { ...selectedDashboard, charts: updatedCharts };
        setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
        setSelectedDashboard(updatedDashboard);
        setSelectedChart(null);
      };

      const startEditingChart = (chart) => {
        setEditingChart(chart);
        setTempChart({ ...chart });
      };

      const saveChartEdit = () => {
        if (!tempChart) return;

        const updatedCharts = selectedDashboard.charts.map(chart =>
          chart.id === tempChart.id ? tempChart : chart
        );

        const updatedDashboard = { ...selectedDashboard, charts: updatedCharts };
        setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
        setSelectedDashboard(updatedDashboard);
        setEditingChart(null);
        setTempChart(null);
      };

      const cancelChartEdit = () => {
        setEditingChart(null);
        setTempChart(null);
      };

      if (!selectedDashboard) {
        return (
          <div className="text-center py-16">
            <SafeIcon icon={FiLayout} className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Dashboard Selected</h3>
            <p className="text-gray-600">Select a dashboard to format its layout</p>
          </div>
        );
      }

      return (
        <div className="flex h-full">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Dashboard Formatter</h2>
                <p className="text-gray-600 mt-1">{selectedDashboard.name}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <SafeIcon icon={FiX} className="w-6 h-6" />
              </button>
            </div>

            {/* Layout Templates */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Layout Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {layoutTemplates.map((template, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => applyLayoutTemplate(template)}
                    className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <h4 className="font-medium text-gray-900 mb-1">{template.name}</h4>
                    <p className="text-sm text-gray-600">{template.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {template.layout.map((item, i) => (
                        <div
                          key={i}
                          className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded"
                        >
                          {item.position.w}×{item.position.h}
                        </div>
                      ))}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Chart Grid Preview */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Chart Layout</h3>
              <div className="relative bg-gray-50 rounded-lg p-4 min-h-[400px]">
                <div className="grid grid-cols-12 gap-2">
                  {selectedDashboard.charts.map((chart) => (
                    <motion.div
                      key={chart.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{
                        gridColumn: `span ${chart.position.w}`,
                        gridRow: `span ${chart.position.h}`
                      }}
                      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedChart?.id === chart.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                      onClick={() => setSelectedChart(chart)}
                    >
                      <div className="h-full flex flex-col justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm truncate">{chart.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">{chart.type}</p>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-400">{chart.position.w}×{chart.position.h}</span>
                          <div className="flex space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingChart(chart);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <SafeIcon icon={FiEdit3} className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateChart(chart);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <SafeIcon icon={FiCopy} className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChart(chart.id);
                              }}
                              className="p-1 hover:bg-red-200 rounded text-red-600"
                            >
                              <SafeIcon icon={FiTrash2} className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          {selectedChart && (
            <div className="w-80 bg-gray-50 border-l border-gray-200 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Chart Settings</h3>
                <button
                  onClick={() => setSelectedChart(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <SafeIcon icon={FiX} className="w-4 h-4" />
                </button>
              </div>

              {/* Chart Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={selectedChart.title}
                  onChange={(e) => {
                    const updatedChart = { ...selectedChart, title: e.target.value };
                    setSelectedChart(updatedChart);
                    updateChartPosition(selectedChart.id, selectedChart.position);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              {/* Size Presets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
                <div className="grid grid-cols-2 gap-2">
                  {chartSizes.map((size, index) => (
                    <button
                      key={index}
                      onClick={() => updateChartSize(selectedChart.id, size)}
                      className={`p-2 text-xs border rounded-md transition-colors ${
                        selectedChart.position.w === size.w && selectedChart.position.h === size.h
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {size.label}
                      <div className="text-gray-500">{size.w}×{size.h}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Custom Size</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Width</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={selectedChart.position.w}
                      onChange={(e) => {
                        const newPosition = { ...selectedChart.position, w: parseInt(e.target.value) || 1 };
                        updateChartPosition(selectedChart.id, newPosition);
                        setSelectedChart({ ...selectedChart, position: newPosition });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Height</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={selectedChart.position.h}
                      onChange={(e) => {
                        const newPosition = { ...selectedChart.position, h: parseInt(e.target.value) || 1 };
                        updateChartPosition(selectedChart.id, newPosition);
                        setSelectedChart({ ...selectedChart, position: newPosition });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">X</label>
                    <input
                      type="number"
                      min="0"
                      max="11"
                      value={selectedChart.position.x}
                      onChange={(e) => {
                        const newPosition = { ...selectedChart.position, x: parseInt(e.target.value) || 0 };
                        updateChartPosition(selectedChart.id, newPosition);
                        setSelectedChart({ ...selectedChart, position: newPosition });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Y</label>
                    <input
                      type="number"
                      min="0"
                      value={selectedChart.position.y}
                      onChange={(e) => {
                        const newPosition = { ...selectedChart.position, y: parseInt(e.target.value) || 0 };
                        updateChartPosition(selectedChart.id, newPosition);
                        setSelectedChart({ ...selectedChart, position: newPosition });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Chart Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
                <select
                  value={selectedChart.type}
                  onChange={(e) => {
                    const updatedChart = { ...selectedChart, type: e.target.value };
                    setSelectedChart(updatedChart);
                    const updatedCharts = selectedDashboard.charts.map(c =>
                      c.id === selectedChart.id ? updatedChart : c
                    );
                    const updatedDashboard = { ...selectedDashboard, charts: updatedCharts };
                    setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
                    setSelectedDashboard(updatedDashboard);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="bar">Bar Chart</option>
                  <option value="line">Line Chart</option>
                  <option value="pie">Pie Chart</option>
                  <option value="area">Area Chart</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={selectedChart.description || ''}
                  onChange={(e) => {
                    const updatedChart = { ...selectedChart, description: e.target.value };
                    setSelectedChart(updatedChart);
                    const updatedCharts = selectedDashboard.charts.map(c =>
                      c.id === selectedChart.id ? updatedChart : c
                    );
                    const updatedDashboard = { ...selectedDashboard, charts: updatedCharts };
                    setDashboards(prev => prev.map(d => d.id === selectedDashboard.id ? updatedDashboard : d));
                    setSelectedDashboard(updatedDashboard);
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                  placeholder="Chart description..."
                />
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {editingChart && tempChart && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-96">
                <h3 className="text-lg font-semibold mb-4">Edit Chart</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      value={tempChart.title}
                      onChange={(e) => setTempChart({ ...tempChart, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={tempChart.description || ''}
                      onChange={(e) => setTempChart({ ...tempChart, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SQL Query</label>
                    <textarea
                      value={tempChart.query}
                      onChange={(e) => setTempChart({ ...tempChart, query: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm resize-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={cancelChartEdit}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveChartEdit}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    export default DashboardFormatter;