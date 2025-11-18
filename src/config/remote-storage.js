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
    accessToken: 'sl.u.AGHhcJTeYDRvPeMWrGaGQuvMvbpcWc3mDucw_2gppHwz3SEoptzj0o5D9OIgdfebWFiyoOgUqV8zwJiOOpQPH750581Qrl8XcQ4nNQCAwh7TAJdSkcqT6lORKyDiBzU2n7IJFQvniKGKK7LnHV5WpIrWp7S_XtEWh6-UIHH7NvRoWTrkLrfbJvOFSk2HTBEjJnDahEC0B2HqT5M2qugNoNKoyh7tPkwMY_pCuxOu0Ns_a8l4a4OYUUVWAtAqS5LPZOBqU7BMWee8GPwCm2GpeTu-v3NJmV7c489Ecd7b7EBhgb8uIjEueHdwdsA2zteyafC4L-5zpYRT6C6LLdv4nXqu7-KWI3hkMb5PXtUzr7pPeQa0hjgDT-znqpKq3Bxok5KH0GpfkziYcNNdvqQcWi5HhZ5UPwptsB0NxmexWpxe_OQ38_oNeJJSxKjChnVW2M4DxVXrw8eew5gbGEr05VF9xY0pNnteJzzxyDfO88u6xaSxAiB4406GcLoYhNGNeiWpFhySUYLkynR457WiPw-mwIykOGq6JjgJ5nv2mTm4HjEkwg9_SIB9TKkSmIO8ouEoKBFxApc2ECF3v63APCywJ89bSzUbLzO09w5LYunlG66cRIBEtBlD__sZaHEOK0H9PAaVlJVfW8kk-iDtCxM_XJHriG7LvQQwQ2xinf5U4VJfUXkRRR2zAZ2WJPpiCMqyJj_W4Ipe8Pyx2l6RNWqw7I-j5N_WahD3rdzxjuKz1vtVhEJYbcdHXn6iU6J3PfyYJALJNkNJcqGfAlgqy1J1aaGFrB9rP5-r3VQKo7AWFbJeHgAHcW-dtVwJhedoJWjOaPzu4owIFSv5t8ZDy3o_bceco01rl9i3Ws26sUSqTGCNGc3vyFrg3uekgyW-Iqyw7sw7lOLMaQ22Xs95wOdqi1bEwzRdMULl9pwd-XREVnZCr-ocDUmvKezm3hmhbB_77HKnHRep-tPAlHnznbitbYnBGohVJT0jIn3I-lQKfzmXiRvIn5nGEBS6ZokIGcQCIJlxlvPnbEJcqQfbPz0blE8w-e7ayh64FCl4kCgGIMAOrmkZBCqqjU88wk_tb_gk1XUegl_34YNeKZGnP4fKZDmKxr7tH8H8VpllvOmAhEtPg6NxPrP8jComa5qLne-Hz0-SiPbJZXj4YuISijHrAeyKoIlpn-SMtJ3Th3M3mwWcZ6Z4dIzSzBhPCpj4mRL3qTqWuB-bN7Kp4CIEOUqTQF9oqc5B1CGOET1QtaQXJdwrSAZ-twLQPeu8x9ugf-b8Y05LFw9Yecdoh0XzoNCNaHJy7t_5h3QUznKrD6f-rAsl.u.AGGaEZgkv7XuknfTpjYbvrcV946FkXo45YBw0iCjMp9NjWiooYaXnjj5J5othUGMV5CpaKbah9M9yCITVkc-L-AqWDYUm9QfOMEK9PYZBgh3T72DcuxbCx8n140c3mAkSGr8QezrIrq9wGMRzH0iw22rvNzX_xXazrBnkHH-G38giqXmIoRSyDYVTgUN4-qh_-GjypabaMJnTlIW9CLvrJER6u_O79a_p8zU9x-d79wPAeLuhfy4Qfe54WrLQ58L7NM5DMtHe4caJllVE-R_hl0b_Yx763oKJOB6G_PRTghYhbjknPBGSe7YciNl2eqfeEdBt9RV2RJZWV9_qCIj94PyXTC-Svuvyegdat6tDzMu_xS4vIefACl3roWOV8PGyS39zXEj6c4vhY1mxOfXGW0mIIK2QfXMkd50hxcYINGVqfjCx6F51ZTkAMVopN2yB2pYYbLxK_z1DP08w0UmiAx1eytbBeGPKxHGvYbstyDVO5eg8PV9-ZcuxH7ZvXkZbN-XC1p5I1vbyhv7zha_Uqe1ddL4CAbdUlxoM8w3qKX5hM1xEMWr7wq3INMSiI4JtG7DPMTGAXUan31oNhgUeRzdnILA4IvpRFAWTSuZiOBA8bIiM0TY9W1wsKZxbs2hGKry8XV9OtN4ke3pknd8_1PTnNHDMheLx-jAUmHZDDlExz5XNHDv6gNX3BJ1GFrzVh9JGq50eGaXQbj-L024FXTmUGncXAZ18Z1xVxRrVsArowH74PHxtnc9TevxgP9WE1bevjITXuDJ_dG0wUYmsjEE4Vu6aFp_TS5WzL6Yd4qWFLn1-DSmeh3-0MjzX4PFCIEKRPd69nTTOYbDAPKQRLu9DwWB2wErNwGa5lIrLHTCNxKSeYOZIddKoxQAB0b8rAdEWUG-woJIq1BSq2doTADHrAegiLeoUJqOQCcqxn_fCVTu-FEwSX5bs7GPB2mRdJXXOMjlfaluvGLui3o5a73Mkne_W4Oc1YCcK44qd0H7DxHMpOK6MAwEP2c4-s20FkSq0Hi4xJl0ggtEubi4M9X8xbGMFDfwO4B1oRwyEH5mN8byW3eKRcQShGCBlX2Xz0sMd3Gkm0lyWn5gVNUGju83N4m9gWAtvv4TZD0wWjJAauB5dJbLlNcYFRUh_U2hh7ZBUUeHHyKjd5r1-83-Vo7aO41gb7j8meduD-F_1EJsR4-JHbJe_hvaUqj-5PU2NMI8XW0HU96hAMbnxA3bB0l_xN96m3SoxlvPcXRmgD9FAalYsp5Raf7RtXBEnltqy49S4XsJOQW3CNDcmWcLIcEmD7B9YBqfHKtl_eHstHFVmg',
    
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
