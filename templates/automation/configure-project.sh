#!/bin/bash

# Project Configuration Script
# Run this script to configure a new project with the template

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Enterprise Project Configuration${NC}"
echo ""

# Get project information
read -p "Project Name: " PROJECT_NAME
read -p "Project Description: " PROJECT_DESCRIPTION
read -p "Author Name: " AUTHOR_NAME
read -p "GitHub Repository URL: " REPO_URL

# Update package.json
echo -e "${BLUE}📦 Updating package.json...${NC}"
sed -i.bak "s/your-project-name/$PROJECT_NAME/g" package.json
sed -i.bak "s/Your project description/$PROJECT_DESCRIPTION/g" package.json
sed -i.bak "s/Your Name/$AUTHOR_NAME/g" package.json
rm package.json.bak

# Update README.md
echo -e "${BLUE}📝 Updating README.md...${NC}"
sed -i.bak "s/your-project-name/$PROJECT_NAME/g" README.md
sed -i.bak "s/Your Name/$AUTHOR_NAME/g" README.md
rm README.md.bak

# Update GitHub Actions workflow
echo -e "${BLUE}🤖 Configuring GitHub Actions...${NC}"
if [ -f ".github/workflows/ci-cd.yml" ]; then
    echo "GitHub Actions workflow already configured"
else
    echo "Copying GitHub Actions template..."
    mkdir -p .github/workflows
    cp templates/change-control/pipeline-template.yml .github/workflows/ci-cd.yml
fi

# Initialize git repository if not already initialized
if [ ! -d ".git" ]; then
    echo -e "${BLUE}📁 Initializing git repository...${NC}"
    git init
    git remote add origin $REPO_URL
fi

# Create initial commit
echo -e "${BLUE}📝 Creating initial commit...${NC}"
git add .
git commit -m "🚀 Initial project setup with enterprise automation

- Automated CI/CD pipeline with GitHub Actions
- Change control system with branch protection
- Quality gates (TypeScript, ESLint, Security, Testing)
- Automated deployment scripts
- Comprehensive documentation templates

Project: $PROJECT_NAME
Description: $PROJECT_DESCRIPTION
Author: $AUTHOR_NAME"

# Create branches
echo -e "${BLUE}🌿 Creating branch structure...${NC}"
git checkout -b development
git checkout -b staging
git checkout -b main

# Set up branch protection (requires GitHub CLI)
if command -v gh &> /dev/null; then
    echo -e "${BLUE}🔒 Setting up branch protection...${NC}"
    echo "Note: You may need to configure branch protection rules manually in GitHub"
else
    echo -e "${YELLOW}⚠️  GitHub CLI not found. Please set up branch protection manually:${NC}"
    echo "  1. Go to GitHub repository settings"
    echo "  2. Navigate to Branches"
    echo "  3. Add protection rules for main, staging, and development branches"
fi

# Final instructions
echo ""
echo -e "${GREEN}✅ Project configuration completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Push to GitHub: git push -u origin main"
echo "2. Push all branches: git push origin development staging"
echo "3. Set up branch protection rules in GitHub"
echo "4. Configure deployment environments in GitHub Actions"
echo "5. Start development: npm run dev"
echo ""
echo -e "${BLUE}🚀 Quick commands:${NC}"
echo "- Start development: npm run dev"
echo "- Deploy changes: npm run deploy"
echo "- Full pipeline: npm run pipeline:full"
echo "- Direct deployment: npm run pipeline:direct"
echo ""
echo -e "${GREEN}🎉 Your enterprise project is ready!${NC}"
