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
  const [databaseHistory, setDatabaseHistory] = useState([]); // Track uploaded/united databases

  // Restore database from IndexedDB on app initialization
  useEffect(() => {
    if (sqlInstance) {
      console.log('SQL.js is ready, checking for persisted database state');
      restoreDatabaseFromStorage();
    }
  }, [sqlInstance]);

  // Function to restore database from IndexedDB storage
  const restoreDatabaseFromStorage = useCallback(async () => {
    try {
      console.log('🔄 Attempting to restore database from IndexedDB...');
      const storedDb = await databaseStorage.loadDatabase();
      
      if (storedDb && storedDb.data) {
        console.log('📦 Found stored database:', storedDb.name, 'Size:', Math.round(storedDb.size / 1024 / 1024) + 'MB');
        
        // Convert stored data back to Uint8Array
        const uint8Array = new Uint8Array(storedDb.data);
        const db = new sqlInstance.Database(uint8Array);
        
        setDatabase(db);
        console.log('✅ Database restored successfully from IndexedDB');
        
        // Update localStorage with database info
        const dbInfo = {
          name: storedDb.name,
          uploadedAt: storedDb.createdAt
        };
        localStorage.setItem('database_info', JSON.stringify(dbInfo));
        
        return db;
      } else {
        console.log('ℹ️ No stored database found in IndexedDB');
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to restore database from storage:', error);
      return null;
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
      
      // Save database to IndexedDB for persistence
      try {
        await databaseStorage.saveDatabase(file.name, uint8Array, {
          uploadedAt: new Date().toISOString(),
          size: uint8Array.length
        });
        console.log('💾 Database saved to IndexedDB for persistence');
      } catch (storageError) {
        console.warn('⚠️ Failed to save database to IndexedDB:', storageError);
        // Continue anyway - database is still loaded in memory
      }
      
      setDatabase(db);
      console.log('📊 Database state updated');
      
      // Add to history
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const tableCount = tables.length > 0 ? tables[0].values.length : 0;
      
      setDatabaseHistory(prev => {
        const newHistory = prev.map(item => ({ ...item, isActive: false }));
        return [...newHistory, {
          name: file.name,
          uploadedAt: new Date().toISOString(),
          isUnion: false,
          tableCount,
          isActive: true
        }];
      });
      
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

  // Union multiple databases
  const unionDatabases = useCallback(async (files) => {
    if (!sqlInstance) {
      throw new Error('SQL.js is not initialized');
    }

    if (files.length < 2) {
      throw new Error('At least 2 databases required for union');
    }

    setSqlLoading(true);
    setSqlError(null);

    try {
      console.log(`🔗 Starting union of ${files.length} databases`);

      // Create a new empty database for the union
      const unionDb = new sqlInstance.Database();

      // Process each database file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📥 Processing database ${i + 1}/${files.length}: ${file.name}`);

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const tempDb = new sqlInstance.Database(uint8Array);

        // Get all tables from this database
        const tablesResult = tempDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        
        if (tablesResult.length === 0 || !tablesResult[0].values.length) {
          console.warn(`⚠️ No tables found in ${file.name}`);
          tempDb.close();
          continue;
        }

        const tables = tablesResult[0].values.map(row => row[0]);
        console.log(`📋 Found ${tables.length} tables in ${file.name}`);

        // For each table, create it in union db if it doesn't exist, then insert data
        for (const tableName of tables) {
          try {
            // Get CREATE TABLE statement
            const createStmt = tempDb.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
            
            if (createStmt.length > 0 && createStmt[0].values.length > 0) {
              const createSQL = createStmt[0].values[0][0];
              
              // Try to create table (will fail if already exists, which is fine)
              try {
                unionDb.exec(createSQL);
                console.log(`✅ Created table: ${tableName}`);
              } catch (e) {
                // Table already exists, that's okay
                console.log(`ℹ️ Table ${tableName} already exists, appending data`);
              }

              // Get all data from this table
              const dataResult = tempDb.exec(`SELECT * FROM ${tableName}`);
              
              if (dataResult.length > 0 && dataResult[0].values.length > 0) {
                const columns = dataResult[0].columns;
                const values = dataResult[0].values;

                // Insert data into union database
                const placeholders = columns.map(() => '?').join(',');
                const insertSQL = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

                const stmt = unionDb.prepare(insertSQL);
                for (const row of values) {
                  stmt.bind(row);
                  stmt.step();
                  stmt.reset();
                }
                stmt.free();

                console.log(`📊 Inserted ${values.length} rows into ${tableName}`);
              }
            }
          } catch (tableError) {
            console.error(`❌ Error processing table ${tableName}:`, tableError);
          }
        }

        tempDb.close();
      }

      // Save the united database
      const unionData = unionDb.export();
      const unionName = `union_of_${files.length}_databases.db`;
      
      try {
        await databaseStorage.saveDatabase(unionName, unionData, {
          uploadedAt: new Date().toISOString(),
          size: unionData.length,
          isUnion: true,
          sourceFiles: files.map(f => f.name)
        });
        console.log('💾 Union database saved to IndexedDB');
      } catch (storageError) {
        console.warn('⚠️ Failed to save union database to IndexedDB:', storageError);
      }

      // Update localStorage
      const dbInfo = {
        name: unionName,
        uploadedAt: new Date().toISOString(),
        isUnion: true,
        sourceFiles: files.map(f => f.name)
      };
      localStorage.setItem('database_info', JSON.stringify(dbInfo));

      setDatabase(unionDb);
      console.log(`✅ Successfully united ${files.length} databases`);
      
      // Add to history
      const tables = unionDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const tableCount = tables.length > 0 ? tables[0].values.length : 0;
      
      setDatabaseHistory(prev => {
        const newHistory = prev.map(item => ({ ...item, isActive: false }));
        return [...newHistory, {
          name: unionName,
          uploadedAt: new Date().toISOString(),
          isUnion: true,
          unionCount: files.length,
          tableCount,
          isActive: true
        }];
      });

      return unionDb;
    } catch (error) {
      console.error('❌ Union failed:', error);
      setSqlError(`Failed to union databases: ${error.message}`);
      throw error;
    } finally {
      setSqlLoading(false);
    }
  }, [sqlInstance]);

  // Remove database from history
  const removeDatabaseFromHistory = useCallback((index) => {
    setDatabaseHistory(prev => prev.filter((_, i) => i !== index));
  }, []);

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
    databaseHistory,

    // Actions
    handleDatabaseUpload,
    unionDatabases,
    generateDatabaseSchema,
    getTables,
    getTableSchema,
    executeQuery,
    clearDatabase,
    removeDatabaseFromHistory,

    // Internal state setters (for backward compatibility)
    setDatabase
  };
};

export default useDatabase;
