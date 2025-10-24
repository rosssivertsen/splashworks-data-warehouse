import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import * as FiIcons from 'react-icons/fi';
    import SafeIcon from '../common/SafeIcon';

    const { FiGrid, FiList, FiTrendingUp, FiTrendingDown, FiAlertCircle, FiInfo, FiEdit3, FiSave, FiX, FiFilter, FiBarChart2 } = FiIcons;

    const InsightsFormatter = ({ insights, setInsights, onClose }) => {
      const [viewMode, setViewMode] = useState('grid');
      const [filter, setFilter] = useState('all');
      const [sortBy, setSortBy] = useState('impact');
      const [editingInsight, setEditingInsight] = useState(null);
      const [tempInsight, setTempInsight] = useState(null);

      const insightTypes = ['Trend', 'Anomaly', 'Opportunity', 'Warning'];
      const impactLevels = ['High', 'Medium', 'Low'];

      const filteredInsights = insights.filter(insight => {
        if (filter === 'all') return true;
        return insight.type?.toLowerCase() === filter.toLowerCase();
      });

      const sortedInsights = [...filteredInsights].sort((a, b) => {
        switch (sortBy) {
          case 'impact':
            const impactOrder = { High: 3, Medium: 2, Low: 1 };
            return (impactOrder[b.impact] || 0) - (impactOrder[a.impact] || 0);
          case 'type':
            return (a.type || '').localeCompare(b.type || '');
          case 'title':
            return (a.title || '').localeCompare(b.title || '');
          default:
            return 0;
        }
      });

      const updateInsight = (insightId, updates) => {
        const updatedInsights = insights.map(insight =>
          insight.id ? (insight.id === insightId ? { ...insight, ...updates } : insight) : insight
        );
        setInsights(updatedInsights);
      };

      const deleteInsight = (insightIndex) => {
        const updatedInsights = insights.filter((_, index) => index !== insightIndex);
        setInsights(updatedInsights);
      };

      const startEditingInsight = (insight, index) => {
        setEditingInsight(index);
        setTempInsight({ ...insight, id: insight.id || index });
      };

      const saveInsightEdit = () => {
        if (!tempInsight || editingInsight === null) return;
        updateInsight(editingInsight, tempInsight);
        setEditingInsight(null);
        setTempInsight(null);
      };

      const cancelInsightEdit = () => {
        setEditingInsight(null);
        setTempInsight(null);
      };

      const getInsightIcon = (type) => {
        switch (type?.toLowerCase()) {
          case 'trend': return FiTrendingUp;
          case 'anomaly': return FiAlertCircle;
          case 'opportunity': return FiTrendingUp;
          case 'warning': return FiTrendingDown;
          default: return FiInfo;
        }
      };

      const getImpactColor = (impact) => {
        switch (impact?.toLowerCase()) {
          case 'high': return 'text-red-600 bg-red-50 border-red-200';
          case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
          case 'low': return 'text-green-600 bg-green-50 border-green-200';
          default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
      };

      const getTypeColor = (type) => {
        switch (type?.toLowerCase()) {
          case 'trend': return 'text-blue-600 bg-blue-50 border-blue-200';
          case 'anomaly': return 'text-purple-600 bg-purple-50 border-purple-200';
          case 'opportunity': return 'text-green-600 bg-green-50 border-green-200';
          case 'warning': return 'text-red-600 bg-red-50 border-red-200';
          default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
      };

      return (
        <div className="flex h-full">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Insights Formatter</h2>
                <p className="text-gray-600 mt-1">Customize and organize your business insights</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <SafeIcon icon={FiX} className="w-6 h-6" />
              </button>
            </div>

            {/* Controls */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* View Mode */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">View:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-600'
                      }`}
                    >
                      <SafeIcon icon={FiGrid} className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-600'
                      }`}
                    >
                      <SafeIcon icon={FiList} className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filter */}
                <div className="flex items-center space-x-2">
                  <SafeIcon icon={FiFilter} className="w-4 h-4 text-gray-500" />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Types</option>
                    {insightTypes.map(type => (
                      <option key={type} value={type.toLowerCase()}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Sort */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="impact">Impact</option>
                    <option value="type">Type</option>
                    <option value="title">Title</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Insights Display */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              {sortedInsights.length === 0 ? (
                <div className="text-center py-16">
                  <SafeIcon icon={FiInfo} className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Insights</h3>
                  <p className="text-gray-600">No insights match the current filter criteria</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {sortedInsights.map((insight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                    >
                      {editingInsight === index ? (
                        <div className="space-y-4">
                          <input
                            type="text"
                            value={tempInsight.title || ''}
                            onChange={(e) => setTempInsight({ ...tempInsight, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md font-semibold"
                          />
                          <textarea
                            value={tempInsight.description || ''}
                            onChange={(e) => setTempInsight({ ...tempInsight, description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={tempInsight.type || ''}
                              onChange={(e) => setTempInsight({ ...tempInsight, type: e.target.value })}
                              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              {insightTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                            <select
                              value={tempInsight.impact || ''}
                              onChange={(e) => setTempInsight({ ...tempInsight, impact: e.target.value })}
                              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              {impactLevels.map(level => (
                                <option key={level} value={level}>{level}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={cancelInsightEdit}
                              className="px-3 py-1 text-gray-600 hover:text-gray-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveInsightEdit}
                              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <SafeIcon
                                icon={getInsightIcon(insight.type)}
                                className={`w-5 h-5 ${insight.type === 'warning' ? 'text-red-500' : 'text-blue-500'}`}
                              />
                              <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={() => startEditingInsight(insight, index)}
                                className="p-1 hover:bg-gray-200 rounded"
                              >
                                <SafeIcon icon={FiEdit3} className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => deleteInsight(index)}
                                className="p-1 hover:bg-red-200 rounded"
                              >
                                <SafeIcon icon={FiX} className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-gray-600 text-sm mb-4">{insight.description}</p>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            <span className={`px-2 py-1 text-xs rounded-full border ${getImpactColor(insight.impact)}`}>
                              {insight.impact} Impact
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full border ${getTypeColor(insight.type)}`}>
                              {insight.type}
                            </span>
                          </div>

                          {/* Data Preview */}
                          {insight.data && (
                            <div className="bg-gray-50 rounded p-3">
                              <div className="text-xs text-gray-500 mb-2">
                                Sample Data ({insight.rowCount} total rows)
                              </div>
                              <div className="text-xs font-mono">
                                {insight.data.values.slice(0, 2).map((row, i) => (
                                  <div key={i} className="flex space-x-2">
                                    {row.map((cell, j) => (
                                      <span key={j} className="text-gray-700 truncate">
                                        {cell}
                                      </span>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedInsights.map((insight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <SafeIcon
                              icon={getInsightIcon(insight.type)}
                              className={`w-5 h-5 ${insight.type === 'warning' ? 'text-red-500' : 'text-blue-500'}`}
                            />
                            <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                            <span className={`px-2 py-1 text-xs rounded-full border ${getImpactColor(insight.impact)}`}>
                              {insight.impact} Impact
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full border ${getTypeColor(insight.type)}`}>
                              {insight.type}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mb-2">{insight.description}</p>
                          {insight.data && (
                            <div className="text-xs text-gray-500">
                              Data: {insight.rowCount} rows
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => startEditingInsight(insight, index)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <SafeIcon icon={FiEdit3} className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => deleteInsight(index)}
                            className="p-1 hover:bg-red-200 rounded"
                          >
                            <SafeIcon icon={FiX} className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Statistics Sidebar */}
          <div className="w-64 bg-gray-50 border-l border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Statistics</h3>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900">{insights.length}</div>
                <div className="text-sm text-gray-600">Total Insights</div>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <div className="text-lg font-semibold text-gray-900">
                  {insights.filter(i => i.impact === 'High').length}
                </div>
                <div className="text-sm text-gray-600">High Impact</div>
              </div>

              <div className="bg-white rounded-lg p-4">
                <div className="text-lg font-semibold text-gray-900">
                  {insights.filter(i => i.type === 'Opportunity').length}
                </div>
                <div className="text-sm text-gray-600">Opportunities</div>
              </div>

              <div className="bg-white rounded-lg p-4">
                <div className="text-lg font-semibold text-gray-900">
                  {insights.filter(i => i.type === 'Warning').length}
                </div>
                <div className="text-sm text-gray-600">Warnings</div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Type Distribution</h4>
              <div className="space-y-2">
                {insightTypes.map(type => {
                  const count = insights.filter(i => i.type === type).length;
                  const percentage = insights.length > 0 ? (count / insights.length * 100).toFixed(0) : 0;
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{type}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-900 w-8">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    };

    export default InsightsFormatter;