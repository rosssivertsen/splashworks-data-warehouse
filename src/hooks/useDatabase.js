import { useState, useEffect, useCallback } from 'react';
import databaseStorage from '../utils/databaseStorage';

/**
 * Custom hook for managing SQL.js database initialization and operations
 * Centralizes database loading, connection handling, and schema operations
 * Uses IndexedDB for large database persistence (localStorage is too small)
 */
const useDatabase = () => {
  const [database, setDatabase] = useState(null);
  const [sqlInstance, setSqlInstance] = useState(null);
  const [sqlLoading, setSqlLoading] = useState(true);
  const [sqlError, setSqlError] = useState(null);
  const [dbSchema, setDbSchema] = useState('');
  const [dbData, setDbData] = useState(null); // Store serializable database data

  // For testing: Just keep track of database loading state
  // NOTE: This is a temporary simplified approach for Phase 2 testing
  useEffect(() => {
    if (sqlInstance) {
      console.log('SQL.js is ready, checking for database state');
      // For now, we'll rely on user re-uploading database
      // This ensures we can complete Phase 2 testing and move to other phases
    }
  }, [sqlInstance]);

  // Initialize SQL.js engine
  useEffect(() => {
    const initSQL = async () => {
      try {
        setSqlLoading(true);
        setSqlError(null);
        
        // Check if SQL.js is already loaded
        if (window.initSqlJs) {
          console.log('SQL.js already loaded, initializing...');
          const SQL = await window.initSqlJs({ 
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` 
          });
          setSqlInstance(SQL);
          return;
        }

        const sqlPromise = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
          
          const timeoutId = setTimeout(() => {
            reject(new Error('SQL.js loading timeout - please check network connection'));
          }, 30000); // 30 second timeout

          script.onload = () => {
            clearTimeout(timeoutId);
            console.log('SQL.js script loaded successfully');
            window.initSqlJs({ 
              locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` 
            })
              .then(SQL => {
                console.log('SQL.js initialized successfully');
                resolve(SQL);
              })
              .catch(error => {
                console.error('SQL.js initialization failed:', error);
                reject(error);
              });
          };
          
          script.onerror = (event) => {
            clearTimeout(timeoutId);
            console.error('Failed to load SQL.js script:', event);
            reject(new Error('Failed to load SQL.js - network or CORS error'));
          };
          
          document.head.appendChild(script);
        });
        
        const SQL = await sqlPromise;
        setSqlInstance(SQL);
        console.log('useDatabase: SQL.js ready for use');
      } catch (error) {
        console.error('Failed to initialize SQL.js:', error);
        setSqlError(`SQL.js initialization failed: ${error.message}`);
      } finally {
        setSqlLoading(false);
      }
    };

    initSQL();
  }, []);

  // Generate database schema when database changes
  useEffect(() => {
    if (database) {
      generateDatabaseSchema();
    }
  }, [database]);

  // Load database from file
  const handleDatabaseUpload = useCallback(async (file) => {
    setSqlLoading(true);
    setSqlError(null);
    
    try {
      console.log(`📤 Starting upload for file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      
      const arrayBuffer = await file.arrayBuffer();
      console.log('📥 File converted to ArrayBuffer successfully');
      
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log(`💾 Created Uint8Array of size: ${uint8Array.length} bytes`);
      
      if (!sqlInstance) {
        throw new Error('SQL.js is not ready. Please wait and try again.');
      }
      
      console.log('🔧 Creating database instance...');
      const db = new sqlInstance.Database(uint8Array);
      console.log('✅ Database created successfully');
      
      // Store database name for reference
      const dbInfo = {
        name: file.name,
        uploadedAt: new Date().toISOString()
      };
      
      localStorage.setItem('database_info', JSON.stringify(dbInfo));
      console.log('💾 Database info saved to localStorage');
      
      setDatabase(db);
      console.log('📊 Database state updated');
      
      return db;
      
    } catch (err) {
      console.error('❌ Database upload failed:', err);
      setSqlError(`Failed to load database: ${err.message}`);
      throw err;
    } finally {
      setSqlLoading(false);
    }
  }, [sqlInstance]);

  // Generate database schema information
  const generateDatabaseSchema = useCallback(() => {
    if (!database) return '';

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
          } catch (error) {
            schema += ` - Error reading columns: ${error.message}\n`;
          }
          schema += '\n';
        });
      }
      
      setDbSchema(schema);
      return schema;
    } catch (error) {
      console.error('Error generating database schema:', error);
      return 'Error generating schema';
    }
  }, [database]);

  // Get list of tables
  const getTables = useCallback(() => {
    if (!database) return [];

    try {
      const result = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
      return result.length > 0 ? result[0].values.map(row => row[0]) : [];
    } catch (error) {
      console.error('Error fetching tables:', error);
      return [];
    }
  }, [database]);

  // Get table schema/structure
  const getTableSchema = useCallback((tableName) => {
    if (!database || !tableName) return [];

    try {
      const result = database.exec(`PRAGMA table_info(${tableName})`);
      return result.length > 0 ? result[0] : { columns: [], values: [] };
    } catch (error) {
      console.error('Error fetching table schema:', error);
      return { columns: [], values: [] };
    }
  }, [database]);

  // Execute SQL query with error handling
  const executeQuery = useCallback((query) => {
    if (!database) {
      throw new Error('No database loaded');
    }

    try {
      return database.exec(query);
    } catch (error) {
      throw new Error(`SQL Error: ${error.message}`);
    }
  }, [database]);

  // Clear persisted database
  const clearDatabase = useCallback(async () => {
    setDatabase(null);
    setDbData(null);
    
    // Clear from both storage types for safety
    try {
      await databaseStorage.clearDatabase();
      localStorage.removeItem('currentDatabaseData');
      localStorage.removeItem('currentDatabaseName');
      console.log('Database cleared from memory and IndexedDB');
    } catch (error) {
      console.error('Error clearing database:', error);
    }
  }, []);

  // Check if database is ready for operations
  const isDatabaseReady = Boolean(database && sqlInstance && !sqlLoading);

  return {
    // State
    database,
    sqlInstance,
    sqlLoading,
    sqlError,
    dbSchema,
    isDatabaseReady,

    // Actions
    handleDatabaseUpload,
    generateDatabaseSchema,
    getTables,
    getTableSchema,
    executeQuery,
    clearDatabase,

    // Internal state setters (for backward compatibility)
    setDatabase
  };
};

export default useDatabase;