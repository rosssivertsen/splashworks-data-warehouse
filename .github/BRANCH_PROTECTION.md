# Branch Protection and Repository Rules

## 🛡️ Protected Branches Configuration

### Main Branch Protection

#### Settings for `main` branch:
- ✅ **Require pull request reviews before merging**
  - Required number of reviewers: 2
  - Dismiss stale reviews when new commits are pushed
  - Require review from code owners
  - Require approval of the most recent reviewable push

- ✅ **Require status checks to pass before merging**
  - Require branches to be up to date before merging
  - Required status checks:
    - `code-quality` (ESLint, TypeScript compilation)
    - `testing` (Unit tests, coverage requirements)
    - `security-scan` (npm audit, vulnerability checks)
    - `build-test` (Production build verification)

- ✅ **Require conversation resolution before merging**
  - All conversations must be resolved

- ✅ **Restrict pushes that create files larger than 100MB**
  - Prevent accidental database uploads

- ✅ **Require signed commits**
  - All commits must be GPG signed

- ✅ **Include administrators**
  - Rules apply to repository administrators

#### Branch Protection Rules:
```json
{
  "protection": {
    "required_status_checks": {
      "strict": true,
      "contexts": [
        "code-quality",
        "testing", 
        "security-scan",
        "build-test"
      ]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "required_approving_review_count": 2,
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": true,
      "require_last_push_approval": true
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }
}
```

### Staging Branch Protection

#### Settings for `staging` branch:
- ✅ **Require pull request reviews before merging**
  - Required number of reviewers: 1
  - Require review from code owners

- ✅ **Require status checks to pass before merging**
  - Required status checks:
    - `code-quality`
    - `testing`
    - `build-test`

- ✅ **Require conversation resolution before merging**

### Development Branch Protection

#### Settings for `development` branch:
- ✅ **Require pull request reviews before merging**
  - Required number of reviewers: 1

- ✅ **Require status checks to pass before merging**
  - Required status checks:
    - `code-quality`
    - `testing`

## 👥 Code Owners Configuration

Create `.github/CODEOWNERS` file:

```
# Global ownership - all files
* @pool-service-team/core-maintainers

# Critical system files
package.json @pool-service-team/lead-developers
package-lock.json @pool-service-team/lead-developers
tsconfig.json @pool-service-team/lead-developers
vite.config.js @pool-service-team/lead-developers

# Database and AI logic
src/hooks/useDatabase.js @pool-service-team/database-experts
src/hooks/useChartData.js @pool-service-team/analytics-team
src/components/AI* @pool-service-team/ai-specialists

# Pool service business logic
src/utils/ @pool-service-team/business-analysts @pool-service-team/pool-experts
src/components/PoolService* @pool-service-team/business-analysts

# Security and configuration
.github/ @pool-service-team/security-team @pool-service-team/devops
src/styles/themeUtils.js @pool-service-team/design-team

# Documentation
*.md @pool-service-team/documentation-team
docs/ @pool-service-team/documentation-team
```

## 🔐 Repository Security Settings

### Security Features to Enable:

#### Dependency Security
- ✅ **Dependabot alerts**: Automatic security vulnerability alerts
- ✅ **Dependabot security updates**: Automatic security fixes
- ✅ **Dependency graph**: Track project dependencies
- ✅ **Vulnerable dependency notifications**: Email notifications

#### Code Scanning
- ✅ **CodeQL analysis**: Automated code scanning for vulnerabilities
- ✅ **Secret scanning**: Detect accidentally committed secrets
- ✅ **Security advisories**: Private vulnerability reporting

#### Access Control
- ✅ **Require two-factor authentication**: For all organization members
- ✅ **SSO enforcement**: Single sign-on required
- ✅ **IP allow list**: Restrict access to approved IP addresses (optional)

## 📊 Repository Insights Configuration

### Required Webhooks:
1. **CI/CD Integration**: GitHub Actions workflow triggers
2. **Security Monitoring**: Vulnerability alert notifications  
3. **Quality Metrics**: Code coverage and quality tracking
4. **Deployment Status**: Production deployment notifications

### Branch Policies Summary:

| Branch | Reviews Required | Status Checks | Auto-Delete | Force Push | Admin Bypass |
|--------|------------------|---------------|-------------|------------|-------------|
| `main` | 2 reviewers | 4 required | ❌ | ❌ | ❌ |
| `staging` | 1 reviewer | 3 required | ❌ | ❌ | ✅ |
| `development` | 1 reviewer | 2 required | ❌ | ✅ | ✅ |
| `feature/*` | None | None | ✅ | ✅ | ✅ |

### Deployment Environments:

#### Production Environment
- **Protection rules**: Required reviewers and wait timer
- **Deployment branches**: `main` branch only  
- **Secrets**: Production API keys and credentials
- **URL**: `https://poolservice-bi.example.com`

#### Staging Environment  
- **Protection rules**: Required reviewers
- **Deployment branches**: `staging` and `main` branches
- **Secrets**: Staging API keys and test credentials
- **URL**: `https://staging-poolservice-bi.example.com`

#### Development Environment
- **Protection rules**: None
- **Deployment branches**: Any branch
- **Secrets**: Development API keys
- **URL**: `https://dev-poolservice-bi.example.com`

## 🚨 Emergency Procedures

### Hotfix Process for Critical Issues:

1. **Create hotfix branch from main**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/POOL-CRITICAL-issue-description
   ```

2. **Bypass protection (admin only)**:
   - Temporarily disable branch protection
   - Implement minimal fix with detailed commit message
   - Create emergency PR with all stakeholders as reviewers

3. **Emergency deployment**:
   - Fast-track review process (<2 hours)
   - Deploy to staging for verification
   - Deploy to production with monitoring

4. **Post-incident actions**:
   - Re-enable branch protection
   - Merge hotfix to development and staging
   - Conduct post-mortem analysis
   - Update prevention measures

### Rollback Procedures:

#### Application Rollback:
```bash
# Revert to previous production tag
git checkout main
git reset --hard v1.2.3  # Previous stable version
git push --force-with-lease origin main
```

#### Database Rollback:
- Restore from automated backup
- Apply reverse migration scripts
- Verify data integrity
- Notify affected users

This branch protection setup ensures the Pool Service BI Dashboard maintains high code quality while allowing for efficient development and emergency response procedures.