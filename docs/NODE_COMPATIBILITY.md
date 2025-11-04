# Node.js Compatibility Issue

## Problem

If you're using Node.js v25.x, you'll encounter this error when running `npm run dev`:

```
TypeError: Cannot read properties of undefined (reading 'prototype')
    at Object.<anonymous> (.../buffer-equal-constant-time/index.js:37:35)
```

## Root Cause

Netlify CLI has a compatibility issue with Node.js v25.x. The `buffer-equal-constant-time` package used by Netlify CLI is not compatible with Node.js v25.

## Solution

### Option 1: Downgrade to Node.js v20 LTS (Recommended)

Use Node Version Manager (nvm) to switch to Node.js v20:

```bash
# Install Node.js v20 if you don't have it
nvm install 20

# Use Node.js v20
nvm use 20

# Verify the version
node --version

# Now run the dev server
npm run dev
```

### Option 2: Use Vite Only (Limited Functionality)

If you can't downgrade Node.js, you can run Vite directly:

```bash
npx vite
```

**What works:**
- ✅ Database upload and exploration
- ✅ **Database union feature** (NEW!)
- ✅ SQL query writing and execution
- ✅ Chart visualization
- ✅ All browser-based features

**What doesn't work:**
- ❌ AI Query Interface (requires Netlify functions)
- ❌ AI Assistant (requires Netlify functions)
- ❌ Business Insights (requires Netlify functions)

## Testing the Database Union Feature

The database union feature works entirely in the browser, so you can test it with just `npx vite`:

1. Start the server: `npx vite`
2. Open http://localhost:5173
3. Go to "Upload Database" tab
4. Click "Union Multiple" mode
5. Select both AQPS.db and JOMO.sqlite from test-databases/
6. Click "Union 2 Databases"
7. Explore the unified data!

## Long-term Solution

Monitor Netlify CLI updates for Node.js v25 support:
- https://github.com/netlify/cli/issues

Or stick with Node.js v20 LTS, which is the recommended version for production use anyway.

## Checking Your Node.js Version

```bash
node --version
```

## Recommended: Use .nvmrc

Create a `.nvmrc` file in your project root to lock the Node.js version:

```
20
```

Then team members can simply run:
```bash
nvm use
```

---

**Last Updated:** January 3, 2025
