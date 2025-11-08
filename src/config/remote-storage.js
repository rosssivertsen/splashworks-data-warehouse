/**
 * Remote Storage Configuration
 * Configure Dropbox or other remote storage options
 */

export const REMOTE_STORAGE_CONFIG = {
  // Enable/disable remote storage
  enabled: true,
  
  // Storage provider: 'dropbox' | 's3' | 'netlify' | 'github'
  type: 'dropbox',
  
  // Dropbox Configuration
  dropbox: {
    // Your Dropbox App Access Token
    // Get from: https://www.dropbox.com/developers/apps
    // 1. Create app with "App folder" or "Full Dropbox" access
    // 2. Generate access token in Settings > Generated access token
    accessToken: 'sl.u.AGFWy0ryMUElnrBtk3fy1NyDFGZ4P3iZgA1sCA56qDP3rIwW5PjoMM1Xdagp2d6SUdMV1XK3-bWow_pHELUt4COUYkDxA0dJ-P0WXYlI-h-kYqqer8TA3Qe1Hq6fDdGjND_wZsq8N613N58vGCTkf57d-EKB5rSUN0q_8whGDwrE9ermPYZ04CU51KckNASTSkkWotvKwBFBXtHKudSzOdPFUxkEsDcS34yHQyYUwAr6FvPb8CU9f3ZAl8qMsMkyDHLICt6LKxjzpt7oD84GeRhGym9nP-t9YdnnFkFmJUZ1OAXj2XPQZQtWKufM6wHDMMtpa3LRp2I5Zwpkil6r1hYBUKloiElC0h-IDsAkVCbLiQe_mWmrURxB_POCKXAwbA5Yl0Tlx0p-mI6M97m-hk9y09EXO1E-AClvPS-mCViSbG0ZMMNh-GM4A3T1NaqXjQWExh5KUJWuADyFlhiTNFtR9iLF_oJJB8uPRy00dlPk4n0rnpdQ0wZnYS1DJlzRd-1_uxsRtdjuQH2Kmg_Wy0srjtLUkJ4vougAQRgxdScwN8hX7-dxCXW1a-RZIdbW2ock8F8Ef0T-6QVMQORbYoObuqBn5ixM3agbeWwrqCKr-5NSop2HK5d_POs4iHXKqFJoYBN-jt6b4dE5I24BNaZp_PGZOHSR4cAJvluDvOkw9DY2KoboGn392DXF1h2i8JiLjozRVKSItsWykyRdHUDZr5By6uc3_VQ4lTpAjpftu1hTSzoZL64GFoezrhetm4n4GTgGO_vmqiKpTrK8hcQ__O5czrElrfRT9tdw6dlOrr7TR6yWmYZFVTXGFFNWMDDmg7dOV_b51COSqCrgtJVYPPUYUAd9TlE3P3RG6kvPgzrGUy8ifILTaUK2Elaux1xyyYVdyMN98lgEP_VSyt5JDZ-J-CX8iixvcRCFQPrcGyUc0i3xr3x6I6sA8K4rMod9nAOOUb6SscvQMaCoLWueGx11Zval_9WH9owSgVJUlh1oz1NH36FEHUWgMUF5vjFKttqC260SaCl69BaXAFKxlZMF3w6WgtDM01dSybomAIADD1ZFnG2gJSlk-ZzqV0EjoQ_5eTZcAiCCJYCH6G_oFBQc5aNhflcKFKHiDR2FP70KQXlCXup_uKgIhSN-kvpLFS-6M23zt-PBZAY5s2rhfN5CEjHi0lvvzcx-N0MM_qM0eEgV6y2g5Ad2N2g6O5kb7iOcaKbECCnLMxCALUx-8AsAuWLlGMM1atrjnF_LSx1t8FCtBrXN8g2vBNLlkqyvgz-X2EXtL8nfTQpDXrcwr-k2ZpM6qUfM6WmsGtNitQ',
    
    // Folder path in Dropbox (relative to app folder if using "App folder" access)
    // Leave empty '' for root/app folder, or specify like '/databases' or '/skimmer'
    folderPath: '',
    
    // File patterns to match (case-insensitive)
    filePatterns: ['.db', '.sqlite', '.sqlite3'],
    
    // Cache settings
    cache: {
      enabled: true,
      maxAge: 3600000, // 1 hour in milliseconds
    },
    
    // Auto-refresh settings
    autoRefresh: {
      enabled: false,
      interval: 3600000, // 1 hour in milliseconds
    }
  }
};

/**
 * Validation helper
 */
export function validateConfig() {
  if (!REMOTE_STORAGE_CONFIG.enabled) {
    return { valid: true, message: 'Remote storage disabled' };
  }
  
  if (REMOTE_STORAGE_CONFIG.type === 'dropbox') {
    if (!REMOTE_STORAGE_CONFIG.dropbox.accessToken) {
      return { 
        valid: false, 
        message: 'Dropbox access token not configured. Please add your token to src/config/remote-storage.js' 
      };
    }
    return { valid: true };
  }
  
  return { valid: true };
}
