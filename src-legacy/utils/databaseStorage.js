/**
 * IndexedDB utility for persisting large database files
 * Handles binary data storage that exceeds localStorage limits
 */

class DatabaseStorage {
  constructor() {
    this.dbName = 'PoolServiceBIStorage';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store for database files
        if (!db.objectStoreNames.contains('databases')) {
          const store = db.createObjectStore('databases', { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  async saveDatabase(name, data, metadata = {}) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['databases'], 'readwrite');
      const store = transaction.objectStore('databases');
      
      const databaseRecord = {
        id: 'current_database',
        name,
        data: data, // Uint8Array or ArrayBuffer
        size: data.byteLength,
        createdAt: new Date().toISOString(),
        ...metadata
      };
      
      const request = store.put(databaseRecord);
      request.onsuccess = () => {
        console.log('Database saved to IndexedDB:', name, 'Size:', Math.round(data.byteLength / 1024 / 1024) + 'MB');
        resolve(databaseRecord);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async loadDatabase() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['databases'], 'readonly');
      const store = transaction.objectStore('databases');
      const request = store.get('current_database');
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log('Database loaded from IndexedDB:', result.name, 'Size:', Math.round(result.size / 1024 / 1024) + 'MB');
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearDatabase() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['databases'], 'readwrite');
      const store = transaction.objectStore('databases');
      const request = store.delete('current_database');
      
      request.onsuccess = () => {
        console.log('Database cleared from IndexedDB');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getDatabaseInfo() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['databases'], 'readonly');
      const store = transaction.objectStore('databases');
      const request = store.get('current_database');
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            name: result.name,
            size: result.size,
            createdAt: result.createdAt
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export default new DatabaseStorage();