# 🚀 Multi-Environment Deployment Setup

Your Splashworks Pool Service BI Visualizer now supports three-environment deployment to Netlify!

## 🌍 Environment Overview

| Environment | Branch | Purpose | Command |
|-------------|--------|---------|---------|
| **Development** | `development` | Feature development & testing | `npm run deploy:development` |
| **Staging** | `staging` | User acceptance testing | `npm run deploy:staging` |
| **Production** | `main` | Live production site | `npm run deploy:production` |

## 🚀 Quick Start

### 1. Set Up Netlify Sites
```bash
# Run the automated setup script
npm run setup:environments
```

### 2. Deploy to Environments
```bash
# Deploy current branch to development
npm run deploy:development

# Promote development to staging
npm run promote:staging

# Deploy staging to production  
npm run deploy:production
```

## 🔧 Configuration Files Added

- `netlify.toml` - Updated with environment-specific contexts
- `src/config/environment.ts` - Environment configuration management
- `scripts/setup-environments.sh` - Automated Netlify site creation
- `.github/workflows/deploy.yml` - Automated CI/CD pipeline
- `docs/deployment-guide.md` - Comprehensive deployment guide

## 📋 Next Steps

1. **Configure Netlify Sites**:
   - Run `npm run setup:environments`
   - Link each site to your GitHub repository
   - Set environment variables (API keys, etc.)

2. **Set Up GitHub Secrets** (for automated deployments):
   - `NETLIFY_AUTH_TOKEN_DEV`
   - `NETLIFY_AUTH_TOKEN_STAGING` 
   - `NETLIFY_AUTH_TOKEN_PROD`
   - `NETLIFY_SITE_ID_DEV`
   - `NETLIFY_SITE_ID_STAGING`
   - `NETLIFY_SITE_ID_PROD`

3. **Test Deployments**:
   - Make a change on `development` branch
   - Deploy with `npm run deploy:development`
   - Promote through environments as needed

## 📖 Documentation

For detailed instructions, see:
- [Deployment Guide](./docs/deployment-guide.md)
- [Environment Configuration](./src/config/environment.ts)

## 🎯 Key Features

- ✅ Branch-based deployments
- ✅ Environment-specific configuration
- ✅ Automated CI/CD with GitHub Actions
- ✅ Easy promotion workflow
- ✅ Development, staging, and production environments
- ✅ Environment variables and secrets management

---

Happy deploying! 🏊‍♂️