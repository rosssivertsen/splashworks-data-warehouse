import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import * as FiIcons from 'react-icons/fi';
    import SafeIcon from '../common/SafeIcon';
    import { formatDateToISO, formatDateWithDefaults, parseDateTime } from '../utils/dateUtils';

    const { FiTable, FiColumns, FiPlay, FiDatabase, FiSearch } = FiIcons;

    const DataExplorer = ({ database, onQueryExecute }) => {
      const [tables, setTables] = useState([]);
      const [selectedTable, setSelectedTable] = useState(null);
      const [tableSchema, setTableSchema] = useState([]);
      const [tableData, setTableData] = useState([]);
      const [customQuery, setCustomQuery] = useState('');
      const [queryError, setQueryError] = useState(null);
      const [searchTerm, setSearchTerm] = useState('');
      const [currentPage, setCurrentPage] = useState(1);
      const itemsPerPage = 20;

      useEffect(() => {
        if (database) {
          try {
            const result = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
            if (result.length > 0) {
              setTables(result[0].values.map(row => row[0]));
            }
          } catch (error) {
            console.error('Error fetching tables:', error);
          }
        }
      }, [database]);

      const handleTableSelect = (tableName) => {
        setSelectedTable(tableName);
        setCurrentPage(1);
        try {
          // Get table schema
          const schemaResult = database.exec(`PRAGMA table_info(${tableName})`);
          if (schemaResult.length > 0) {
            const columns = schemaResult[0].values.map(row => ({
              name: row[1],
              type: row[2],
              notNull: row[3],
              defaultValue: row[4],
              primaryKey: row[5]
            }));
            setTableSchema(columns);
          }

          // Get table data with date formatting
          const dataResult = database.exec(`SELECT * FROM ${tableName} LIMIT 100`);
          if (dataResult.length > 0) {
            const formattedData = dataResult[0].values.map(row => {
              return row.map((cell, index) => {
                const column = tableSchema[index];
                if (column && (column.type.toLowerCase().includes('date') || 
                              column.type.toLowerCase().includes('time'))) {
                  return formatDateToISO(cell);
                }
                return cell;
              });
            });
            setTableData(formattedData);
          } else {
            setTableData([]);
          }
        } catch (error) {
          console.error('Error fetching table info:', error);
          setTableData([]);
        }
      };

      const executeCustomQuery = () => {
        if (!customQuery.trim()) return;
        setQueryError(null);
        try {
          const result = database.exec(customQuery);
          if (result.length > 0) {
            // Format dates in the results
            const formattedValues = result[0].values.map(row => {
              return row.map(cell => {
                // Try to detect if this is a date string
                if (typeof cell === 'string' && 
                    (cell.includes('-') && (cell.includes(':') || cell.match(/^\d{4}-\d{2}-\d{2}$/)))) {
                  return formatDateToISO(cell);
                }
                return cell;
              });
            });

            onQueryExecute({
              query: customQuery,
              columns: result[0].columns,
              values: formattedValues,
              rowCount: result[0].values.length
            });
          } else {
            onQueryExecute({
              query: customQuery,
              columns: [],
              values: [],
              rowCount: 0,
              message: 'Query executed successfully (no results returned)'
            });
          }
        } catch (error) {
          setQueryError(error.message);
        }
      };

      const filteredData = tableData.filter(row =>
        row.some(cell => cell !== null && cell.toString().toLowerCase().includes(searchTerm.toLowerCase()))
      );

      const totalPages = Math.ceil(filteredData.length / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const currentData = filteredData.slice(startIndex, endIndex);

      const getTableStats = () => {
        if (!selectedTable || !tableData.length) return null;
        
        const numericColumns = tableSchema
          .filter(col => col.type.toLowerCase().includes('int') || 
                        col.type.toLowerCase().includes('float') || 
                        col.type.toLowerCase().includes('decimal'))
          .map(col => col.name);
        
        if (numericColumns.length === 0) return null;
        
        const stats = {};
        numericColumns.forEach(col => {
          const colIndex = tableSchema.findIndex(c => c.name === col);
          const values = tableData.map(row => parseFloat(row[colIndex])).filter(v => !isNaN(v));
          if (values.length > 0) {
            stats[col] = {
              count: values.length,
              min: Math.min(...values),
              max: Math.max(...values),
              avg: values.reduce((a, b) => a + b, 0) / values.length,
              sum: values.reduce((a, b) => a + b, 0)
            };
          }
        });
        return stats;
      };

      const stats = getTableStats();

      return (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <SafeIcon icon={FiDatabase} className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-900">Data Explorer</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tables List */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <SafeIcon icon={FiTable} className="w-5 h-5 mr-2" />
                Tables ({tables.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tables.map((table, index) => (
                  <motion.button
                    key={table}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleTableSelect(table)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedTable === table
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{table}</span>
                      <span className="text-xs text-gray-500">
                        {tableData.length > 0 && selectedTable === table ? `${tableData.length} rows` : ''}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Table Details */}
            <div className="lg:col-span-2 space-y-4">
              {selectedTable ? (
                <>
                  {/* Table Header */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{selectedTable}</h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>{filteredData.length} rows</span>
                        {searchTerm && (
                          <span className="text-blue-600">
                            (filtered from {tableData.length})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Search */}
                    <div className="relative mb-4">
                      <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Search table data..."
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Table Stats */}
                    {stats && Object.keys(stats).length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {Object.entries(stats).map(([col, colStats]) => (
                          <div key={col} className="bg-gray-50 rounded p-3">
                            <div className="text-xs text-gray-500 mb-1">{col}</div>
                            <div className="text-sm font-medium text-gray-900">
                              Avg: {colStats.avg.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-600">
                              Min: {colStats.min} | Max: {colStats.max}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Table Data */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {tableSchema.map((column, index) => (
                              <th key={index} className="text-left py-3 px-4 font-medium text-gray-700">
                                <div className="flex items-center space-x-1">
                                  <span>{column.name}</span>
                                  {column.primaryKey && (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">PK</span>
                                  )}
                                  {(column.type.toLowerCase().includes('date') || 
                                    column.type.toLowerCase().includes('time')) && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">DATE</span>
                                  )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {currentData.map((row, rowIndex) => (
                            <tr key={startIndex + rowIndex} className="border-t border-gray-100 hover:bg-gray-50">
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="py-3 px-4 text-gray-600">
                                  {cell === null ? (
                                    <span className="text-gray-400 italic">NULL</span>
                                  ) : (
                                    <span className={tableSchema[cellIndex]?.type.toLowerCase().includes('date') || 
                                                   tableSchema[cellIndex]?.type.toLowerCase().includes('time') 
                                                   ? 'font-mono text-xs' : ''}>
                                      {String(cell)}
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-gray-200 p-4">
                        <p className="text-sm text-gray-600">
                          Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} results
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            Previous
                          </button>
                          <span className="px-3 py-1 text-sm text-gray-600">
                            {currentPage} of {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-16 bg-gray-50 rounded-lg">
                  <SafeIcon icon={FiTable} className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a table</h3>
                  <p className="text-gray-600">Choose a table from the list to explore its data</p>
                </div>
              )}
            </div>
          </div>

          {/* Custom Query */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <SafeIcon icon={FiColumns} className="w-5 h-5 mr-2" />
              Custom SQL Query
            </h3>
            <div className="space-y-4">
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="Enter your SQL query here..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={executeCustomQuery}
                  disabled={!customQuery.trim()}
                  className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <SafeIcon icon={FiPlay} className="w-4 h-4" />
                  <span>Execute Query</span>
                </button>
                {queryError && (
                  <p className="text-red-600 text-sm">{queryError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    export default DataExplorer;