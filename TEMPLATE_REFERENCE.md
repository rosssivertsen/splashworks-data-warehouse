# Template Reference

## 🎯 Quick Access

The enterprise templates have been moved to a centralized location for better organization and reusability:

**Template Location**: `/Users/rosssivertsen/dev/enterprise-templates/`

## 🚀 Quick Commands

### **Create New Project:**
```bash
# Copy complete template
cp -r /Users/rosssivertsen/dev/enterprise-templates/project-starter/* my-new-project/
cd my-new-project/
./scripts/configure-project.sh
npm run dev
```

### **Add to Existing Project:**
```bash
# Copy automation scripts
cp /Users/rosssivertsen/dev/enterprise-templates/automation/*.sh scripts/
chmod +x scripts/*.sh

# Copy GitHub Actions workflow
mkdir -p .github/workflows
cp /Users/rosssivertsen/dev/enterprise-templates/change-control/pipeline-template.yml .github/workflows/ci-cd.yml
```

### **Copy Documentation:**
```bash
# Copy documentation templates
cp /Users/rosssivertsen/dev/enterprise-templates/documentation/*.md docs/
```

## 📁 Template Structure

```
/Users/rosssivertsen/dev/enterprise-templates/
├── project-starter/           # Complete project template
├── change-control/            # Change control templates
├── automation/               # Automation script templates
├── documentation/            # Documentation templates
└── README.md                 # Complete documentation
```

## 📚 Documentation

- **Complete Guide**: `/Users/rosssivertsen/dev/enterprise-templates/README.md`
- **Usage Examples**: See individual template README files
- **Automation Scripts**: See `/Users/rosssivertsen/dev/enterprise-templates/automation/`

## 🎯 Benefits

- **Centralized**: All templates in one location
- **Reusable**: Use across multiple projects
- **Maintainable**: Update templates once, use everywhere
- **Organized**: Clear structure and documentation
