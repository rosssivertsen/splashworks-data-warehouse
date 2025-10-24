name: Pull Request Template - Pool Service BI Dashboard

description: Template for all pull requests in the Pool Service BI Dashboard project

title: "[POOL-XXX]: Brief description of changes"

body:
  - type: markdown
    attributes:
      value: |
        ## 🎯 Change Summary
        
        **Related Issue:** POOL-XXX
        
        **Change Type:** 
        - [ ] 🚀 New Feature
        - [ ] 🐛 Bug Fix  
        - [ ] 📈 Enhancement
        - [ ] 🔧 Maintenance
        - [ ] 📚 Documentation
        - [ ] 🗄️ Database Changes
        
        **Brief Description:**
        [Provide a clear, concise description of what this PR accomplishes]

  - type: textarea
    id: business-context
    attributes:
      label: 📊 Business Context
      description: Explain the business value and pool service industry context
      placeholder: |
        - Why is this change needed for pool service companies?
        - What business problem does it solve?
        - How does it improve the pool service workflow?
    validations:
      required: true

  - type: textarea
    id: technical-changes
    attributes:
      label: 🔧 Technical Changes
      description: Detail the technical implementation
      placeholder: |
        - What components/files were modified?
        - Any new dependencies or libraries added?
        - Database schema changes?
        - API changes?
    validations:
      required: true

  - type: checkboxes
    id: testing-completed
    attributes:
      label: ✅ Testing Completed
      description: Confirm all required testing has been completed
      options:
        - label: Unit tests written and passing
          required: true
        - label: Integration tests updated (if applicable)
          required: false
        - label: Manual testing performed on development environment
          required: true
        - label: Tested with pool service sample data
          required: true
        - label: UI tested on desktop and mobile devices
          required: false
        - label: Performance impact assessed
          required: false

  - type: checkboxes
    id: code-quality
    attributes:
      label: 📋 Code Quality Checklist
      description: Ensure code meets quality standards
      options:
        - label: ESLint checks pass with no warnings
          required: true
        - label: TypeScript compilation successful with no errors
          required: true
        - label: Code follows pool service business logic patterns
          required: true
        - label: Error handling implemented appropriately
          required: true
        - label: Pool service theme consistency maintained
          required: true
        - label: Security considerations addressed
          required: false

  - type: textarea
    id: database-changes
    attributes:
      label: 🗄️ Database Impact
      description: Document any database-related changes
      placeholder: |
        - Schema modifications?
        - New queries or optimizations?
        - Impact on existing pool service data?
        - Migration requirements?
    validations:
      required: false

  - type: textarea
    id: deployment-notes
    attributes:
      label: 🚀 Deployment Notes
      description: Special deployment considerations
      placeholder: |
        - Any special deployment steps required?
        - Environment variables or configuration changes?
        - Dependencies that need to be installed?
        - Rollback procedures if needed?
    validations:
      required: false

  - type: checkboxes
    id: documentation-updated
    attributes:
      label: 📚 Documentation
      description: Confirm documentation has been updated
      options:
        - label: README updated (if user-facing changes)
          required: false
        - label: API documentation updated (if applicable)
          required: false
        - label: Code comments added for complex business logic
          required: false
        - label: User guide updated (if UI changes)
          required: false

  - type: textarea
    id: screenshots
    attributes:
      label: 📸 Screenshots/Videos
      description: Include screenshots or videos demonstrating the changes
      placeholder: |
        Upload screenshots or screen recordings showing:
        - Before/after comparison
        - New features in action
        - Mobile responsiveness
        - Pool service workflow improvements
    validations:
      required: false

  - type: textarea
    id: additional-context
    attributes:
      label: 📋 Additional Context
      description: Any additional information that would help reviewers
      placeholder: |
        - Breaking changes?
        - Known limitations?
        - Future considerations?
        - Related PRs or issues?
    validations:
      required: false

  - type: markdown
    attributes:
      value: |
        ## 👥 Reviewer Guidelines
        
        **For Reviewers:** Please verify:
        1. 🎯 **Business Logic**: Changes align with pool service industry needs
        2. 🔧 **Code Quality**: Follows TypeScript and React best practices  
        3. 🎨 **Theme Consistency**: Maintains pool service branding
        4. 📊 **Data Handling**: Proper handling of pool service databases
        5. 🔒 **Security**: No sensitive data exposure or vulnerabilities
        6. 📱 **Responsiveness**: Works well on all device sizes
        7. 🧪 **Testing**: Adequate test coverage for changes
        
        **Approval Criteria:**
        - At least one approved review required
        - All checks must pass
        - Testing checklist completed
        - Documentation updated if needed