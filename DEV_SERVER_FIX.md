# Dev Server Fix - JSON Parsing Error

## Problem
You were getting these errors:
- "Failed to generate insights: Failed to execute 'json' on 'Response': Unexpected end of JSON input"
- "AI API Error: Failed to execute 'json' on 'Response': Unexpected end of JSON input"

## Root Cause
You were running `npm run dev` which only started the Vite development server. The Netlify serverless functions (which handle AI API calls) were not running, so requests to `/.netlify/functions/ai-query` were failing.

## Solution Applied

The fix has been successfully applied! The dev server is now running with both:
- ✓ Netlify Dev on http://localhost:8888
- ✓ Vite on port 5174
- ✓ Netlify Functions loaded (`ai-query`)

### To use the application:
1. Open **http://localhost:8888** in your browser
2. Upload a database
3. Try generating insights - it should work now!

### If you need to restart:
```bash
# Stop the server (Ctrl+C)
# Then restart with:
npm run dev
```

## What Changed

### 1. Updated `package.json`
- Added `netlify-cli` as a dev dependency
- Changed `"dev": "vite"` to `"dev": "netlify dev"`
- Added `"dev:vite": "vite"` if you ever need just the Vite server

### 2. Updated `netlify.toml`
- Changed dev command from `npm run dev` to `npm run dev:vite` to avoid circular dependency

### 3. Improved Error Handling in `src/services/aiService.js`
- Added better error messages that tell you when functions aren't running
- Added try-catch blocks to handle connection failures gracefully

## Important Notes

- **Always use `npm run dev`** (not `npm run dev:vite`) when working with AI features
- The dev server will now be available at http://localhost:8888 (Netlify's default port)
- If you see "Cannot connect to AI service" errors, make sure you're using `npm run dev`

## Alternative: Direct Vite Development
If you want to work on the frontend without AI features, you can use:
```bash
npm run dev:vite
```
This runs just Vite on port 5173, but AI features won't work.
