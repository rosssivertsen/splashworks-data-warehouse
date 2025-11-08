# Dropbox Integration Setup Guide

## Quick Start

Your application now supports loading SQLite databases from Dropbox automatically. Follow these steps to complete the setup:

### Step 1: Create a Dropbox App

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click **"Create app"**
3. Choose **"Scoped access"**
4. Choose **"App folder"** (recommended) or **"Full Dropbox"**
5. Name your app (e.g., "Skimmer-Database-Loader")
6. Click **"Create app"**

### Step 2: Generate Access Token

1. In your app settings, scroll to **"OAuth 2"** section
2. Under **"Generated access token"**, click **"Generate"**
3. Copy the token (starts with `sl.`)
4. **⚠️ Important:** Keep this token secure - don't commit it to git

### Step 3: Configure the Application

1. Open `src/config/remote-storage.js`
2. Find the line: `accessToken: '',`
3. Paste your Dropbox token:
   ```javascript
   accessToken: 'sl.YOUR_TOKEN_HERE',
   ```
4. Optionally configure the folder path:
   ```javascript
   folderPath: '', // empty = root/app folder
   // or specify a subfolder:
   folderPath: '/databases', // for a 'databases' folder
   ```
5. Save the file

### Step 4: Upload Databases to Dropbox

1. If you chose **"App folder"** access:
   - Go to Dropbox
   - Navigate to **Apps > [Your App Name]**
   - Upload your `.db`, `.sqlite`, or `.sqlite3` files here

2. If you chose **"Full Dropbox"** access:
   - Upload files to any folder
   - Update `folderPath` in config to match your folder location

### Step 5: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the **"Upload Database"** tab
3. You should see a **"Dropbox Databases"** section at the top
4. Your databases should be listed automatically
5. Click any database to load it

## Features

✅ **Automatic Discovery** - All SQLite files in the folder are automatically detected  
✅ **One-Click Loading** - Click any database to load it instantly  
✅ **File Metadata** - See file sizes and last modified dates  
✅ **Refresh Button** - Manually refresh the list when new files are added  
✅ **Local Upload** - Local file upload still works as before  

## Configuration Options

In `src/config/remote-storage.js`, you can customize:

```javascript
export const REMOTE_STORAGE_CONFIG = {
  // Enable/disable remote storage
  enabled: true, // Set to false to disable Dropbox
  
  dropbox: {
    // Your access token
    accessToken: 'sl.YOUR_TOKEN_HERE',
    
    // Folder path (relative to app folder or root)
    folderPath: '', // '' = root, or '/subfolder'
    
    // Supported file extensions
    filePatterns: ['.db', '.sqlite', '.sqlite3'],
    
    // Cache settings (for future enhancements)
    cache: {
      enabled: true,
      maxAge: 3600000, // 1 hour
    }
  }
};
```

## Automation

Once configured, you can automate database updates:

### Option 1: Dropbox Desktop App (Easiest)

1. Install [Dropbox Desktop](https://www.dropbox.com/desktop)
2. Create an automation script that exports your database to the Dropbox folder
3. The file will automatically sync to Dropbox
4. Users will see the updated database on next refresh

### Option 2: Dropbox API Upload Script

```bash
#!/bin/bash
# Script to upload database to Dropbox

DB_FILE="path/to/your/database.db"
DROPBOX_TOKEN="your_dropbox_token_here"
DROPBOX_PATH="/latest.db"

curl -X POST https://content.dropboxapi.com/2/files/upload \
  --header "Authorization: Bearer $DROPBOX_TOKEN" \
  --header "Dropbox-API-Arg: {\"path\": \"$DROPBOX_PATH\",\"mode\": \"overwrite\"}" \
  --header "Content-Type: application/octet-stream" \
  --data-binary @"$DB_FILE"

echo "Database uploaded to Dropbox!"
```

Save as `upload-to-dropbox.sh`, make executable with `chmod +x upload-to-dropbox.sh`, and run periodically.

### Option 3: GitHub Actions (For CI/CD)

```yaml
name: Upload Database to Dropbox

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - name: Export Database
        run: |
          # Your database export command
          ./export-database.sh
      
      - name: Upload to Dropbox
        env:
          DROPBOX_TOKEN: ${{ secrets.DROPBOX_TOKEN }}
        run: |
          curl -X POST https://content.dropboxapi.com/2/files/upload \
            --header "Authorization: Bearer $DROPBOX_TOKEN" \
            --header "Dropbox-API-Arg: {\"path\": \"/latest.db\",\"mode\": \"overwrite\"}" \
            --header "Content-Type: application/octet-stream" \
            --data-binary @output/database.db
```

## Troubleshooting

### "Dropbox Configuration Required" Message

**Problem:** Yellow warning about missing access token  
**Solution:** Add your Dropbox access token to `src/config/remote-storage.js`

### "Failed to load files from Dropbox"

**Problem:** 401 Unauthorized error  
**Solution:** 
- Verify your access token is correct
- Check if token has expired (regenerate if needed)
- Ensure app has correct permissions

### "No SQLite database files found"

**Problem:** Files uploaded but not showing  
**Solution:**
- Verify files are in the correct folder
- Check file extensions match: `.db`, `.sqlite`, or `.sqlite3`
- Try the **Refresh** button
- Verify `folderPath` in config matches your Dropbox structure

### Database Loads but Shows No Tables

**Problem:** Database file is corrupt or empty  
**Solution:**
- Verify the database file locally first
- Re-export and upload a fresh copy
- Check export script for errors

## Security Notes

1. **Never commit your access token to git**
   - Add `src/config/remote-storage.js` to `.gitignore` if needed
   - Or use environment variables for production

2. **Use "App folder" access** (more secure)
   - Limits access to specific folder
   - Reduces risk if token is compromised

3. **Rotate tokens periodically**
   - Regenerate access tokens every few months
   - Update config with new token

4. **Consider data sensitivity**
   - Dropbox files can be public or private
   - Remove sensitive data before uploading if needed

## Next Steps

1. Complete the setup steps above
2. Test loading a database from Dropbox
3. Set up automation for periodic updates
4. Configure any additional settings as needed

For more advanced storage options (S3, Netlify Blobs, etc.), see `docs/REMOTE_STORAGE_GUIDE.md`.
