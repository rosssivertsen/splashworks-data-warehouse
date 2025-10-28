# Change Control Process - Pool Service BI Dashboard

## 🔄 Branching Strategy

### Branch Structure
```
main (production)
├── staging (pre-production testing)
├── development (integration & testing)
└── feature/* (feature development)
```

### Branch Purposes

#### `main` - Production Branch
- **Purpose**: Production-ready code only
- **Protection**: Protected branch, requires PR approval
- **Deployment**: Auto-deployed to production environment
- **Access**: Read-only except via approved PRs

#### `staging` - Pre-Production Branch  
- **Purpose**: User Acceptance Testing (UAT) and final QA
- **Testing**: Full integration testing, performance testing
- **Deployment**: Staging environment deployment
- **Merge Source**: Development branch only

#### `development` - Integration Branch
- **Purpose**: Integration of completed features
- **Testing**: Automated tests, basic functionality verification
- **Deployment**: Development environment
- **Merge Source**: Feature branches only

#### `feature/*` - Feature Development Branches
- **Purpose**: Individual feature/bug fix development
- **Naming**: `feature/POOL-123-customer-analytics` or `bugfix/POOL-456-chart-rendering`
- **Lifecycle**: Created from development, merged back to development
- **Testing**: Unit tests, local development testing

## 📋 Change Control Workflow

### 1. Feature Development Process

#### Starting New Work:
```bash
# 1. Create feature branch from development
git checkout development
git pull origin development
git checkout -b feature/POOL-123-customer-retention-analytics

# 2. Develop feature with regular commits
git add .
git commit -m "POOL-123: Add customer retention calculation logic"

# 3. Push feature branch
git push origin feature/POOL-123-customer-retention-analytics
```

#### Code Review & Integration:
```bash
# 4. Create Pull Request: feature/POOL-123 → development
# 5. Code review and approval required
# 6. Merge to development after approval
# 7. Delete feature branch after merge
```

### 2. Release Process

#### Staging Deployment:
```bash
# 1. Merge development to staging (via PR)
git checkout staging
git pull origin staging
# Create PR: development → staging

# 2. Deploy to staging environment
# 3. Perform UAT and integration testing
# 4. Performance and security testing
```

#### Production Release:
```bash
# 1. After staging approval, merge to main (via PR)
# Create PR: staging → main

# 2. Tag release
git checkout main
git pull origin main
git tag -a v1.0.1 -m "Release v1.0.1: Customer Analytics Dashboard"
git push origin v1.0.1

# 3. Deploy to production
```

## 🛡️ Change Control Requirements

### All Changes Must Include:

#### 1. **Documentation**
- [ ] Feature specification or bug description
- [ ] Technical design document (for major features)
- [ ] User documentation updates
- [ ] API documentation changes (if applicable)

#### 2. **Testing Requirements**
- [ ] Unit tests for new functionality
- [ ] Integration tests for API changes
- [ ] Manual testing checklist completed
- [ ] Performance impact assessment

#### 3. **Code Quality**
- [ ] ESLint checks passing
- [ ] TypeScript compilation with no errors
- [ ] Code review by at least one team member
- [ ] Security review for data handling changes

#### 4. **Database Changes**
- [ ] Migration scripts (if applicable)
- [ ] Rollback procedures documented
- [ ] Data backup verification
- [ ] Performance impact on large datasets

## 🔍 Review Checklist

### Pull Request Requirements:

#### **Code Review Checklist:**
- [ ] Code follows pool service business logic
- [ ] TypeScript types are properly defined
- [ ] Error handling is implemented
- [ ] Performance considerations addressed
- [ ] Security implications reviewed
- [ ] Pool service theme consistency maintained

#### **Testing Checklist:**
- [ ] Unit tests cover new functionality
- [ ] Integration tests verify end-to-end workflows
- [ ] Database operations tested with sample data
- [ ] UI components tested in different screen sizes
- [ ] AI query generation tested with various inputs

#### **Documentation Checklist:**
- [ ] README updated if needed
- [ ] Code comments for complex business logic
- [ ] API changes documented
- [ ] User-facing changes documented

## 🚨 Emergency Hotfix Process

### Critical Production Issues:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/POOL-CRITICAL-database-connection

# 2. Implement minimal fix
git add .
git commit -m "HOTFIX: Fix database connection timeout"

# 3. Create emergency PR to main
# 4. Fast-track review and approval
# 5. Deploy immediately after merge

# 6. Merge hotfix back to development and staging
git checkout development
git merge hotfix/POOL-CRITICAL-database-connection
git checkout staging  
git merge hotfix/POOL-CRITICAL-database-connection
```

## 📊 Change Tracking

### Issue Tracking Format:
```
POOL-[NUMBER]: [TYPE] - [BRIEF DESCRIPTION]

Examples:
- POOL-001: FEATURE - Customer retention analytics dashboard
- POOL-002: BUGFIX - Chart rendering on mobile devices
- POOL-003: ENHANCEMENT - Improve query performance for large datasets
```

### Commit Message Format:
```
POOL-[NUMBER]: [ACTION] - [DESCRIPTION]

Examples:
- POOL-001: Add customer retention calculation logic
- POOL-002: Fix mobile chart responsive design
- POOL-003: Optimize SQL query performance with indexes
```

## 🔧 Automated Workflows

### Pre-commit Hooks:
- ESLint and TypeScript checks
- Unit test execution
- Code formatting verification

### CI/CD Pipeline:
- Automated testing on PR creation
- Build verification for all branches
- Automated deployment to appropriate environments
- **Note**: CI/CD workflows currently disabled - using manual deployment process

### Quality Gates:
- Development: All tests pass, ESLint clean
- Staging: Integration tests pass, performance benchmarks met  
- Production: Full test suite pass, security scan clean

## 🚀 Manual Deployment Process

### Overview
Due to GitHub Actions workflow issues, we use a manual deployment process with automated scripts for change promotion between environments.

### Branch Status & Deployment Flow
```
development (latest features) → staging (testing) → main (production)
```

### Phase 1: Development → Staging

#### Prerequisites:
- All development changes committed and pushed
- Local testing completed
- Feature/bug documentation updated

#### Manual Promotion Commands:
```bash
# Method 1: Using automated promotion script
npm run promote:staging

# Method 2: Using direct script
./scripts/promote.sh development staging

# Method 3: Manual git commands
git checkout staging
git pull origin staging
git merge development
git push origin staging
```

#### Validation Steps:
1. **Build Verification**: `npm run build` (must succeed)
2. **Local Testing**: `npm run preview` (smoke test)
3. **Deploy to Staging**: Deploy to staging environment for UAT
4. **Functional Testing**: Verify core features work correctly

### Phase 2: Staging Testing & Validation

#### Required Testing:
- **Database Upload Tests**: Verify SQLite file processing
- **AI Query Functionality**: Test OpenAI and Anthropic integrations
- **Dashboard Persistence**: Confirm localStorage and dashboard operations
- **Tab Navigation**: Validate all interface tabs function properly
- **Settings Management**: Test API key storage and validation
- **Semantic Layer**: Verify business logic and query enhancement

#### Testing Checklist:
```bash
# Build and test locally
npm run build
npm run preview

# Deploy to staging environment (if available)
netlify deploy --dir=dist --site=staging-site-id

# Run test suite
npm run test
npm run test:coverage
```

#### Sign-off Requirements:
- [ ] Technical validation complete
- [ ] Business functionality verified  
- [ ] Performance acceptable
- [ ] No critical bugs identified
- [ ] Documentation updated

### Phase 3: Staging → Production (Main)

#### Prerequisites:
- Staging environment fully tested
- All stakeholders approve deployment
- Rollback plan documented
- Production deployment window scheduled

#### Promotion Commands:
```bash
# Method 1: Using automated promotion script
npm run promote:production

# Method 2: Using direct script
./scripts/promote.sh staging main

# Method 3: Manual git commands
git checkout main
git pull origin main
git merge staging
git push origin main

# Optional: Tag release for tracking
git tag -a v1.2.0 -m "Release v1.2.0: Semantic layer and multi-provider AI"
git push origin --tags
```

#### Post-Deployment Verification:
1. **Production Health Check**: Verify application loads
2. **Core Functionality Test**: Quick smoke test of key features
3. **Performance Monitoring**: Check response times and resource usage
4. **User Notification**: Announce deployment if user-facing changes

### Emergency Deployment Process

#### For Critical hotfix:
```bash
# Skip staging for emergency fixes (use with caution)
npm run promote:direct
# OR
./scripts/promote.sh development main
```

#### Emergency Procedures:
1. **Immediate Impact Assessment**: Document the critical issue
2. **Hotfix Development**: Create minimal fix in development branch  
3. **Rapid Testing**: Essential functionality testing only
4. **Direct Deployment**: Bypass staging with proper authorization
5. **Post-Deployment**: Full regression testing in staging afterward

### Rollback Procedures

#### Git-Based Rollback:
```bash
# Rollback to previous commit
git checkout main
git reset --hard HEAD~1
git push origin main --force-with-lease

# Rollback to specific version
git checkout main
git reset --hard [commit-hash]
git push origin main --force-with-lease
```

#### Tag-Based Rollback:
```bash
# Rollback to tagged release
git checkout main
git reset --hard v1.1.0
git push origin main --force-with-lease
```

### Deployment Scripts Reference

#### Available NPM Commands:
```bash
# Branch promotion commands
npm run promote:staging        # development → staging  
npm run promote:production     # staging → main
npm run promote:direct         # development → main (emergency)

# Pipeline commands  
npm run pipeline:full          # development → staging → main
npm run deploy                 # Quick deployment script
npm run ship                   # Alias for deploy
```

#### Script Locations:
- **Promotion Script**: `./scripts/promote.sh`
- **Deployment Script**: `./scripts/deploy.sh`  
- **Quick Deploy**: `./scripts/quick-deploy.sh`

### Monitoring & Validation

#### Pre-Deployment Checks:
- [ ] Code compiles successfully (`npm run build`)
- [ ] Tests pass (`npm run test`)
- [ ] Linting clean (`npm run lint`)
- [ ] Dependencies up to date
- [ ] Environment variables configured

#### Post-Deployment Validation:
- [ ] Application accessible
- [ ] Database connection working
- [ ] AI services responding
- [ ] User authentication functional
- [ ] No console errors
- [ ] Performance within acceptable ranges

## 📋 Change Approval Matrix

| Change Type | Development | Staging | Production |
|-------------|------------|---------|------------|
| Bug Fix | Developer Review | QA Approval | Lead + Stakeholder |
| New Feature | Peer Review | QA + Business | Lead + Business + Security |
| Infrastructure | Lead Review | DevOps + QA | DevOps + Lead + Business |
| Security | Security Review | Security + QA | Security + Lead + Business |
| Database Schema | DBA Review | DBA + QA | DBA + Lead + Business |

## 🎯 Success Metrics

### Change Control KPIs:
- **Change Success Rate**: >95% of changes deployed without rollback
- **Mean Time to Recovery**: <30 minutes for critical issues
- **Code Review Time**: <24 hours for standard changes
- **Test Coverage**: >80% for all new code
- **Documentation Coverage**: 100% for user-facing changes

This change control process ensures the Pool Service BI Dashboard maintains high quality while allowing for rapid, controlled development and deployment.