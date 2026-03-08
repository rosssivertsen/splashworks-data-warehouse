import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import dropboxService from '../services/dropboxService';
import { REMOTE_STORAGE_CONFIG, validateConfig } from '../config/remote-storage';

const { FiCloud, FiDatabase, FiRefreshCw, FiAlertCircle, FiCheck, FiDownload, FiClock, FiLink, FiX } = FiIcons;

const DropboxDatabaseLoader = ({ sqlInstance, onDatabaseLoad, onFileUpload, onUnionDatabases }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [uploadMode, setUploadMode] = useState('single'); // 'single' or 'union'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUnioning, setIsUnioning] = useState(false);

  useEffect(() => {
    // Validate configuration on mount
    const validation = validateConfig();
    if (!validation.valid) {
      setConfigError(validation.message);
      return;
    }

    // Load files on mount if configuration is valid
    if (REMOTE_STORAGE_CONFIG.enabled) {
      loadFiles();
    }
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const dropboxFiles = await dropboxService.listFiles();
      setFiles(dropboxFiles);
      
      if (dropboxFiles.length === 0) {
        setError('No SQLite database files found in the configured Dropbox folder.');
      }
    } catch (err) {
      setError(`Failed to load files from Dropbox: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file) => {
    if (!sqlInstance) {
      setError('SQL.js not initialized yet. Please wait and try again.');
      return;
    }

    setLoadingFile(file.id);
    setError(null);
    setSuccess(null);

    try {
      console.log('🎯 Loading database from Dropbox:', file.name);
      
      // Download file from Dropbox
      const uint8Array = await dropboxService.downloadFile(file.path);
      
      // Create database
      const database = new sqlInstance.Database(uint8Array);
      
      // Test the database by getting table list
      const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
      
      if (tables.length === 0 || tables[0].values.length === 0) {
        throw new Error('No tables found in the database');
      }

      // If onFileUpload is provided, use it for persistence
      if (onFileUpload) {
        // Create a File object from the data
        const blob = new Blob([uint8Array], { type: 'application/x-sqlite3' });
        const fileObj = new File([blob], file.name, { type: 'application/x-sqlite3' });
        await onFileUpload(fileObj);
      } else {
        // Fallback to direct load
        onDatabaseLoad(database);
      }

      setSuccess(`Successfully loaded ${file.name}`);
      
    } catch (err) {
      setError(`Failed to load database: ${err.message}`);
    } finally {
      setLoadingFile(null);
    }
  };

  const toggleFileSelection = (file) => {
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => f.id === file.id);
      if (isSelected) {
        return prev.filter(f => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  };

  const clearSelection = () => {
    setSelectedFiles([]);
  };

  const handleUnionDatabases = async () => {
    if (!onUnionDatabases) {
      setError('Union functionality not available');
      return;
    }

    if (selectedFiles.length < 2) {
      setError('Please select at least 2 databases to union');
      return;
    }

    if (!sqlInstance) {
      setError('SQL.js not initialized yet. Please wait and try again.');
      return;
    }

    setIsUnioning(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🎯 Unioning databases from Dropbox:', selectedFiles.map(f => f.name));
      
      // Download all selected files
      const downloadPromises = selectedFiles.map(async (file) => {
        const uint8Array = await dropboxService.downloadFile(file.path);
        const blob = new Blob([uint8Array], { type: 'application/x-sqlite3' });
        return new File([blob], file.name, { type: 'application/x-sqlite3' });
      });

      const fileObjects = await Promise.all(downloadPromises);
      
      // Union the databases
      await onUnionDatabases(fileObjects);
      
      setSuccess(`Successfully united ${selectedFiles.length} databases`);
      setSelectedFiles([]);
      
    } catch (err) {
      setError(`Failed to union databases: ${err.message}`);
    } finally {
      setIsUnioning(false);
    }
  };

  if (!REMOTE_STORAGE_CONFIG.enabled) {
    return null;
  }

  if (configError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-yellow-50 border border-yellow-200 rounded-lg p-6"
      >
        <div className="flex items-start space-x-3">
          <SafeIcon icon={FiAlertCircle} className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              Dropbox Configuration Required
            </h3>
            <p className="text-yellow-800 mb-4">{configError}</p>
            <div className="bg-white rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium text-gray-900">Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>Go to <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Dropbox App Console</a></li>
                <li>Create a new app (choose "Scoped access" and "App folder" access)</li>
                <li>Generate an access token in the app settings</li>
                <li>Add the token to <code className="bg-gray-100 px-1 rounded">src/config/remote-storage.js</code></li>
              </ol>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <SafeIcon icon={FiCloud} className="w-6 h-6 text-blue-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Dropbox Databases</h3>
            <p className="text-sm text-gray-600">
              {loading ? 'Loading...' : `${files.length} database${files.length !== 1 ? 's' : ''} available`}
            </p>
          </div>
        </div>
        
        <button
          onClick={loadFiles}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SafeIcon 
            icon={FiRefreshCw} 
            className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`}
          />
          <span className="text-sm font-medium text-gray-700">Refresh</span>
        </button>
      </div>

      {/* Mode Toggle */}
      {onUnionDatabases && files.length >= 2 && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            <button
              onClick={() => {
                setUploadMode('single');
                setSelectedFiles([]);
                setError(null);
                setSuccess(null);
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                uploadMode === 'single'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <SafeIcon icon={FiDatabase} className="w-4 h-4" />
                <span>Single Database</span>
              </div>
            </button>
            <button
              onClick={() => {
                setUploadMode('union');
                setError(null);
                setSuccess(null);
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                uploadMode === 'union'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <SafeIcon icon={FiLink} className="w-4 h-4" />
                <span>Union Multiple</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Union Mode - Controls */}
      {uploadMode === 'union' && files.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedFiles.length} of {files.length} selected
          </div>
          <div className="flex items-center space-x-2">
            {selectedFiles.length > 0 && (
              <button
                onClick={clearSelection}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                Clear All
              </button>
            )}
            <button
              onClick={() => setSelectedFiles([...files])}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              Select All
            </button>
          </div>
        </div>
      )}

      {/* Union Mode - Selected Files Display */}
      {uploadMode === 'union' && selectedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50 border border-purple-200 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-purple-900">
              Selected for Union ({selectedFiles.length})
            </h4>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {selectedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-white rounded-lg"
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <SafeIcon icon={FiDatabase} className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{file.name}</span>
                </div>
                <button
                  onClick={() => toggleFileSelection(file)}
                  className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <SafeIcon icon={FiX} className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleUnionDatabases}
            disabled={selectedFiles.length < 2 || isUnioning}
            className={`mt-4 w-full py-2 px-4 rounded-lg font-medium transition-colors ${
              selectedFiles.length >= 2 && !isUnioning
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isUnioning ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Unioning Databases...</span>
              </div>
            ) : (
              `Union ${selectedFiles.length} Database${selectedFiles.length !== 1 ? 's' : ''}`
            )}
          </button>
        </motion.div>
      )}

      {/* Success Message */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3"
        >
          <SafeIcon icon={FiCheck} className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800">{success}</p>
        </motion.div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3"
        >
          <SafeIcon icon={FiAlertCircle} className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </motion.div>
      )}

      {/* Files List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          <AnimatePresence>
            {files.map((file, index) => {
              const isSelected = selectedFiles.some(f => f.id === file.id);
              const isLoading = loadingFile === file.id;
              
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white border rounded-lg p-4 transition-all cursor-pointer ${
                    uploadMode === 'union'
                      ? isSelected
                        ? 'border-purple-400 shadow-md bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                      : isLoading
                      ? 'border-blue-400 shadow-md'
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
                  onClick={() => {
                    if (isLoading || isUnioning) return;
                    if (uploadMode === 'union') {
                      toggleFileSelection(file);
                    } else {
                      handleFileSelect(file);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <SafeIcon 
                        icon={isLoading ? FiDownload : FiDatabase} 
                        className={`w-5 h-5 flex-shrink-0 ${
                          isLoading
                            ? 'text-blue-500 animate-pulse'
                            : uploadMode === 'union' && isSelected
                            ? 'text-purple-500'
                            : 'text-gray-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-gray-500">
                            {dropboxService.formatFileSize(file.size)}
                          </span>
                          <div className="flex items-center space-x-1">
                            <SafeIcon icon={FiClock} className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {dropboxService.formatDate(file.modifiedTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {uploadMode === 'union' ? (
                      <div 
                        className={`ml-4 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-gray-400 hover:border-purple-400'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFileSelection(file);
                        }}
                      >
                        {isSelected && (
                          <SafeIcon icon={FiCheck} className="w-4 h-4 text-white" />
                        )}
                      </div>
                    ) : isLoading ? (
                      <div className="ml-4">
                        <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      </div>
                    ) : (
                      <div className="ml-4 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium">
                        Load
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <SafeIcon icon={FiCloud} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            No database files found in your Dropbox folder
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Upload SQLite files (.db, .sqlite, .sqlite3) to your configured Dropbox folder
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className={`border rounded-lg p-4 ${
        uploadMode === 'union' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'
      }`}>
        <p className={`text-sm font-medium ${
          uploadMode === 'union' ? 'text-purple-800' : 'text-blue-800'
        }`}>
          <strong>Dropbox Folder:</strong> {REMOTE_STORAGE_CONFIG.dropbox.folderPath || 'Root/App Folder'}
        </p>
        <p className={`text-xs mt-1 ${
          uploadMode === 'union' ? 'text-purple-600' : 'text-blue-600'
        }`}>
          {uploadMode === 'union'
            ? 'Select multiple databases to union them into one unified database'
            : 'Files in this folder are automatically discovered and displayed here'
          }
        </p>
      </div>
    </div>
  );
};

export default DropboxDatabaseLoader;
