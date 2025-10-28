# Contributing to Splashworks Pool Service BI Visualizer

## 🎯 Overview

Thank you for contributing to the Pool Service BI Dashboard! This document provides guidelines for contributing to the project while maintaining code quality and consistency.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm 9+
- Git
- VS Code (recommended)

### Development Setup
```bash
# 1. Clone the repository
git clone <repository-url>
cd Skimmer-AI-Query-Visualization

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open http://localhost:5173
```

## 🌿 Branching Strategy

### Branch Types
- `main` - Production ready code
- `staging` - Pre-production testing
- `development` - Integration branch
- `feature/POOL-XXX-description` - New features
- `bugfix/POOL-XXX-description` - Bug fixes
- `hotfix/POOL-XXX-description` - Critical production fixes

### Creating Feature Branches
```bash
# Always start from development branch
git checkout development
git pull origin development
git checkout -b feature/POOL-123-customer-analytics
```

## 📝 Coding Standards

### TypeScript Guidelines
- Use strict TypeScript configuration
- Define proper interfaces for all data structures
- Use meaningful type names that reflect pool service domain
- Avoid `any` type - use proper typing

```typescript
// ✅ Good - Pool service specific types
interface CustomerRetentionData {
  customerId: string;
  serviceStartDate: Date;
  lastServiceDate: Date;
  retentionScore: number;
}

// ❌ Bad - Generic or untyped
const data: any = {};
```

### React Component Guidelines
- Use functional components with hooks
- Follow pool service naming conventions
- Implement proper error boundaries
- Use consistent prop patterns

```tsx
// ✅ Good - Pool service component
interface PoolServiceDashboardProps {
  customerId: string;
  onRetentionCalculate: (data: CustomerRetentionData) => void;
}

const PoolServiceDashboard: React.FC<PoolServiceDashboardProps> = ({
  customerId,
  onRetentionCalculate
}) => {
  // Component implementation
};
```

### Styling Guidelines
- Use Tailwind CSS classes
- Follow pool service theme colors
- Maintain responsive design
- Use consistent spacing patterns

```tsx
// ✅ Good - Pool service styling
<div className="bg-pool-blue-50 border border-pool-blue-200 rounded-lg p-6">
  <h2 className="text-xl font-semibold text-pool-blue-900 mb-4">
    Customer Analytics
  </h2>
</div>
```

## 🧪 Testing Requirements

### Unit Tests
- Write tests for all business logic
- Test pool service calculations thoroughly
- Mock external dependencies
- Achieve >80% code coverage

```typescript
// Example unit test
describe('CustomerRetentionCalculator', () => {
  it('should calculate retention score correctly', () => {
    const calculator = new CustomerRetentionCalculator();
    const result = calculator.calculate({
      serviceStartDate: new Date('2024-01-01'),
      lastServiceDate: new Date('2024-10-01'),
      serviceFrequency: 'weekly'
    });
    
    expect(result.retentionScore).toBeGreaterThan(0.8);
  });
});
```

### Integration Tests
- Test database operations with sample data
- Verify API integrations
- Test user workflows end-to-end

## 📊 Database Guidelines

### SQLite Best Practices
- Use parameterized queries to prevent SQL injection
- Optimize queries for large pool service datasets
- Create appropriate indexes for performance
- Handle database connection failures gracefully

```typescript
// ✅ Good - Safe database query
const getCustomerRetention = async (db: Database, timeframe: string) => {
  const query = `
    SELECT customer_id, 
           COUNT(service_visits) as visit_count,
           AVG(service_satisfaction) as avg_satisfaction
    FROM service_records 
    WHERE service_date >= date('now', ?)
    GROUP BY customer_id
  `;
  
  return db.exec(query, [`-${timeframe} months`]);
};
```

## 🎨 UI/UX Guidelines

### Pool Service Design Principles
- Prioritize data clarity and actionability
- Use pool service industry terminology
- Design for pool service technician workflows
- Maintain professional pool service branding

### Responsive Design
- Test on mobile devices (technicians in field)
- Ensure touch-friendly interfaces
- Optimize for tablet use in service vehicles
- Consider offline functionality needs

## 🔒 Security Guidelines

### Data Protection
- Never log sensitive customer data
- Implement proper input validation
- Sanitize user inputs for SQL queries
- Use secure API key management

### Pool Service Data Privacy
- Follow pool service industry privacy standards
- Implement data retention policies
- Ensure customer data encryption
- Audit data access patterns

## 📋 Pull Request Process

### Before Creating a PR
1. **Test Locally**
   ```bash
   npm test
   npm run build
   npm run lint
   ```

2. **Update Documentation**
   - Update README if needed
   - Add code comments for complex logic
   - Update API documentation

3. **Commit Message Format**
   ```
   POOL-123: Add customer retention analytics dashboard
   
   - Implement retention calculation algorithm
   - Add interactive charts for retention trends
   - Include export functionality for reports
   - Update pool service theme styling
   ```

### PR Checklist
- [ ] Branch created from `development`
- [ ] All tests passing
- [ ] ESLint and TypeScript checks clean
- [ ] Pool service theme consistency maintained
- [ ] Documentation updated
- [ ] Screenshots included for UI changes
- [ ] Database changes documented
- [ ] Performance impact assessed

### Review Process
1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Code Review**: At least one team member review required
3. **Business Logic Review**: Pool service domain expert approval
4. **Security Review**: For data handling or API changes
5. **Merge**: After all approvals and checks pass

## 🐛 Bug Reporting

### Bug Report Template
```markdown
**Bug Description**: Brief description of the issue

**Pool Service Context**: Which pool service workflow is affected?

**Steps to Reproduce**:
1. Step one
2. Step two
3. Step three

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happened

**Environment**:
- Browser/Device:
- Database Size:
- User Role:

**Screenshots**: If applicable
```

## 🎯 Feature Requests

### Feature Request Template
```markdown
**Feature Title**: Brief title for the feature

**Pool Service Business Need**: Why is this needed for pool service companies?

**User Story**: As a [role], I want [goal] so that [benefit]

**Acceptance Criteria**:
- [ ] Criteria one
- [ ] Criteria two
- [ ] Criteria three

**Technical Considerations**:
- Database changes needed?
- API integrations required?
- Performance implications?
```

## 📞 Getting Help

### Resources
- **Documentation**: Check `/docs` folder
- **API Reference**: See inline code documentation
- **Pool Service Domain**: Consult with business stakeholders
- **Technical Issues**: Create GitHub issue with detailed description

### Communication
- Use GitHub Issues for bugs and feature requests
- Tag appropriate team members for reviews
- Include pool service context in all discussions
- Be specific about database and performance requirements

## 🏆 Recognition

Contributors who help improve the Pool Service BI Dashboard will be:
- Listed in project contributors
- Recognized in release notes
- Invited to provide input on future features
- Acknowledged for pool service industry insights

Thank you for helping make pool service management more efficient and data-driven!