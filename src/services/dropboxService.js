/**
 * Dropbox API Service
 * Handles communication with Dropbox API for database file management
 */

import { REMOTE_STORAGE_CONFIG } from '../config/remote-storage';

class DropboxService {
  constructor() {
    this.config = REMOTE_STORAGE_CONFIG.dropbox;
    this.apiUrl = 'https://api.dropboxapi.com/2';
    this.contentUrl = 'https://content.dropboxapi.com/2';
  }

  /**
   * Check if Dropbox is properly configured
   */
  isConfigured() {
    return !!(this.config && this.config.accessToken);
  }

  /**
   * Get authorization headers
   */
  getHeaders(isContentApi = false) {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      ...(isContentApi ? {} : { 'Content-Type': 'application/json' })
    };
  }

  /**
   * List all files in the configured folder
   */
  async listFiles() {
    if (!this.isConfigured()) {
      throw new Error('Dropbox not configured. Please add your access token.');
    }

    try {
      // For App Folder access, empty string or root path
      const folderPath = this.config.folderPath || '';
      console.log('Dropbox API - Attempting to list folder:', folderPath);
      
      const response = await fetch(`${this.apiUrl}/files/list_folder`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          path: folderPath,
          recursive: false,
          include_deleted: false,
          include_has_explicit_shared_members: false,
          include_mounted_folders: true
        })
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Clone the response so we can read it multiple times if needed
        const responseClone = response.clone();
        
        try {
          const error = await response.json();
          console.error('Dropbox API Error (JSON):', JSON.stringify(error, null, 2));
          errorMessage = error.error_summary || error.error?.['.tag'] || JSON.stringify(error);
          
          // Check for specific error types
          if (error.error?.['.tag'] === 'path' && error.error?.path?.['.tag']) {
            const pathError = error.error.path['.tag'];
            if (pathError === 'not_found') {
              errorMessage = 'Folder not found. For App Folder access, use empty string "" or ensure files are in /Apps/[Your App Name]/';
            } else if (pathError === 'malformed_path') {
              errorMessage = 'Invalid path format. For App Folder access, use "" (empty string) for root.';
            }
          }
        } catch (jsonError) {
          console.error('Failed to parse JSON, trying text...');
          try {
            const text = await responseClone.text();
            console.error('Dropbox API Error (Text):', text);
            errorMessage = text || errorMessage;
          } catch (textError) {
            console.error('Could not read error body:', textError);
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Filter for SQLite files only
      const sqliteFiles = data.entries.filter(entry => {
        if (entry['.tag'] !== 'file') return false;
        
        const name = entry.name.toLowerCase();
        return this.config.filePatterns.some(pattern => 
          name.endsWith(pattern.toLowerCase())
        );
      });

      return sqliteFiles.map(file => ({
        id: file.id,
        name: file.name,
        path: file.path_display,
        pathLower: file.path_lower,
        size: file.size,
        modifiedTime: file.server_modified,
        rev: file.rev
      }));

    } catch (error) {
      console.error('Error listing Dropbox files:', error);
      throw error;
    }
  }

  /**
   * Download a specific file
   */
  async downloadFile(filePath) {
    if (!this.isConfigured()) {
      throw new Error('Dropbox not configured. Please add your access token.');
    }

    try {
      const response = await fetch(`${this.contentUrl}/files/download`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(true),
          'Dropbox-API-Arg': JSON.stringify({ path: filePath })
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to download file: ${response.status} ${error}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);

    } catch (error) {
      console.error('Error downloading file from Dropbox:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath) {
    if (!this.isConfigured()) {
      throw new Error('Dropbox not configured. Please add your access token.');
    }

    try {
      const response = await fetch(`${this.apiUrl}/files/get_metadata`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ path: filePath })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Get a temporary download link (valid for 4 hours)
   */
  async getTemporaryLink(filePath) {
    if (!this.isConfigured()) {
      throw new Error('Dropbox not configured. Please add your access token.');
    }

    try {
      const response = await fetch(`${this.apiUrl}/files/get_temporary_link`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ path: filePath })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.link;

    } catch (error) {
      console.error('Error getting temporary link:', error);
      throw error;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
}

export default new DropboxService();
