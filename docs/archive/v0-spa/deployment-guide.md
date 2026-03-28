# Multi-Environment Deployment Guide

This guide explains how to deploy the Splashworks Pool Service BI Visualizer to three Netlify environments.

## Environment Overview

| Environment | Branch | Purpose | URL Pattern |
|-------------|--------|---------|-------------|
| **Development** | `development` | Feature development & testing | `https://dev--splashworks-bi.netlify.app` |
| **Staging** | `staging` | User acceptance testing | `https://staging--splashworks-bi.netlify.app` |
| **Production** | `main` | Live production site | `https://splashworks-bi.netlify.app` |

## Prerequisites

1. **Netlify CLI installed**: `npm install -g netlify-cli`
2. **Netlify authentication**: `netlify login`
3. **Three Netlify sites configured** (see setup section below)

## Netlify Site Setup

### Option 1: Manual Site Creation (Recommended)

1. **Create three sites in Netlify:**
   ```bash
   # Production site
   netlify sites:create --name splashworks-bi-production
   
   # Staging site  
   netlify sites:create --name splashworks-bi-staging
   
   # Development site
   netlify sites:create --name splashworks-bi-development
   ```

2. **Configure branch deployments for each site:**
   - **Production site**: Deploy from `main` branch
   - **Staging site**: Deploy from `staging` branch  
   - **Development site**: Deploy from `development` branch

### Option 2: Single Site with Branch Deploys

1. Create one primary site and configure branch-specific contexts
2. Netlify will automatically create preview deployments for each branch

## Deployment Commands

### Quick Deployments

```bash
# Development environment
npm run deploy:development

# Staging environment  
npm run deploy:staging

# Production environment
npm run deploy:production
```

### Branch Management & Promotion

```bash
# Promote development to staging
npm run promote:staging

# Promote staging to production  
npm run promote:production

# Direct promotion (development to production)
npm run promote:direct

# Full pipeline (dev → staging → production)
npm run pipeline:full
```

## Environment Configuration

### Environment Variables

Each environment automatically sets:

- **Development**:
  - `NODE_ENV=development`
  - `ENVIRONMENT=development` 
  - `REACT_APP_ENV=development`

- **Staging**:
  - `NODE_ENV=staging`
  - `ENVIRONMENT=staging`
  - `REACT_APP_ENV=staging`

- **Production**:
  - `NODE_ENV=production`
  - `ENVIRONMENT=production`
  - `REACT_APP_ENV=production`

### AI API Keys

**Important**: Set API keys in Netlify site settings for each environment:

1. Go to Netlify Dashboard → Site → Environment Variables
2. Add environment-specific variables:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - Any other sensitive configuration

## Deployment Workflow

### 1. Feature Development

```bash
# Work on development branch
git checkout development
# ... make changes ...
git add .
git commit -m "feat: new feature"
git push origin development

# Deploy to development environment
npm run deploy:development
```

### 2. User Acceptance Testing

```bash
# Promote to staging for UAT
npm run promote:staging

# OR manually merge to staging
git checkout staging
git merge development
git push origin staging

# Deploy staging
npm run deploy:staging
```

### 3. Production Release

```bash
# After UAT approval, promote to production
npm run promote:production

# OR manually merge to main
git checkout main
git merge staging
git push origin main

# Deploy production
npm run deploy:production
```

## Automated CI/CD with GitHub Actions

### Complete Workflow Overview

The project includes a fully automated CI/CD pipeline that triggers on every push:

**✅ Automatic Triggers:**
- Push to `development` branch → Automatically deploys to development environment
- Push to `staging` branch → Automatically deploys to staging environment  
- Push to `main` branch → Automatically deploys to production environment

### GitHub Actions Workflow

The `.github/workflows/deploy.yml` file handles:

1. **Build & Test**: Runs on every push and PR
   - TypeScript compilation
   - ESLint code quality checks
   - Vitest unit tests
   - Build artifact creation

2. **Automated Deployment**: Deploys to environment based on branch
   - `development` → Development environment
   - `staging` → Staging environment
   - `main` → Production environment

### Complete Development Workflow

#### 1. Feature Development
```bash
# Work on development branch
git checkout development
# ... make changes ...
git add -A
git commit -m "feat: new feature"
git push origin development
```
**Result**: ✅ Automatically deploys to development environment via GitHub Actions

#### 2. Promote to Staging
```bash
# Use automated promotion script
npm run promote:staging
```
**What happens**:
- Script merges `development` → `staging` 
- Pushes to `staging` branch
- ✅ GitHub Actions automatically deploys to staging environment

#### 3. Promote to Production  
```bash
# Use automated promotion script
npm run promote:production
```
**What happens**:
- Script merges `staging` → `main`
- Pushes to `main` branch  
- ✅ GitHub Actions automatically deploys to production environment

### Manual Workflow Execution

You can also trigger the workflow manually:

1. Go to your GitHub repository
2. Click "Actions" tab
3. Select "Deploy to Netlify" workflow
4. Click "Run workflow"
5. Choose environment: `development`, `staging`, or `production`
6. Click "Run workflow"

### Pipeline Commands Summary

```bash
# Complete automated pipeline
npm run promote:staging     # dev → staging (auto-deploys)
npm run promote:production  # staging → main (auto-deploys)

# Or run full pipeline at once
npm run pipeline:full       # dev → staging → main (auto-deploys each)

# Direct promotion (skips staging)
npm run promote:direct      # dev → main (auto-deploys)
```

### GitHub Actions Configuration

The workflow includes:

```yaml
name: Deploy to Netlify

on:
  push:
    branches: [ development, staging, main ]
  pull_request:
    branches: [ main, staging ]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'development'
        type: choice
        options:
          - development
          - staging
          - production

### Required GitHub Secrets

For the automated workflow to work, configure these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

- `NETLIFY_AUTH_TOKEN_DEV` - Netlify auth token for development site
- `NETLIFY_SITE_ID_DEV` - Development site ID  
- `NETLIFY_AUTH_TOKEN_STAGING` - Netlify auth token for staging site
- `NETLIFY_SITE_ID_STAGING` - Staging site ID
- `NETLIFY_AUTH_TOKEN_PROD` - Netlify auth token for production site  
- `NETLIFY_SITE_ID_PROD` - Production site ID

**To get Netlify tokens:**
1. Go to Netlify → User Settings → Personal Access Tokens
2. Generate new access token
3. Copy token to GitHub Secrets

**To get Site IDs:**
1. Go to Netlify → Site Settings → General → Site Information  
2. Copy "Site ID"
3. Add to GitHub Secrets

## Environment-Specific Features

### Development
- Debug logging enabled
- Hot reload for faster development
- Non-minified code for easier debugging

### Staging  
- Production-like environment
- Full feature testing
- Performance monitoring

### Production
- Optimized builds
- CDN distribution
- Error tracking and monitoring

## Monitoring & Rollback

### Health Checks

Each environment includes health check endpoints:
- `https://[env-url]/health` - Application health
- `https://[env-url]/.netlify/functions/ai-query` - Function health

### Rollback Strategy

```bash
# Quick rollback to previous deployment
netlify rollback

# Rollback to specific deployment
netlify rollback --site-id [site-id] --deploy-id [deploy-id]
```

## Troubleshooting

### Common Issues

1. **Build failures**: Check build logs in Netlify dashboard
2. **Function errors**: Verify serverless function configuration
3. **Environment variables**: Ensure all required vars are set
4. **Branch conflicts**: Resolve merge conflicts before deployment

### Debug Commands

```bash
# Test build locally
npm run build

# Test functions locally
netlify dev

# Check deployment status
netlify status

# View deployment logs
netlify logs
```

## Security Considerations

1. **API Keys**: Never commit API keys to repository
2. **Environment Variables**: Use Netlify environment variables
3. **Access Control**: Configure appropriate branch protection rules
4. **HTTPS**: All environments use HTTPS by default

## Performance Optimization

### Build Optimization

- TypeScript compilation
- Vite bundling and tree-shaking
- Asset compression
- CDN distribution

### Function Optimization

- CommonJS to ES modules conversion
- Cold start optimization
- Memory and timeout configuration

---

For questions or issues, refer to the [Netlify Documentation](https://docs.netlify.com/) or create an issue in the repository.
