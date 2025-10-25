#!/bin/bash

# Pool Service BI Dashboard - Quick Deployment Script
# One-command deployment for solo developer workflow

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🏊‍♂️ Pool Service BI Dashboard - Quick Deploy${NC}"
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}Current branch: $CURRENT_BRANCH${NC}"

# Quick quality check
echo -e "${BLUE}🔍 Running quick quality check...${NC}"
npm run build
npm run lint
echo -e "${GREEN}✅ Quality check passed${NC}"

# Commit any changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}📝 Uncommitted changes detected${NC}"
    git add .
    git commit -m "Quick deploy: $(date)"
    echo -e "${GREEN}✅ Changes committed${NC}"
fi

# Push to current branch
echo -e "${BLUE}📤 Pushing to remote...${NC}"
git push origin $CURRENT_BRANCH
echo -e "${GREEN}✅ Pushed to remote${NC}"

# If on development, promote to staging
if [ "$CURRENT_BRANCH" = "development" ]; then
    echo -e "${BLUE}🚀 Promoting to staging...${NC}"
    ./scripts/promote.sh development staging
    echo -e "${GREEN}✅ Promoted to staging${NC}"
fi

# If on staging, promote to main
if [ "$CURRENT_BRANCH" = "staging" ]; then
    echo -e "${BLUE}🚀 Promoting to production...${NC}"
    ./scripts/promote.sh staging main
    echo -e "${GREEN}✅ Promoted to production${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Quick deployment completed!${NC}"
echo -e "${BLUE}📊 Check your application at the appropriate environment${NC}"
