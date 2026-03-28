# Remote Database Storage Guide

## Overview

This guide provides options for hosting your SQLite databases remotely so they can be automatically loaded by the application and updated via automation.

## Current Architecture

The application currently stores databases in **browser-side IndexedDB** after manual upload. For automated updates and remote hosting, we need to shift to a **fetch-based model** where databases are loaded from remote URLs.

## Recommended Solutions

### Option 1: AWS S3 (Recommended for Automation)

**Best for:** Automated updates, enterprise reliability, cost-effectiveness

#### Advantages
- Industry-standard, highly reliable
- Simple automation via AWS CLI or SDK
- Cost-effective ($0.023/GB/month storage + minimal transfer costs)
- Easy CORS configuration for browser access
- Versioning support for rollback
- Direct public URLs or pre-signed URLs for security

#### Implementation Steps

1. **Set up S3 Bucket**
```bash
# Install AWS CLI
brew install awscli  # macOS
# or download from aws.amazon.com/cli/

# Configure credentials
aws configure

# Create bucket
aws s3 mb s3://your-skimmer-databases --region us-east-1
```

2. **Configure CORS**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://your-app.netlify.app", "http://localhost:*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Save as `cors-config.json` and apply:
```bash
aws s3api put-bucket-cors --bucket your-skimmer-databases --cors-configuration file://cors-config.json
```

3. **Set Public Read Access** (if databases aren't sensitive)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-skimmer-databases/*"
    }
  ]
}
```

4. **Upload Database via Automation**
```bash
# Manual upload
aws s3 cp skimmer-production.db s3://your-skimmer-databases/latest.db --acl public-read

# Automated script (e.g., cron job, GitHub Action)
#!/bin/bash
# Compress database
gzip -c skimmer-production.db > skimmer-production.db.gz

# Upload to S3
aws s3 cp skimmer-production.db.gz s3://your-skimmer-databases/latest.db.gz \
  --acl public-read \
  --metadata-directive REPLACE \
  --cache-control "max-age=300"
```

5. **Access URL Format**
```
https://your-skimmer-databases.s3.amazonaws.com/latest.db
# or with CloudFront CDN:
https://d1234567890.cloudfront.net/latest.db
```

#### Cost Estimate
- Storage: $0.023/GB/month (first 50TB)
- Requests: GET $0.0004 per 1,000 requests
- Data transfer: Free for first 100GB/month out to internet
- **Example:** 100MB database updated daily, 1,000 loads/month = ~$0.05/month

---

### Option 2: Netlify Blobs

**Best for:** Staying in Netlify ecosystem, simple integration

#### Advantages
- Native Netlify integration
- No separate service to manage
- Generous free tier (100GB bandwidth/month)
- Simple API
- Automatic CDN distribution

#### Implementation Steps

1. **Install Netlify Blobs SDK**
```bash
npm install @netlify/blobs
```

2. **Create Netlify Function for Database Upload**
```javascript
// netlify/functions/upload-database.mjs
import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const store = getStore('databases');
  
  if (req.method === 'PUT') {
    const database = await req.arrayBuffer();
    await store.set('latest', database, {
      metadata: {
        uploadDate: new Date().toISOString()
      }
    });
    return new Response('Database uploaded', { status: 200 });
  }
  
  return new Response('Method not allowed', { status: 405 });
};
```

3. **Create Function for Database Download**
```javascript
// netlify/functions/get-database.mjs
import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const store = getStore('databases');
  const database = await store.get('latest', { type: 'arrayBuffer' });
  
  if (!database) {
    return new Response('Database not found', { status: 404 });
  }
  
  return new Response(database, {
    headers: {
      'Content-Type': 'application/x-sqlite3',
      'Cache-Control': 'public, max-age=300'
    }
  });
};
```

4. **Upload via Automation**
```bash
# Use Netlify CLI or API
curl -X PUT https://your-app.netlify.app/.netlify/functions/upload-database \
  --data-binary @skimmer-production.db \
  -H "Authorization: Bearer YOUR_TOKEN"
```

5. **Access URL**
```
https://your-app.netlify.app/.netlify/functions/get-database
```

#### Cost Estimate
- Free tier: 100GB bandwidth/month, 2GB storage
- Pro plan ($19/month): 400GB bandwidth, 10GB storage

---

### Option 3: Dropbox

**Best for:** Manual management, simple setup

#### Advantages
- User-friendly interface
- Simple API
- Good for non-technical database updates
- 2GB free storage

#### Implementation Steps

1. **Create Dropbox App**
- Go to dropbox.com/developers/apps
- Create app with "App folder" access
- Generate access token

2. **Upload Database**
```bash
# Manual: Use Dropbox web interface or desktop app

# API upload script
curl -X POST https://content.dropboxapi.com/2/files/upload \
  --header "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  --header "Dropbox-API-Arg: {\"path\": \"/latest.db\",\"mode\": \"overwrite\"}" \
  --header "Content-Type: application/octet-stream" \
  --data-binary @skimmer-production.db
```

3. **Get Shared Link**
```bash
curl -X POST https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings \
  --header "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data "{\"path\": \"/latest.db\",\"settings\": {\"access\": \"viewer\"}}"
```

4. **Convert to Direct Download Link**
```
Original: https://www.dropbox.com/s/abc123/latest.db?dl=0
Direct:   https://dl.dropboxusercontent.com/s/abc123/latest.db
```

#### Cost Estimate
- Free: 2GB storage
- Plus: $11.99/month for 2TB

---

### Option 4: GitHub Releases (Alternative)

**Best for:** Version control, free hosting, CI/CD integration

#### Advantages
- Free for public repos
- Version history
- Easy CI/CD integration
- Direct download URLs

#### Implementation
```bash
# Create release and upload database
gh release create v1.0.0 skimmer-production.db \
  --repo your-org/skimmer-databases \
  --title "Production Database $(date +%Y-%m-%d)" \
  --notes "Automated database update"

# Download URL:
# https://github.com/your-org/skimmer-databases/releases/download/v1.0.0/skimmer-production.db
```

---

## Implementation in Your App

### Step 1: Create Database Loader Component

```javascript
// src/components/RemoteDatabaseLoader.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const RemoteDatabaseLoader = ({ sqlInstance, onDatabaseLoad, remoteUrl }) => {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const loadRemoteDatabase = async () => {
    if (!sqlInstance || !remoteUrl) return;

    setStatus('loading');
    setError(null);

    try {
      // Fetch with progress tracking
      const response = await fetch(remoteUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength, 10);
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        if (total) {
          setProgress(Math.round((loaded / total) * 100));
        }
      }

      // Combine chunks
      const dataArray = new Uint8Array(loaded);
      let position = 0;
      for (const chunk of chunks) {
        dataArray.set(chunk, position);
        position += chunk.length;
      }

      // Create database
      const database = new sqlInstance.Database(dataArray);
      
      // Verify database
      const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
      if (tables.length === 0 || tables[0].values.length === 0) {
        throw new Error('No tables found in database');
      }

      onDatabaseLoad(database);
      setStatus('success');

    } catch (err) {
      setError(`Failed to load remote database: ${err.message}`);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (sqlInstance && remoteUrl) {
      loadRemoteDatabase();
    }
  }, [sqlInstance, remoteUrl]);

  return (
    <div className="space-y-4">
      {status === 'loading' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-gray-600">Loading database... {progress}%</p>
        </motion.div>
      )}

      {status === 'success' && (
        <p className="text-green-600 text-center">Database loaded successfully!</p>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={loadRemoteDatabase}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default RemoteDatabaseLoader;
```

### Step 2: Configuration File

```javascript
// src/config/remote-storage.js
export const REMOTE_STORAGE_CONFIG = {
  enabled: true,
  type: 's3', // 's3', 'netlify', 'dropbox', 'github'
  url: 'https://your-skimmer-databases.s3.amazonaws.com/latest.db',
  
  // Optional: Multiple database sources
  databases: [
    {
      name: 'Production',
      url: 'https://your-bucket.s3.amazonaws.com/production.db'
    },
    {
      name: 'Development',
      url: 'https://your-bucket.s3.amazonaws.com/development.db'
    }
  ],
  
  // Cache settings
  cache: {
    enabled: true,
    maxAge: 3600000, // 1 hour in milliseconds
    storage: 'indexeddb' // 'indexeddb' or 'memory'
  },
  
  // Auto-refresh settings
  autoRefresh: {
    enabled: false,
    interval: 3600000 // 1 hour
  }
};
```

### Step 3: Update App.tsx

```typescript
// Add to your App.tsx imports
import RemoteDatabaseLoader from './components/RemoteDatabaseLoader';
import { REMOTE_STORAGE_CONFIG } from './config/remote-storage';

// In your component:
{REMOTE_STORAGE_CONFIG.enabled && !database && (
  <RemoteDatabaseLoader
    sqlInstance={sqlInstance}
    onDatabaseLoad={handleDatabaseLoad}
    remoteUrl={REMOTE_STORAGE_CONFIG.url}
  />
)}
```

---

## Automation Examples

### GitHub Actions (Daily Update)

```yaml
# .github/workflows/update-database.yml
name: Update Skimmer Database

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Export Database
        run: |
          # Your database export logic
          ./export-skimmer-db.sh
      
      - name: Upload to S3
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws s3 cp skimmer-production.db \
            s3://your-skimmer-databases/latest.db \
            --acl public-read
```

### Cron Job (Unix/Linux)

```bash
# Add to crontab (crontab -e)
0 2 * * * /path/to/update-database.sh

# update-database.sh
#!/bin/bash
set -e

# Export database
cd /path/to/skimmer
./export-database.sh

# Upload to S3
aws s3 cp output/skimmer.db \
  s3://your-skimmer-databases/latest.db \
  --acl public-read

# Or upload to Dropbox
curl -X POST https://content.dropboxapi.com/2/files/upload \
  --header "Authorization: Bearer $DROPBOX_TOKEN" \
  --header "Dropbox-API-Arg: {\"path\": \"/latest.db\",\"mode\": \"overwrite\"}" \
  --header "Content-Type: application/octet-stream" \
  --data-binary @output/skimmer.db
```

---

## Security Considerations

### For Public Databases
1. **Remove sensitive data** before upload
2. Use **data masking** for PII
3. Consider **read-only views** instead of full database

### For Private Databases
1. Use **pre-signed URLs** (S3, Dropbox)
2. Implement **authentication** in Netlify Functions
3. Use **IP allowlisting** where possible
4. Enable **encryption at rest** (S3, Azure)

### Pre-signed URL Example (S3)

```javascript
// Backend/function to generate pre-signed URL
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

async function getPresignedUrl() {
  const client = new S3Client({ region: 'us-east-1' });
  const command = new GetObjectCommand({
    Bucket: 'your-skimmer-databases',
    Key: 'latest.db'
  });
  
  // URL expires in 1 hour
  return await getSignedUrl(client, command, { expiresIn: 3600 });
}
```

---

## Comparison Matrix

| Feature | S3 | Netlify Blobs | Dropbox | GitHub |
|---------|-------|---------------|---------|---------|
| Cost (100MB) | $0.002/mo | Free | Free | Free |
| Setup Complexity | Medium | Low | Low | Low |
| Automation | Excellent | Good | Good | Excellent |
| CDN | Optional | Built-in | No | Built-in |
| Version Control | Yes | No | Yes | Yes |
| File Size Limit | 5TB | 10GB | 2GB (free) | 2GB |
| CORS Support | Easy | Built-in | Limited | No |
| Best For | Production | Netlify apps | Quick start | Open source |

---

## Recommendation

**For your use case (automated periodic updates):**

1. **Primary: AWS S3** - Most reliable, best automation support, cost-effective
2. **Alternative: Netlify Blobs** - If staying in Netlify ecosystem
3. **Backup: Dropbox** - Simple fallback option

### Suggested Architecture

```
[Automated Export] → [S3 Bucket] → [CloudFront CDN] → [Your App]
                          ↓
                    [Version History]
                          ↓
                    [Rollback Capability]
```

Would you like me to implement any of these solutions for you?
