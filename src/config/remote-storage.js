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
    accessToken: 'sl.u.AGHhcJTeYDRvPeMWrGaGQuvMvbpcWc3mDucw_2gppHwz3SEoptzj0o5D9OIgdfebWFiyoOgUqV8zwJiOOpQPH750581Qrl8XcQ4nNQCAwh7TAJdSkcqT6lORKyDiBzU2n7IJFQvniKGKK7LnHV5WpIrWp7S_XtEWh6-UIHH7NvRoWTrkLrfbJvOFSk2HTBEjJnDahEC0B2HqT5M2qugNoNKoyh7tPkwMY_pCuxOu0Ns_a8l4a4OYUUVWAtAqS5LPZOBqU7BMWee8GPwCm2GpeTu-v3NJmV7c489Ecd7b7EBhgb8uIjEueHdwdsA2zteyafC4L-5zpYRT6C6LLdv4nXqu7-KWI3hkMb5PXtUzr7pPeQa0hjgDT-znqpKq3Bxok5KH0GpfkziYcNNdvqQcWi5HhZ5UPwptsB0NxmexWpxe_OQ38_oNeJJSxKjChnVW2M4DxVXrw8eew5gbGEr05VF9xY0pNnteJzzxyDfO88u6xaSxAiB4406GcLoYhNGNeiWpFhySUYLkynR457WiPw-mwIykOGq6JjgJ5nv2mTm4HjEkwg9_SIB9TKkSmIO8ouEoKBFxApc2ECF3v63APCywJ89bSzUbLzO09w5LYunlG66cRIBEtBlD__sZaHEOK0H9PAaVlJVfW8kk-iDtCxM_XJHriG7LvQQwQ2xinf5U4VJfUXkRRR2zAZ2WJPpiCMqyJj_W4Ipe8Pyx2l6RNWqw7I-j5N_WahD3rdzxjuKz1vtVhEJYbcdHXn6iU6J3PfyYJALJNkNJcqGfAlgqy1J1aaGFrB9rP5-r3VQKo7AWFbJeHgAHcW-dtVwJhedoJWjOaPzu4owIFSv5t8ZDy3o_bceco01rl9i3Ws26sUSqTGCNGc3vyFrg3uekgyW-Iqyw7sw7lOLMaQ22Xs95wOdqi1bEwzRdMULl9pwd-XREVnZCr-ocDUmvKezm3hmhbB_77HKnHRep-tPAlHnznbitbYnBGohVJT0jIn3I-lQKfzmXiRvIn5nGEBS6ZokIGcQCIJlxlvPnbEJcqQfbPz0blE8w-e7ayh64FCl4kCgGIMAOrmkZBCqqjU88wk_tb_gk1XUegl_34YNeKZGnP4fKZDmKxr7tH8H8VpllvOmAhEtPg6NxPrP8jComa5qLne-Hz0-SiPbJZXj4YuISijHrAeyKoIlpn-SMtJ3Th3M3mwWcZ6Z4dIzSzBhPCpj4mRL3qTqWuB-bN7Kp4CIEOUqTQF9oqc5B1CGOET1QtaQXJdwrSAZ-twLQPeu8x9ugf-b8Y05LFw9Yecdoh0XzoNCNaHJy7t_5h3QUznKrD6f-rA',
    
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
