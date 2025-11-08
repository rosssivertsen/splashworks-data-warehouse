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
    accessToken: 'sl.u.AGEk1ZPZ6FXQQ7yPnse-oHfiWIQEYDmlGdU12rbMJ52zIG5CxlQapC0eZdEQa79rKU6JUIKmeLx3lfNbqC7dC-XoBQ7CFD3T0h6xCEiFyWM5lQfBduyGPRA02jb5rwZ8DpgvJ0dHx_pxEnJ_odz0YBYwO7NGs0_ZT_dh870s5PcnIpALrtwnbZzdkETSx4LWxRzBXjzmFTEkpvo19jE02rLTW4uBrRaNI18YqFHXd-Q0fRxkdNUk34MzrKjfWA7MLgL8D-7HW-satdsuOGK-Cq4d6xwXD6bkgKzT4lH-9fM_1OtRvcCmrzN4OI51flxlh7Rge0uQrGUbOQFYo9W12TCuu43P7JSMgXXf7uhMXGiWrqZXTa6aKcREz-ZvKVcmXuIOTvBNrw3UPwvvBHcfdo8vc0YPOvTgrZeb0UYWKHLdwbgt_1jq2tINmzLnWZVxu0ylsnfxcoXu-1mxT5qqONiiNYCX0fY_oK270FCpkeZLZXXw_-RZtIUqg3sq2Eg59Ui-HnFbmUMysF8n28BzgfVy39rnwLu7uxlhV4DgLUm7dBRWpkKQ8EqN7pHCRSUqmEYx9s7kPjIQzubm72prwav2J-_lZdJDSFHlOQnH2j6xXzPtXd1aSa06aGxQ1rI2IDA_hENugpJ92SMear7iMSBJ6j66ZaOP-pKm_9r59-wfhgMch0Vvdcvl_PCvmWZYjh8K4Adu-ohvuHnMtWbqbIb3T7dmc5KRvAqJVsDXR0IGxDym_f-IMqlrWWE02ZIhZtfRJkLuwUsnydTzgivDPboMHz1vG8prWye_1_Mkwu-AuYoeBe_20fVnE8z05XkQM-1jIB4J_WuIbsG4zLDLMeYAjkRT_i9tuFJpGueahR1m9dUxdbLQzR8nzPcuF9rCbED4rrXUigq3ou8I81guOpJnhIlqzKy4RZhHNYUb0WT8XJTNo2UEyHZ7HDA-41T6IMD91FfJGJN69jdktL8JXsr97mk-qU1c7GoJvsfbt9Z9Mn5OsP9KBRZ50XrlL6xdQnBiWVwfvU1Mpa0KYkt_ytgds632dc4RC9CoBzO1UWP_iYtNJ2YGF4UK1bL8hln8KvqydolwnTGH2b57-XsHjD5ikJx7k3Q9x_eyIDw_0JZFQ0Rcms3z8op7-3EyC4luSocfC7KriOa3HvV53dpog7A6-JVsxieA3eK8Fniu75msqw2eIrPQyK5uVJCrhUAeo47dNMEfJA54oF8ka3Su9YBo0gxgFQSK6YExNNp_KJ1OyRJ2cFy8X4KXp4dD9t0QFGJa4LS8P77Y37d-pxcB0XUz2rGAN2y2rn_1XGyhIRGjoA',
    
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
