# AI BI Visualization Tool - Figma Layout Specifications

## Overview

This document provides detailed specifications for creating a comprehensive Figma prototype of the AI BI Visualization Tool. The design should emphasize modern, professional aesthetics with excellent UX patterns for data visualization and AI interaction.

## Design System

### Enhanced Color Palette (Implementation Complete)

#### Primary Colors
```css
Primary-50: #EEF2FF
Primary-100: #E0E7FF
Primary-200: #C7D2FE
Primary-300: #A5B4FC
Primary-400: #818CF8
Primary-500: #6366F1 (Main Primary)
Primary-600: #4F46E5
Primary-700: #4338CA
Primary-800: #3730A3
Primary-900: #312E81
```

#### Secondary Colors
```css
Secondary-50: #F0F9FF
Secondary-100: #E0F2FE
Secondary-200: #BAE6FD
Secondary-300: #7DD3FC
Secondary-400: #38BDF8
Secondary-500: #0EA5E9 (Main Secondary)
Secondary-600: #0284C7
Secondary-700: #0369A1
Secondary-800: #075985
Secondary-900: #0C4A6E
```

#### Status Colors
```css
/* Success */
Success-50: #ECFDF5
Success-100: #D1FAE5
Success-500: #10B981 (Main Success)
Success-600: #059669
Success-700: #047857

/* Warning */
Warning-50: #FFFBEB
Warning-100: #FEF3C7
Warning-500: #F59E0B (Main Warning)
Warning-600: #D97706
Warning-700: #B45309

/* Error */
Error-50: #FEF2F2
Error-100: #FEE2E2
Error-500: #EF4444 (Main Error)
Error-600: #DC2626
Error-700: #B91C1C

/* Info */
Info-50: #EFF6FF
Info-100: #DBEAFE
Info-500: #3B82F6 (Main Info)
Info-600: #2563EB
Info-700: #1D4ED8
```

#### Neutral Colors
```css
Neutral-0: #FFFFFF
Neutral-50: #F9FAFB
Neutral-100: #F3F4F6
Neutral-200: #E5E7EB
Neutral-300: #D1D5DB
Neutral-400: #9CA3AF
Neutral-500: #6B7280
Neutral-600: #4B5563
Neutral-700: #374151
Neutral-800: #1F2937
Neutral-900: #111827
Neutral-950: #030712
```

#### Background & Interactive Colors
```css
Background-main: #F8FAFC
Background-card: #FFFFFF
Background-overlay: rgba(17, 24, 39, 0.8)
Background-border: #E5E7EB
Background-hover: #F3F4F6
Background-active: #E5E7EB
```

### Typography
```css
/* Font Family */
Primary: Inter (or system-ui fallback)

/* Font Sizes */
Text-xs: 12px
Text-sm: 14px
Text-base: 16px
Text-lg: 18px
Text-xl: 20px
Text-2xl: 24px
Text-3xl: 30px
Text-4xl: 36px

/* Font Weights */
Font-normal: 400
Font-medium: 500
Font-semibold: 600
Font-bold: 700

/* Line Heights */
Leading-tight: 1.25
Leading-normal: 1.5
Leading-relaxed: 1.75
```

### Spacing System
```css
Space-1: 4px
Space-2: 8px
Space-3: 12px
Space-4: 16px
Space-5: 20px
Space-6: 24px
Space-8: 32px
Space-10: 40px
Space-12: 48px
Space-16: 64px
Space-20: 80px
```

### Border Radius
```css
Radius-sm: 4px
Radius-md: 8px
Radius-lg: 12px
Radius-xl: 16px
Radius-full: 9999px
```

### Shadows
```css
Shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
Shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
Shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
Shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
```

## Implementation Status (October 2025)

### Design System Implementation Complete ✅

#### Centralized Design Tokens
- **Location**: `src/styles/designSystem.js`
- **Coverage**: Complete color palette, typography, spacing, shadows, transitions
- **Component Styles**: Pre-built button, card, input, badge, and status variants
- **Utilities**: CSS-in-JS generators and theme management functions

#### Theme Utilities System
- **Location**: `src/styles/themeUtils.js`
- **Features**: Modular styling utilities, preset component styles, responsive helpers
- **Usage**: Consistent styling patterns across all components
- **Benefits**: Type-safe color access, maintainable design tokens

#### Tailwind Configuration Enhanced
- **Integration**: Complete design system colors added to `tailwind.config.js`
- **Custom Colors**: Primary, secondary, success, warning, error, info, neutral scales
- **Typography**: Inter and JetBrains Mono font families configured
- **Consistency**: Design tokens align with Tailwind classes

#### Component Updates Applied
- **InsightCard.jsx**: Complete design system integration ✅
- **InsightHeader.jsx**: Typography and button styling updated ✅
- **InsightEmptyState.jsx**: Consistent styling patterns applied ✅
- **DesignSystemShowcase.jsx**: Testing and validation component created ✅

#### Design Patterns Established
- **Button Variants**: Primary, secondary, outline, ghost styles
- **Card Types**: Default, elevated, interactive variants  
- **Status Indicators**: Success, warning, error, info components
- **Typography Hierarchy**: H1-H6, body, caption, label styles
- **Color Usage**: Semantic color mapping for consistent application

#### Quality Assurance
- **ESLint Compliance**: All components pass validation ✅
- **Functionality Preserved**: Zero breaking changes ✅ 
- **Performance**: Efficient CSS-in-JS utility functions ✅
- **Scalability**: Ready for remaining 12+ component updates ✅

## Screen Layout Specifications

### Desktop Layout (1920x1080)
```
┌─────────────────────────────────────────────────────────┐
│                    Header (80px)                      │
├─────────────────────────────────────────────────────────┤
│                Tab Navigation (64px)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                  Main Content Area                      │
│                  (min-height: 600px)                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│              Query Results (if applicable)              │
│                   (variable height)                    │
└─────────────────────────────────────────────────────────┘

Container: Max-width 1400px, centered
Side margins: 32px
Content padding: 24px
```

### Tablet Layout (1024x768)
```
┌─────────────────────────────────────────┐
│              Header (64px)               │
├─────────────────────────────────────────┤
│           Tab Navigation (56px)         │
├─────────────────────────────────────────┤
│                                         │
│          Main Content Area              │
│        (min-height: 500px)             │
│                                         │
├─────────────────────────────────────────┤
│        Query Results (if applicable)    │
└─────────────────────────────────────────┘

Container: Full width
Side margins: 16px
Content padding: 16px
```

### Mobile Layout (375x667)
```
┌─────────────────────┐
│    Header (56px)     │
├─────────────────────┤
│  Tab Navigation     │
│   (scrollable)      │
├─────────────────────┤
│                     │
│   Main Content      │
│   (scrollable)      │
│                     │
├─────────────────────┤
│  Query Results      │
│  (if applicable)    │
└─────────────────────┘

Container: Full width
Side margins: 12px
Content padding: 12px
```

## Component Specifications

### 1. Header Component
**Dimensions**: Height 80px (desktop), 64px (tablet), 56px (mobile)
**Elements**:
- Logo/Title (left)
- User area (right) - empty in current implementation
**Background**: White with subtle bottom border
**Typography**: Text-2xl, Font-bold, Gray-900

### 2. Tab Navigation
**Dimensions**: Height 64px (desktop), 56px (tablet/mobile)
**Elements**:
- Tab buttons (horizontal scroll on mobile)
- Active state: Blue border bottom, Blue text
- Inactive state: Gray text, hover Gray-700
- Disabled state: Gray-400 text, cursor not-allowed
**Icon**: 16x16px, left of text
**Padding**: 16px horizontal, 12px vertical

### 3. Database Upload Area
**Dimensions**: Minimum height 400px
**Drop Zone**:
- Border: 2px dashed Gray-300
- Border-hover: 2px dashed Blue-400
- Background: Gray-50 (hover: Blue-50)
- Border Radius: 12px
- Padding: 32px
**Content**:
- Upload Icon: 48x48px, Gray-400
- Title: Text-xl, Font-semibold, Gray-900
- Description: Text-base, Gray-600
- Browse Button: Blue-500 background, White text, 8px radius

### 4. AI Chat Interface
**Chat Messages**:
- User Message: Blue-500 background, White text, 8px radius
- AI Message: White background, Gray-800 text, border
- Error Message: Red-100 background, Red-800 text
- Timestamp: Text-xs, Gray-500
**Avatar**: 32x32px, circle, Blue/Purple/Red background
**Input Area**:
- Textarea: 4px radius, Gray-300 border, focus Blue-500 ring
- Send Button: Blue-500 background, White text
- Height: Auto, max 120px

### 5. Query Results Table
**Table Header**:
- Background: Gray-50
- Text: Font-medium, Gray-700
- Padding: 12px 16px
- Border bottom: 1px Gray-200
**Table Rows**:
- Padding: 12px 16px
- Border bottom: 1px Gray-100
- Hover: Gray-50 background
**Cell Types**:
- NULL: Gray-400, italic
- Dates: Font-mono, Text-xs, Blue-600
- Regular: Gray-600

### 6. Chart Container
**Card**:
- Background: White
- Border: 1px Gray-200
- Border Radius: 12px
- Shadow: Shadow-sm, hover Shadow-md
- Padding: 16px
**Chart Area**: Height 256px, responsive
**Header**:
- Title: Font-semibold, Gray-900
- Icon: 16x16px, Gray-500
- Actions: 16x16px icons, Gray-500 hover Gray-700

### 7. Dashboard Grid
**Grid System**:
- 12-column grid (CSS Grid)
- Gap: 8px between items
- Responsive: 6 columns on tablet, 1 on mobile
**Chart Sizes**:
- Small: 3x3 grid cells
- Medium: 6x4 grid cells
- Large: 8x6 grid cells
- Full Width: 12x4 grid cells

## Interactive Elements

### Buttons
**Primary Button**:
- Background: Blue-500, hover Blue-600
- Text: White, Font-medium
- Padding: 12px 24px
- Border Radius: 8px
- Disabled: Gray-300 background

**Secondary Button**:
- Background: Gray-500, hover Gray-600
- Text: White, Font-medium
- Padding: 12px 24px
- Border Radius: 8px

**Ghost Button**:
- Background: Transparent
- Text: Gray-600, hover Gray-800
- Border: 1px Gray-300
- Padding: 8px 16px
- Border Radius: 6px

### Form Elements
**Input Fields**:
- Height: 40px
- Border: 1px Gray-300
- Border Radius: 6px
- Padding: 0 12px
- Focus: Blue-500 border, Blue-500 ring
- Font: Text-base

**Textareas**:
- Min-height: 80px
- Border: 1px Gray-300
- Border Radius: 6px
- Padding: 12px
- Focus: Blue-500 border, Blue-500 ring
- Resize: Vertical

**Select Dropdowns**:
- Height: 40px
- Border: 1px Gray-300
- Border Radius: 6px
- Padding: 0 12px
- Focus: Blue-500 border

### Loading States
**Spinner**:
- Size: 20x20px (button), 32x32px (page)
- Border: 2px solid, with transparent top
- Color: Blue-500 or Gray-600
- Animation: Rotate 360deg in 1s linear

**Skeleton Loading**:
- Background: Linear gradient Gray-200 to Gray-100
- Animation: Shimmer effect
- Border Radius: 4px

## Animation Specifications

### Page Transitions
- Duration: 0.3s
- Easing: Ease-out
- Type: Fade-in with slight upward movement

### Component Animations
- Hover: 0.2s ease-out
- Click/Tap: 0.1s ease-in with scale (0.98)
- Loading: 1s infinite linear rotation

### Micro-interactions
- Button hover: Scale 1.02
- Card hover: Shadow-md, scale 1.01
- Tab active: Slide down border (0.3s ease-out)

## Figma Layer Organization

```
📁 AI BI Visualization Tool
├── 📁 Design System
│   ├── 📁 Colors
│   ├── 📁 Typography
│   ├── 📁 Components
│   └── 📁 Effects
├── 📁 Screens
│   ├── 📄 Desktop - 1920x1080
│   ├── 📄 Tablet - 1024x768
│   └── 📄 Mobile - 375x667
├── 📁 Components
│   ├── 📄 Header
│   ├── 📄 Tab Navigation
│   ├── 📄 Database Upload
│   ├── 📄 Chat Interface
│   ├── 📄 Data Table
│   ├── 📄 Chart Container
│   ├── 📄 Dashboard Grid
│   └── 📄 Form Elements
└── 📁 Prototyping
    ├── 📄 User Flows
    ├── 📄 Interactions
    └── 📄 Animations
```

## Prototyping Requirements

### User Flow 1: Database Upload → Dashboard Generation
1. Landing page with upload area
2. File selection and upload animation
3. Success state with navigation to dashboard
4. AI dashboard generation process
5. Final dashboard display

### User Flow 2: AI Chat Interaction
1. Chat interface with quick actions
2. Message exchange animations
3. Chart/dashboard creation feedback
4. Results display and navigation

### User Flow 3: Data Exploration
1. Table selection from sidebar
2. Schema inspection
3. Data filtering and search
4. Custom query execution

### Interactive Elements to Prototype
- Tab navigation switching
- Drag and drop file upload
- Chat message sending
- Chart type selection
- Dashboard grid rearrangement
- Export button interactions
- Form validation states

### Responsive Behavior
- Desktop: Full feature set, multi-column layouts
- Tablet: Adjusted grid, scrollable navigation
- Mobile: Single column, stacked layouts, hamburger menu

## Accessibility Considerations

### Color Contrast
- Normal text: 4.5:1 ratio minimum
- Large text: 3:1 ratio minimum
- Interactive elements: 3:1 ratio minimum

### Focus States
- All interactive elements need visible focus indicators
- Focus ring: 2px solid Blue-500
- Focus order: Logical, left-to-right, top-to-bottom

### Screen Reader Support
- All images need alt text
- Form elements need labels
- Interactive elements need ARIA labels
- Data tables need proper headers

### Keyboard Navigation
- Tab through all interactive elements
- Enter to activate buttons, links
- Escape to close modals
- Arrow keys for navigation within components

##交付物 (Deliverables)

### Required Figma Files
1. **Design System Library**: Complete component library
2. **Desktop Screens**: All 8 tab interfaces
3. **Mobile Screens**: Responsive versions
4. **Interactive Prototype**: Clickable prototype with transitions
5. **User Flow Diagrams**: Visual representation of key flows

### Documentation
1. **Component Specifications**: Detailed specs for each component
2. **Interaction Guidelines**: How elements should behave
3. **Responsive Breakpoints**: Screen size specifications
4. **Animation Guidelines**: Timing and easing functions

### Export Assets
- SVG icons for all interface elements
- PNG fallbacks for complex graphics
- CSS snippets for custom styles
- Animation GIFs for complex interactions

This comprehensive specification provides everything needed to create a professional, modern Figma prototype that accurately represents the AI BI Visualization Tool's functionality and user experience.