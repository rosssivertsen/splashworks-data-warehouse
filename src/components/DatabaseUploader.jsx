import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiUpload, FiDatabase, FiCheck, FiAlertCircle } = FiIcons;

const DatabaseUploader = ({ sqlInstance, onDatabaseLoad, onFileUpload }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFileUpload = async (file) => {
    if (!sqlInstance) {
      setError('SQL.js not initialized yet. Please wait and try again.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.db') && !file.name.toLowerCase().endsWith('.sqlite') && !file.name.toLowerCase().endsWith('.sqlite3')) {
      setError('Please select a valid SQLite database file (.db, .sqlite, .sqlite3)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Use the persistence-enabled upload function if available
      if (onFileUpload) {
        console.log('🎯 DatabaseUploader: Using persistence-enabled upload');
        await onFileUpload(file);
      } else {
        // Fallback to direct database creation (legacy)
        console.log('🎯 DatabaseUploader: Using legacy direct upload');
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const database = new sqlInstance.Database(uint8Array);
        
        // Test the database by getting table list
        const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
        
        if (tables.length === 0 || tables[0].values.length === 0) {
          throw new Error('No tables found in the database');
        }

        onDatabaseLoad(database);
      }

      setSuccess(true);
      
    } catch (err) {
      setError(`Failed to load database: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <SafeIcon icon={FiDatabase} className="w-12 h-12 text-blue-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Upload Skimmer Database
        </h2>
        <p className="text-gray-600">
          Select a SQLite database file from your local system to start creating BI dashboards
        </p>
      </div>

      <motion.div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isLoading ? (
          <div className="space-y-4">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600">Loading database...</p>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <SafeIcon icon={FiCheck} className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-green-600 font-medium">Database loaded successfully!</p>
            <p className="text-gray-600 text-sm">Redirecting to dashboard...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <SafeIcon icon={FiUpload} className="w-12 h-12 text-gray-400 mx-auto" />
            <div>
              <p className="text-gray-600 mb-2">
                Drag and drop your SQLite file here, or
              </p>
              <label className="inline-block bg-blue-500 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
                Browse Files
                <input
                  type="file"
                  accept=".db,.sqlite,.sqlite3"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-sm text-gray-500">
              Supports .db, .sqlite, and .sqlite3 files
            </p>
          </div>
        )}
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3"
        >
          <SafeIcon icon={FiAlertCircle} className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </motion.div>
      )}

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <SafeIcon icon={FiDatabase} className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <h4 className="font-medium text-gray-900">AI Dashboards</h4>
          <p className="text-sm text-gray-600 mt-1">Automatically generate executive dashboards</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <SafeIcon icon={FiCheck} className="w-8 h-8 text-purple-500 mx-auto mb-2" />
          <h4 className="font-medium text-gray-900">Smart Insights</h4>
          <p className="text-sm text-gray-600 mt-1">Discover trends and opportunities</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <SafeIcon icon={FiUpload} className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <h4 className="font-medium text-gray-900">Interactive Charts</h4>
          <p className="text-sm text-gray-600 mt-1">Beautiful visualizations</p>
        </div>
      </div>
    </div>
  );
};

export default DatabaseUploader;