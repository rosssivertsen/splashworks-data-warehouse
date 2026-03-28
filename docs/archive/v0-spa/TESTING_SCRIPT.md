# Testing Script - Pool Service BI Visualizer

## Purpose

This testing script provides step-by-step instructions for comprehensive testing of the Pool Service BI Visualizer application, including the new onboarding screen with compliance logging.

## Testing Environment Setup

### Prerequisites
- ✅ Modern web browser (Chrome, Firefox, Safari, or Edge)
- ✅ Internet connection (for Netlify deployment testing)
- ✅ Access to Netlify dashboard (for compliance log verification)
- ✅ Sample SQLite database file for testing
- ✅ OpenAI API key (for AI feature testing)

### Test Accounts
- **Tester 1**: Use actual name for compliance log
- **Tester 2**: Different browser/incognito for repeat testing
- **Administrator**: Access to Netlify dashboard for log verification

## Test Categories

1. [Onboarding & Compliance](#test-suite-1-onboarding--compliance)
2. [Database Upload](#test-suite-2-database-upload)
3. [AI Assistant Features](#test-suite-3-ai-assistant-features)
4. [Dashboard Functionality](#test-suite-4-dashboard-functionality)
5. [Data Persistence](#test-suite-5-data-persistence)
6. [Cross-Browser Compatibility](#test-suite-6-cross-browser-compatibility)

---

## Test Suite 1: Onboarding & Compliance

### Test 1.1: First-Time User Experience
**Objective**: Verify onboarding screen appears for new users

**Steps**:
1. Open browser in incognito/private mode
2. Navigate to application URL
3. Verify onboarding screen appears immediately

**Expected Results**:
- ✅ Onboarding screen displays before main application
- ✅ "Welcome – Terms of Use & Privacy Notice" header visible
- ✅ Terms content is scrollable
- ✅ All form fields are present and properly formatted

**Pass Criteria**: All expected results achieved

---

### Test 1.2: Form Validation
**Objective**: Verify form validation works correctly

**Steps**:
1. On onboarding screen, leave all fields empty
2. Verify submit button is disabled (light blue/gray)
3. Check the agreement checkbox
4. Verify button remains disabled
5. Enter name "Test User"
6. Verify button remains disabled
7. Confirm date field is pre-filled with today's date
8. Verify button is now enabled (darker blue)

**Expected Results**:
- ✅ Submit button disabled when fields incomplete
- ✅ Date field defaults to today's date
- ✅ Submit button enables only when all fields complete
- ✅ Visual change in button color when enabled

**Pass Criteria**: Button behavior matches all requirements

---

### Test 1.3: Terms Content Review
**Objective**: Verify terms content is complete and readable

**Steps**:
1. Read through all terms sections
2. Scroll to bottom of terms box
3. Verify all sections are present

**Expected Sections**:
- ✅ License and Access
- ✅ No Warranty
- ✅ Limitation of Liability
- ✅ Indemnity and Release
- ✅ Privacy and Data Handling
- ✅ Termination of Access
- ✅ Governing Law
- ✅ Final confirmation statement

**Pass Criteria**: All sections present and readable

---

### Test 1.4: Successful Submission
**Objective**: Verify form submission and navigation

**Steps**:
1. Complete all required fields:
   - Check agreement box
   - Enter name: "[Your Full Name]"
   - Verify/modify date if needed
2. Click "Continue to Application"
3. Wait for navigation

**Expected Results**:
- ✅ Application loads immediately
- ✅ "Upload Database" tab is displayed
- ✅ No errors in browser console
- ✅ Onboarding screen does not reappear

**Pass Criteria**: Successful navigation to main application

---

### Test 1.5: One-Time Display Verification
**Objective**: Verify onboarding only shows once

**Steps**:
1. After completing Test 1.4, refresh the browser (F5)
2. Navigate away and return to the application
3. Close and reopen the browser tab

**Expected Results**:
- ✅ Onboarding screen does NOT appear on refresh
- ✅ Main application loads directly
- ✅ Upload Database tab is active

**Pass Criteria**: Onboarding never reappears in same browser

---

### Test 1.6: Compliance Logging Verification
**Objective**: Verify submission is logged to Netlify Forms

**Steps**:
1. Administrator logs into Netlify dashboard
2. Navigate to: Site → Forms → "terms-acceptance"
3. Locate submission matching test timestamp
4. Verify all data fields are captured

**Expected Data**:
- ✅ Full name (as entered)
- ✅ Date (as selected)
- ✅ Timestamp (ISO 8601 format)
- ✅ Agreed: true
- ✅ IP address (automatically captured)
- ✅ User agent (automatically captured)

**Pass Criteria**: All data accurately logged in Netlify Forms

---

### Test 1.7: Multiple User Submissions
**Objective**: Verify logging for multiple users

**Steps**:
1. Open application in different browser (or new incognito window)
2. Complete onboarding with different name: "Test User 2"
3. Verify submission in Netlify Forms
4. Repeat with third user: "Test User 3"

**Expected Results**:
- ✅ Each submission creates separate log entry
- ✅ Timestamps are different for each submission
- ✅ IP addresses may be same or different
- ✅ All submissions visible in Netlify dashboard

**Pass Criteria**: All submissions logged independently

---

### Test 1.8: localStorage Persistence
**Objective**: Verify localStorage correctly stores completion status

**Steps**:
1. Complete onboarding (if not already done)
2. Open browser developer tools (F12)
3. Navigate to Application/Storage → Local Storage
4. Find key: `onboarding_completed`
5. Examine stored value

**Expected Data Structure**:
```json
{
  "completed": true,
  "name": "[User Name]",
  "date": "2025-10-29",
  "timestamp": "2025-10-29T13:30:45.123Z"
}
```

**Pass Criteria**: Data correctly stored in localStorage

---

## Test Suite 2: Database Upload

### Test 2.1: File Upload Interface
**Objective**: Verify upload interface is accessible

**Steps**:
1. Navigate to "Upload Database" tab (should be default)
2. Verify upload area is visible
3. Check for "Browse Files" button
4. Verify supported file types are listed

**Expected Results**:
- ✅ Upload area with dashed border visible
- ✅ "Browse Files" button present
- ✅ File type notice displays: ".db, .sqlite, and .sqlite3 files"
- ✅ Drag & drop instructions visible

**Pass Criteria**: Upload interface complete and clear

---

### Test 2.2: Drag & Drop Upload
**Objective**: Test drag and drop functionality

**Steps**:
1. Locate a test SQLite database file
2. Drag file over the upload area
3. Observe visual feedback
4. Drop file in upload area
5. Wait for processing

**Expected Results**:
- ✅ Border changes color when file is dragged over
- ✅ Loading spinner appears during processing
- ✅ Success message appears when complete
- ✅ Automatic navigation to AI Assistant tab
- ✅ "Database Connected" indicator in header

**Pass Criteria**: Upload completes without errors

---

### Test 2.3: Browse Files Upload
**Objective**: Test file browser upload method

**Steps**:
1. Click "Browse Files" button
2. Select a SQLite database file from file picker
3. Wait for upload to complete

**Expected Results**:
- ✅ File picker dialog opens
- ✅ File uploads successfully
- ✅ Same success indicators as drag & drop
- ✅ Navigation to AI Assistant tab

**Pass Criteria**: Upload works via file browser

---

### Test 2.4: Large File Upload
**Objective**: Test upload of large database file

**Steps**:
1. Use a database file 50MB+ in size
2. Upload using either method
3. Monitor progress (may take 30-60 seconds)
4. Verify successful completion

**Expected Results**:
- ✅ Large file uploads without timeout
- ✅ Loading indicator shows processing
- ✅ Success message appears
- ✅ Application remains responsive

**Pass Criteria**: Large files handled correctly

---

### Test 2.5: Invalid File Upload
**Objective**: Verify file type validation

**Steps**:
1. Attempt to upload a non-SQLite file (.txt, .pdf, .jpg)
2. Observe error handling

**Expected Results**:
- ✅ Error message appears
- ✅ Upload does not proceed
- ✅ User can try again with correct file

**Pass Criteria**: Invalid files rejected appropriately

---

## Test Suite 3: AI Assistant Features

### Test 3.1: AI Assistant Activation
**Objective**: Verify AI Assistant activates after database upload

**Steps**:
1. After successful database upload (from Test 2.2 or 2.3)
2. Verify automatic navigation to AI Assistant tab
3. Observe interface elements

**Expected Results**:
- ✅ AI Assistant tab automatically selected
- ✅ Chat interface visible
- ✅ Four quick action buttons present
- ✅ Message input field available

**Pass Criteria**: AI Assistant ready for use

---

### Test 3.2: Quick Action Buttons
**Objective**: Test quick action button functionality

**Steps**:
1. In AI Assistant, verify presence of buttons:
   - 📊 Create Dashboard
   - 📈 Add Chart
   - 💡 Generate Insights
   - 🔍 Query Data
2. Click each button
3. Observe behavior

**Expected Results**:
- ✅ Each button responds to clicks
- ✅ Button actions populate message input
- ✅ Clear visual feedback on interaction

**Pass Criteria**: All buttons functional

---

### Test 3.3: Natural Language Query
**Objective**: Test AI query processing

**Prerequisites**: OpenAI API key configured in Settings

**Steps**:
1. Enter a natural language question
   Example: "How many records are in the database?"
2. Press Enter or click Send
3. Wait for AI response
4. Review results

**Expected Results**:
- ✅ Query is processed
- ✅ SQL query generated
- ✅ Results displayed in chat
- ✅ Response time < 10 seconds

**Pass Criteria**: Query answered successfully

---

### Test 3.4: Dashboard Creation via AI
**Objective**: Test dashboard auto-generation

**Steps**:
1. Click "Create Dashboard" button
2. Wait for AI to analyze database
3. Review generated dashboard
4. Navigate to Executive Dashboard tab to see result

**Expected Results**:
- ✅ Dashboard created automatically
- ✅ Contains 3-4 relevant charts
- ✅ Dashboard visible in Dashboard tab
- ✅ Charts display actual data

**Pass Criteria**: Dashboard generated successfully

---

## Test Suite 4: Dashboard Functionality

### Test 4.1: Executive Dashboard Display
**Objective**: Verify default dashboard creation

**Steps**:
1. Navigate to "Executive Dashboard" tab
2. Verify "Pool Service Executive Dashboard" exists
3. Count number of charts displayed
4. Check chart data rendering

**Expected Results**:
- ✅ Default dashboard present
- ✅ Multiple charts displayed
- ✅ Charts contain actual data
- ✅ Charts are interactive

**Pass Criteria**: Dashboard displays correctly

---

### Test 4.2: Chart Interaction
**Objective**: Test chart interactivity

**Steps**:
1. Hover over chart elements
2. Check for tooltips or data labels
3. Verify chart legends
4. Test any zoom or pan features

**Expected Results**:
- ✅ Tooltips appear on hover
- ✅ Data values displayed clearly
- ✅ Legends identify data series
- ✅ Charts are readable and professional

**Pass Criteria**: Charts fully interactive

---

### Test 4.3: Dashboard Management
**Objective**: Test dashboard CRUD operations

**Steps**:
1. Create new dashboard
   - Click "+ New Dashboard" button
   - Enter name: "Test Dashboard"
   - Confirm creation
2. Rename dashboard
   - Click edit icon
   - Change name to "Modified Test Dashboard"
3. Delete dashboard
   - Click delete icon
   - Confirm deletion

**Expected Results**:
- ✅ New dashboard created successfully
- ✅ Dashboard name updates immediately
- ✅ Dashboard deleted without errors
- ✅ Default dashboard unaffected

**Pass Criteria**: All CRUD operations work

---

### Test 4.4: Dashboard Export
**Objective**: Test PDF export functionality

**Steps**:
1. Navigate to a dashboard with charts
2. Click "Export to PDF" button
3. Wait for PDF generation
4. Open downloaded PDF file

**Expected Results**:
- ✅ PDF downloads automatically
- ✅ All charts included in PDF
- ✅ PDF is well-formatted
- ✅ Text is readable

**Pass Criteria**: PDF exports correctly

---

## Test Suite 5: Data Persistence

### Test 5.1: Dashboard Persistence
**Objective**: Verify dashboards survive browser refresh

**Steps**:
1. Create or modify a dashboard
2. Add a chart or make changes
3. Refresh browser (F5 or Ctrl+R)
4. Navigate back to Dashboard tab

**Expected Results**:
- ✅ All dashboards still present
- ✅ Charts remain in dashboards
- ✅ Modifications are saved
- ✅ No data loss

**Pass Criteria**: Complete persistence verified

---

### Test 5.2: Settings Persistence
**Objective**: Verify API key storage

**Steps**:
1. Navigate to Settings tab
2. Enter OpenAI API key
3. Refresh browser
4. Return to Settings tab
5. Verify API key is still present (masked)

**Expected Results**:
- ✅ API key saved in localStorage
- ✅ Key persists across refreshes
- ✅ Key remains masked for security

**Pass Criteria**: Settings persisted correctly

---

### Test 5.3: Cross-Session Persistence
**Objective**: Verify data persists across browser sessions

**Steps**:
1. Complete tests with dashboards and settings
2. Close browser completely
3. Reopen browser and navigate to application
4. Verify onboarding doesn't show (already completed)
5. Check that dashboards and settings remain

**Expected Results**:
- ✅ Onboarding not shown again
- ✅ Dashboards still available
- ✅ Settings still configured
- ✅ No data loss from closing browser

**Pass Criteria**: Full persistence across sessions

---

## Test Suite 6: Cross-Browser Compatibility

### Test 6.1: Chrome Testing
**Objective**: Verify full functionality in Chrome

**Steps**:
1. Repeat key tests in Google Chrome
   - Onboarding (Test 1.1-1.5)
   - Database Upload (Test 2.2)
   - Dashboard Display (Test 4.1)

**Expected Results**:
- ✅ All features work in Chrome
- ✅ No console errors
- ✅ Visual rendering correct

**Pass Criteria**: Complete Chrome compatibility

---

### Test 6.2: Firefox Testing
**Objective**: Verify full functionality in Firefox

**Steps**:
1. Repeat key tests in Mozilla Firefox
   - Onboarding (Test 1.1-1.5)
   - Database Upload (Test 2.2)
   - Dashboard Display (Test 4.1)

**Expected Results**:
- ✅ All features work in Firefox
- ✅ No console errors
- ✅ Visual rendering correct

**Pass Criteria**: Complete Firefox compatibility

---

### Test 6.3: Safari Testing (macOS)
**Objective**: Verify functionality in Safari

**Steps**:
1. Repeat key tests in Safari
   - Onboarding (Test 1.1-1.5)
   - Database Upload (Test 2.2)
   - Dashboard Display (Test 4.1)

**Expected Results**:
- ✅ All features work in Safari
- ✅ No console errors
- ✅ Visual rendering correct

**Pass Criteria**: Complete Safari compatibility

---

### Test 6.4: Edge Testing
**Objective**: Verify functionality in Microsoft Edge

**Steps**:
1. Repeat key tests in Edge
   - Onboarding (Test 1.1-1.5)
   - Database Upload (Test 2.2)
   - Dashboard Display (Test 4.1)

**Expected Results**:
- ✅ All features work in Edge
- ✅ No console errors
- ✅ Visual rendering correct

**Pass Criteria**: Complete Edge compatibility

---

## Test Results Summary

### Test Execution Checklist

#### Suite 1: Onboarding & Compliance
- [ ] Test 1.1: First-Time User Experience
- [ ] Test 1.2: Form Validation
- [ ] Test 1.3: Terms Content Review
- [ ] Test 1.4: Successful Submission
- [ ] Test 1.5: One-Time Display Verification
- [ ] Test 1.6: Compliance Logging Verification
- [ ] Test 1.7: Multiple User Submissions
- [ ] Test 1.8: localStorage Persistence

#### Suite 2: Database Upload
- [ ] Test 2.1: File Upload Interface
- [ ] Test 2.2: Drag & Drop Upload
- [ ] Test 2.3: Browse Files Upload
- [ ] Test 2.4: Large File Upload
- [ ] Test 2.5: Invalid File Upload

#### Suite 3: AI Assistant Features
- [ ] Test 3.1: AI Assistant Activation
- [ ] Test 3.2: Quick Action Buttons
- [ ] Test 3.3: Natural Language Query
- [ ] Test 3.4: Dashboard Creation via AI

#### Suite 4: Dashboard Functionality
- [ ] Test 4.1: Executive Dashboard Display
- [ ] Test 4.2: Chart Interaction
- [ ] Test 4.3: Dashboard Management
- [ ] Test 4.4: Dashboard Export

#### Suite 5: Data Persistence
- [ ] Test 5.1: Dashboard Persistence
- [ ] Test 5.2: Settings Persistence
- [ ] Test 5.3: Cross-Session Persistence

#### Suite 6: Cross-Browser Compatibility
- [ ] Test 6.1: Chrome Testing
- [ ] Test 6.2: Firefox Testing
- [ ] Test 6.3: Safari Testing
- [ ] Test 6.4: Edge Testing

---

## Issue Reporting Template

When issues are discovered, use this template:

```markdown
**Test ID**: [e.g., Test 1.2]
**Test Name**: [e.g., Form Validation]
**Browser**: [Chrome/Firefox/Safari/Edge]
**Severity**: [Critical/High/Medium/Low]

**Issue Description**:
[Clear description of what went wrong]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [...]

**Expected Result**:
[What should have happened]

**Actual Result**:
[What actually happened]

**Screenshots/Logs**:
[Attach screenshots or console logs if available]

**Additional Notes**:
[Any other relevant information]
```

---

## Regression Testing

After any code changes, run abbreviated regression tests:

### Quick Regression Suite (15 minutes)
1. Test 1.4: Successful Submission (onboarding)
2. Test 2.2: Drag & Drop Upload
3. Test 4.1: Executive Dashboard Display
4. Test 5.1: Dashboard Persistence

### Full Regression Suite (2 hours)
- Run all tests in Test Suite 1, 2, 4, and 5
- Run cross-browser tests for primary browser only

---

## Test Sign-Off

**Testing Completed By**: ___________________  
**Date**: ___________________  
**Total Tests**: ___________________  
**Passed**: ___________________  
**Failed**: ___________________  
**Blocked**: ___________________  

**Overall Status**: ☐ PASS  ☐ FAIL  ☐ PASS WITH ISSUES

**Notes**:
_______________________________________
_______________________________________
_______________________________________

**Approved for Deployment**: ☐ YES  ☐ NO

**Approver**: ___________________  
**Date**: ___________________
