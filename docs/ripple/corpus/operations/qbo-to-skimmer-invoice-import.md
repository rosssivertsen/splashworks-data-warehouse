# QBO to Skimmer Invoice Import — Operational Runbook

## Overview

This runbook documents the process for migrating open invoices from QuickBooks Online (QBO) into Skimmer's billing system. Skimmer's API is **read-only for invoices** — no POST/PUT endpoints exist — so all invoice creation must be done through browser automation (Playwright RPA).

## When to Use

- Migrating historical AR balances from QBO into Skimmer billing
- Importing invoices for customers newly added to Skimmer
- Periodic reconciliation batches when QBO invoices need Skimmer counterparts

## Prerequisites

- Source CSV: AR Aging Detail Report from QBO (or equivalent invoice list)
- Skimmer login credentials with billing access
- Node.js + Playwright MCP (or standalone Playwright)
- Customer name mapping between QBO and Skimmer (see Integration Patterns)

## Process Steps

### 1. Data Preparation

- Export AR Aging Detail from QBO as CSV
- Parse CSV to extract: invoice number, customer name, amount, invoice date, due date, product/service
- Split into import-ready (matched to Skimmer customers) and exceptions (unmatched)
- Map QBO product names to Skimmer product names

### 2. Customer Name Resolution (CRITICAL — do this first)

QBO and Skimmer store customer names differently:
- QBO uses sub-customer format: `Parent:Child` (e.g., `Hired Helpr:Zapata, Lina`)
- Skimmer uses display names: `Lina Zapata` or `Zapata, Lina`
- Spelling differences are common (Shaprio/Shapiro, Strausser/Strawser)

Create a name resolution map BEFORE starting entry:
- For each QBO customer, determine the Skimmer search term
- Test each search term against Skimmer's billing dropdown (dry run)
- Document the `expectedMatch` keyword for automated verification

### 3. Dry Run Validation

Run a dry run that navigates to the Create Invoice page for each invoice, searches the customer dropdown, and verifies a match exists — without actually creating the invoice.

Pass criteria: 100% match rate before proceeding to production entry.

### 4. Batch Entry

- Calculate batch size: `max_batch = (timeout / per_item_time) × 0.7`
  - MCP Playwright timeout: ~120 seconds
  - Per-invoice time: ~8 seconds
  - Recommended batch size: **15 invoices**
- Process each invoice: navigate → search customer → select → add line item → set dates → save
- After each batch: verify Skimmer draft count against expected count

### 5. Reconciliation

After each batch:
- Check Skimmer Invoices page for draft count and amount
- Compare against running totals
- Generate batch report CSV
- Flag any variance immediately

### 6. Crash Recovery

If Playwright/MCP crashes mid-batch:
1. Check current Skimmer draft count
2. Calculate delta: `current_count - pre_batch_count = invoices_saved`
3. Since scripts process sequentially, the last `(batch_size - delta)` invoices were missed
4. Create a recovery script for only the missed invoices
5. Run recovery script, verify

### 7. Reporting

Generate at completion:
- Per-batch CSV reports (invoice #, customer, amount, date, status)
- Comprehensive text report with accounting reconciliation
- ROI analysis (see /roi-analysis skill)

## Key Skimmer UI Selectors (Verified April 2026)

| Element | Selector |
|---------|----------|
| Customer dropdown | `getByRole('combobox', { name: 'Select Customer...' })` |
| Product dropdown | `getByRole('combobox', { name: 'Item' })` |
| Description field | `getByRole('textbox', { name: 'Desc' })` |
| Rate field | `getByRole('spinbutton', { name: 'Unit Rate' })` |
| Line item Save (Apply) | `getByRole('button', { name: 'Save' }).nth(1)` |
| Invoice Save | `getByRole('button', { name: 'Save' }).first()` |
| Invoice Date | `getByRole('combobox').nth(0)` (after customer selection) |
| Due Date | `getByRole('combobox').nth(1)` |

## Editing Existing Invoices

If dates or amounts need correction after entry:

1. Use the **Invoice # filter** in the toolbar (not the grid filter row) to find the invoice
2. Click **Details** on the matching row
3. Click **Edit** — the detail page is read-only by default
4. Modify date fields using the same `Meta+a → Backspace → type MMDDYYYY` approach
5. Click **Save**

URL pattern: `/Client/Billing/Invoices/{UUID}` — you need the Details button to get there, not the invoice number.

## Known Gotchas

- **Date fields use mask input**: type zero-padded MMDDYYYY (no slashes) — mask auto-inserts them
- **Due date auto-recalculates**: Skimmer recalculates due date when invoice date changes — wait 1000ms before setting due date
- **`fill()` doesn't trigger React state**: must use `Meta+a → Backspace → keyboard.type()`
- **Product search must be specific**: "Residential Service" not "Residential" (avoids matching "Labor Residential")
- **`beforeunload` dialog**: fires when navigating away from partially-filled form — need `page.on('dialog', d => d.accept())`
- **API-created customers are NOT billing-eligible**: they get `isLead: true` and don't appear in the invoice customer dropdown

## Results — April 2026 Migration

| Metric | Value |
|--------|-------|
| Total invoices migrated | 374 |
| Dollar value | $70,360.73 |
| Error rate | 0.00% |
| Phases | 2 (274 + 100) |
| Sessions | 9 |
| Automation hours | ~15.5 |
| Manual equivalent | ~47 hours |
