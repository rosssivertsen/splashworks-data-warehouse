import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiTable, FiColumns, FiPlay, FiCode } = FiIcons;

const DatabaseExplorer = ({ database, onQueryExecute }) => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableSchema, setTableSchema] = useState([]);
  const [customQuery, setCustomQuery] = useState('');
  const [queryError, setQueryError] = useState(null);

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
    try {
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

      // Show sample data
      const sampleResult = database.exec(`SELECT * FROM ${tableName} LIMIT 10`);
      if (sampleResult.length > 0) {
        onQueryExecute({
          query: `SELECT * FROM ${tableName} LIMIT 10`,
          columns: sampleResult[0].columns,
          values: sampleResult[0].values,
          rowCount: sampleResult[0].values.length
        });
      }
    } catch (error) {
      console.error('Error fetching table info:', error);
    }
  };

  const executeCustomQuery = () => {
    if (!customQuery.trim()) return;

    setQueryError(null);
    try {
      const result = database.exec(customQuery);
      if (result.length > 0) {
        onQueryExecute({
          query: customQuery,
          columns: result[0].columns,
          values: result[0].values,
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

  return (
    <div className="space-y-6">
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
                transition={{ delay: index * 0.1 }}
                onClick={() => handleTableSelect(table)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  selectedTable === table
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'hover:bg-white hover:shadow-sm'
                }`}
              >
                {table}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Table Schema */}
        <div className="lg:col-span-2 bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <SafeIcon icon={FiColumns} className="w-5 h-5 mr-2" />
            Schema {selectedTable && `- ${selectedTable}`}
          </h3>
          {selectedTable ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-700">Column</th>
                    <th className="text-left py-2 font-medium text-gray-700">Type</th>
                    <th className="text-left py-2 font-medium text-gray-700">Constraints</th>
                  </tr>
                </thead>
                <tbody>
                  {tableSchema.map((column, index) => (
                    <motion.tr
                      key={column.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-gray-100"
                    >
                      <td className="py-2 font-mono text-blue-600">{column.name}</td>
                      <td className="py-2 text-gray-600">{column.type}</td>
                      <td className="py-2 text-gray-500">
                        {column.primaryKey ? 'PRIMARY KEY ' : ''}
                        {column.notNull ? 'NOT NULL ' : ''}
                        {column.defaultValue ? `DEFAULT ${column.defaultValue}` : ''}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Select a table to view its schema
            </p>
          )}
        </div>
      </div>

      {/* Custom Query */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <SafeIcon icon={FiCode} className="w-5 h-5 mr-2" />
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
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
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

export default DatabaseExplorer;