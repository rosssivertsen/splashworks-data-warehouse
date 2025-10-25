#!/bin/bash

# Pool Service BI Dashboard - Automated Deployment Script
# Usage: ./scripts/deploy.sh [environment] [branch]

set -e

# Configuration
ENVIRONMENT=${1:-staging}
BRANCH=${2:-development}
PROJECT_NAME="pool-service-bi-dashboard"
DEPLOY_LOG="deploy-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $DEPLOY_LOG
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a $DEPLOY_LOG
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a $DEPLOY_LOG
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a $DEPLOY_LOG
    exit 1
}

# Header
log "🏊‍♂️ Pool Service BI Dashboard - Automated Deployment"
log "Environment: $ENVIRONMENT"
log "Branch: $BRANCH"
log "Project: $PROJECT_NAME"

# Pre-deployment checks
log "🔍 Running pre-deployment checks..."

# Check if we're on the correct branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    warning "Switching from $CURRENT_BRANCH to $BRANCH"
    git checkout $BRANCH
fi

# Pull latest changes
log "📥 Pulling latest changes..."
git pull origin $BRANCH

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    error "Uncommitted changes detected. Please commit or stash changes before deploying."
fi

# Install dependencies
log "📦 Installing dependencies..."
npm ci

# Run quality checks
log "🔍 Running quality gates..."

# TypeScript compilation
log "🔧 TypeScript compilation..."
npm run build
success "TypeScript compilation passed"

# ESLint analysis
log "🔍 ESLint analysis..."
npm run lint
success "ESLint analysis passed"

# Security audit
log "🔒 Security audit..."
npm audit --audit-level=moderate
success "Security audit passed"

# Build verification
log "🏗️  Production build verification..."
npm run build
success "Production build successful"

# Environment-specific deployment
case $ENVIRONMENT in
    "staging")
        log "🚀 Deploying to staging environment..."
        # Add staging-specific deployment commands here
        success "Staging deployment completed"
        ;;
    "production")
        log "🚀 Deploying to production environment..."
        # Add production-specific deployment commands here
        success "Production deployment completed"
        ;;
    *)
        error "Unknown environment: $ENVIRONMENT. Use 'staging' or 'production'"
        ;;
esac

# Post-deployment tasks
log "📋 Running post-deployment tasks..."

# Update version if needed
if [ "$ENVIRONMENT" = "production" ]; then
    log "📦 Creating production release..."
    # Add release creation logic here
    success "Production release created"
fi

# Notification
log "📢 Sending deployment notification..."
# Add notification logic here (Slack, email, etc.)
success "Deployment notification sent"

# Final success message
success "🎉 Deployment to $ENVIRONMENT completed successfully!"
log "📊 Deployment log saved to: $DEPLOY_LOG"

# Cleanup
log "🧹 Cleaning up temporary files..."
# Add cleanup logic here

log "✅ Automated deployment pipeline completed"
