# Customer Cancellation Workflow

What happens when a customer cancels their pool service account, including the impact on every system, open invoices, scheduled work orders, and recurring billing.

---

## Step 1: Mark the Customer Inactive in Skimmer

The customer record is updated in Skimmer:
- Set `IsInactive = 1` (the primary cancellation flag)
- The `UpdatedAt` timestamp becomes the effective cancellation date
- The `Deleted` flag may also be set to `1` depending on the cancellation reason

**Key rule:** A cancelled customer is defined as `is_inactive = 1 OR deleted = 1`. Both flags should be checked in any query. The inverse — an active customer — requires `is_inactive = 0 AND deleted = 0` (BOTH conditions).

**Data warehouse impact:** The nightly ETL pipeline picks up the status change. `dim_customer.is_inactive` and `dim_customer.deleted` update accordingly. `rpt_customer_360` reflects the new lifecycle status.

---

## Step 2: Stop Recurring Service (Route Assignments)

All active route assignments for the customer's service locations must end:
- Set `EndDate` on each `RouteAssignment` to the cancellation effective date
- Active route filter: `end_date >= CURRENT_DATE::text` (sentinel value `2080-01-01` means "no end date")
- The customer's pools will no longer appear on technician route sheets after the end date

**What to check:** Verify all service locations have their route assignments ended. A customer with multiple locations may have assignments on different routes/techs.

---

## Step 3: Handle Scheduled Work Orders

Open and scheduled work orders need resolution:

- **Not yet started work orders** (no `StartTime`, no `CompleteTime`): Cancel or delete these. They should not generate charges.
- **In-progress work orders** (`StartTime` set, `CompleteTime` is null or `2010-01-01 12:00:00`): Decide whether to complete or cancel. If work was partially done, the tech should complete and document what was performed in `WorkPerformed`.
- **Completed but not invoiced** (`CompleteTime` set, `IsInvoiced = 0`): These represent work already done. They should be invoiced before closing the account — the customer owes for completed work.

**Best practice:** Review all open work orders before finalizing cancellation. Completed-but-uninvoiced work orders are revenue that will be lost if not billed.

---

## Step 4: Handle Open Invoices

Open invoices fall into several categories:

### Unpaid invoices (PaymentStatus = 'Unpaid')
- **For service already rendered:** Keep the invoice open and pursue collection. The customer owes for work completed before cancellation.
- **For prepaid/future service:** If the customer paid ahead, consider prorating. If they haven't paid for future service, void the invoice with a VoidReason.
- **Mid-month proration:** Use the Invoice Generator's prorated billing feature to generate a final invoice covering service from the last billing date through cancellation.

### Partially paid invoices (PaymentStatus = 'Partial')
- Keep open and pursue collection for the remaining `AmountDue`.

### Draft invoices (Status = 'Draft')
- Review and either finalize (if for completed work) or void.

### Voiding rules
- Set `Status = 'Void'` and provide a `VoidReason` (e.g., "Customer cancelled — service not rendered")
- Voided invoices are excluded from revenue reporting
- The void syncs to QBO on the next sync cycle

---

## Step 5: Stop Autopay

If the customer has autopay enabled:
- Disable `CanAutopay` on any remaining open invoices
- The customer's saved payment method (`PaymentMethodId`) remains on file but will no longer be charged
- Verify `IsAutopay` charges are not scheduled to run

**Important:** Stopping autopay should happen before or simultaneously with marking the customer inactive. If autopay runs against a voided invoice, it will fail and create noise in the failed payments queue.

---

## Step 6: QuickBooks Online Sync

Skimmer's native sync propagates changes to QBO:
- The customer record in QBO should be marked `active = false` (QBO's equivalent of inactive)
- Voided invoices in Skimmer sync as voided in QBO
- Any final payments recorded in Skimmer sync to QBO

**What to verify in QBO:**
- Customer shows as inactive
- No open invoices remain (all paid, voided, or written off)
- Payment records match between Skimmer and QBO

---

## Step 7: Data Warehouse Updates

The nightly ETL pipeline handles downstream updates automatically:
- `dim_customer`: `is_inactive` and/or `deleted` flags update
- `rpt_customer_360`: Lifecycle metrics recalculate (tenure, LTV finalized)
- `fact_service_stop`: No new service stops for this customer after cancellation
- `fact_invoice` and `fact_payment`: Final invoice/payment records captured

**Reporting consideration:** The customer's historical data remains in the warehouse. Cancelled customers appear in historical queries but are excluded from "active customer" counts by the standard filter (`is_inactive = 0 AND deleted = 0`).

---

## Step 8: Communication

Depending on company process:
- Send a cancellation confirmation to the customer
- Send a final invoice/statement if applicable
- Remove the customer from any broadcast email lists in Skimmer

---

## Summary Checklist

| Step | System | Action | Who |
|------|--------|--------|-----|
| 1 | Skimmer | Mark customer `IsInactive = 1` | Admin |
| 2 | Skimmer | End all route assignments | Admin |
| 3 | Skimmer | Resolve open work orders (cancel, complete, or invoice) | Admin + Tech |
| 4 | Skimmer | Handle open invoices (collect, prorate, or void) | Admin |
| 5 | Skimmer | Disable autopay | Admin |
| 6 | QBO | Verify sync: customer inactive, invoices resolved | Admin |
| 7 | Warehouse | Automatic — nightly ETL picks up all changes | System |
| 8 | Skimmer/Email | Send cancellation confirmation and final statement | Admin |

---

## Common Scenarios

### Customer cancels mid-month, service already performed this month
1. Generate a final invoice for service rendered (prorated if needed)
2. Collect payment or note as receivable
3. Mark inactive, end routes, cancel remaining work orders

### Customer cancels mid-month, service not yet performed this month
1. Cancel scheduled service stops and work orders
2. Void any draft invoices for the current period
3. Mark inactive, end routes

### Customer cancels with outstanding balance
1. Keep invoices open for collection
2. Mark inactive (stops new service) but do not void unpaid invoices
3. Follow up on collection separately

### Customer requests account hold (not cancellation)
- Do NOT mark as inactive — this loses the active customer designation
- Instead, end route assignments with a future re-start date
- Communicate the hold period and restart expectations
