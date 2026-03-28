# Netlify Setup Guide

## Quick Start

### 1. Install Netlify CLI

```bash
npm install -g netlify-cli
```

### 2. Test Locally

```bash
# Stop your current Vite dev server (Ctrl+C)

# Start Netlify dev server (includes both frontend and functions)
netlify dev
```

This will:
- Start Vite dev server on port 5173
- Start Netlify functions on port 8888
- Proxy everything through port 8888
- Access app at: **http://localhost:8888**

### 3. Test AI Queries

1. Open http://localhost:8888
2. Upload a database
3. Go to Settings tab
4. Enter your API key (OpenAI or Anthropic)
5. Go to AI Query Interface
6. Ask a question like: "Show me top 10 customers by revenue"

The serverless function will proxy your request!

### 4. Deploy to Netlify

#### First Time Setup

```bash
# Login to Netlify
netlify login

# Initialize site
netlify init

# Follow prompts:
# - Create & configure new site
# - Team: Your team
# - Site name: your-app-name
# - Build command: npm run build
# - Deploy directory: dist
```

#### Deploy

```bash
# Deploy to production
netlify deploy --prod

# Or deploy preview first
netlify deploy
```

## Troubleshooting

### Function Not Found (404)

If you get 404 on `/.netlify/functions/ai-query`:

1. Make sure `netlify dev` is running (not `npm run dev`)
2. Check `netlify.toml` exists in project root
3. Check `netlify/functions/ai-query.js` exists

### CORS Errors

You should NOT see CORS errors with Netlify functions. If you do:

1. Verify you're accessing app via `localhost:8888` (not 5173)
2. Check function is being called (see Network tab in DevTools)
3. Check function logs in terminal

### API Key Not Working

If API calls fail:

1. Check API key is correctly entered in Settings
2. Check provider is selected correctly (OpenAI vs Anthropic)
3. Look at function logs in terminal for detailed errors

## Architecture

```
Browser (localhost:8888)
    ↓
Netlify Dev Server (port 8888)
    ↓
    ├─→ Frontend (Vite on 5173)
    └─→ Functions (/.netlify/functions/*)
            ↓
        ai-query function
            ↓
            ├─→ OpenAI API
            └─→ Anthropic API
```

## Production URLs

After deployment, your app will be at:
- `https://your-app-name.netlify.app`

Functions automatically available at:
- `https://your-app-name.netlify.app/.netlify/functions/ai-query`

## Environment Variables (Optional)

For production, you can store API keys server-side:

1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Add:
   - `OPENAI_API_KEY` = your key
   - `ANTHROPIC_API_KEY` = your key

3. Update function to read from env vars instead of request body

This way API keys never leave the server!

## Useful Commands

```bash
# Start dev server
netlify dev

# View function logs
netlify dev --debug

# Deploy preview
netlify deploy

# Deploy production
netlify deploy --prod

# Open site in browser
netlify open:site

# View function logs in production
netlify functions:log ai-query
```

## Free Tier Limits

Netlify Free Tier includes:
- ✅ 125K function invocations/month
- ✅ 100 hours function runtime/month
- ✅ 100GB bandwidth/month
- ✅ Automatic HTTPS
- ✅ Continuous deployment from Git

More than enough for most use cases!

## Next Steps

1. Test locally with `netlify dev`
2. Verify AI queries work with both providers
3. Deploy to production with `netlify deploy --prod`
4. Share your app URL!

## Support

- Netlify Docs: https://docs.netlify.com
- Netlify Functions: https://docs.netlify.com/functions/overview/
- Community: https://answers.netlify.com/
