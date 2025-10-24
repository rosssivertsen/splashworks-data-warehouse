import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing SQL.js database initialization and operations
 * Centralizes database loading, connection handling, and schema operations
 */
const useDatabase = () => {
  const [database, setDatabase] = useState(null);
  const [sqlInstance, setSqlInstance] = useState(null);
  const [sqlLoading, setSqlLoading] = useState(true);
  const [sqlError, setSqlError] = useState(null);
  const [dbSchema, setDbSchema] = useState('');

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
  const loadDatabase = useCallback(async (file) => {
    if (!sqlInstance) {
      console.warn('SQL.js not initialized yet. Current loading state:', sqlLoading);
      throw new Error('SQL.js not initialized yet. Please wait and try again.');
    }

    if (!file.name.toLowerCase().match(/\.(db|sqlite|sqlite3)$/)) {
      console.error('Invalid file type:', file.name);
      throw new Error('Please select a valid SQLite database file (.db, .sqlite, .sqlite3)');
    }

    try {
      console.log('Loading database file:', file.name, 'Size:', file.size, 'bytes');
      const arrayBuffer = await file.arrayBuffer();
      console.log('File read successfully, creating database instance...');
      
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Add memory check for large files
      if (uint8Array.length > 200 * 1024 * 1024) { // 200MB
        console.warn('Large database file detected:', Math.round(uint8Array.length / 1024 / 1024) + 'MB');
      }
      
      const db = new sqlInstance.Database(uint8Array);
      console.log('Database instance created successfully');
      
      // Test the database by getting table list
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      console.log('Tables found:', tables.length > 0 ? tables[0].values.length : 0);
      
      if (tables.length === 0 || tables[0].values.length === 0) {
        throw new Error('No tables found in the database');
      }

      setDatabase(db);
      console.log('Database loaded and set successfully');
      return db;
    } catch (error) {
      console.error('Database loading error:', error);
      throw new Error(`Failed to load database: ${error.message}`);
    }
  }, [sqlInstance, sqlLoading]);

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
    loadDatabase,
    generateDatabaseSchema,
    getTables,
    getTableSchema,
    executeQuery,

    // Internal state setters (for backward compatibility)
    setDatabase
  };
};

export default useDatabase;