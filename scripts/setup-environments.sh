#!/bin/bash

# Multi-Environment Netlify Setup Script
# This script configures three Netlify sites for development, staging, and production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

log "🏊‍♂️ Setting up Multi-Environment Netlify Deployment"

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    error "Netlify CLI is not installed. Run: npm install -g netlify-cli"
fi

# Check if user is logged in
if ! netlify status &> /dev/null; then
    warning "Not logged into Netlify. Please run: netlify login"
    exit 1
fi

# Site configuration
SITES=(
    "splashworks-bi-development:development"
    "splashworks-bi-staging:staging"  
    "splashworks-bi-production:main"
)

log "Creating Netlify sites..."

for site_config in "${SITES[@]}"; do
    IFS=':' read -r site_name branch <<< "$site_config"
    
    log "Creating site: $site_name (branch: $branch)"
    
    # Create site
    site_info=$(netlify sites:create --name "$site_name" --json 2>/dev/null || echo '{}')
    
    if echo "$site_info" | grep -q "site_id"; then
        site_id=$(echo "$site_info" | grep -o '"site_id":"[^"]*"' | cut -d'"' -f4)
        site_url=$(echo "$site_info" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
        success "Created $site_name: $site_url"
        
        # Link to repository (you'll need to do this manually via Netlify dashboard)
        log "  → Link this site to your GitHub repository in Netlify dashboard"
        log "  → Set production branch to: $branch"
        log "  → Site ID: $site_id"
    else
        warning "Site $site_name may already exist or creation failed"
    fi
    
    echo
done

log "🚀 Setup Summary:"
echo
echo "Next steps:"
echo "1. Go to Netlify Dashboard (https://app.netlify.com)"
echo "2. For each site, configure:"
echo "   - Connect to GitHub repository"
echo "   - Set build command: npm run build" 
echo "   - Set publish directory: dist"
echo "   - Set production branch as specified above"
echo "   - Add environment variables (API keys, etc.)"
echo
echo "3. Deploy using:"
echo "   npm run deploy:development"
echo "   npm run deploy:staging"
echo "   npm run deploy:production"

success "Multi-environment setup complete!"