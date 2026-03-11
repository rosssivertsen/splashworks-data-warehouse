# QuickBooks Online Payments API — Reference

**Source:** [Intuit Developer Documentation](https://developer.intuit.com/app/developer/qbpayments/docs/api/resources/all-entities/bankaccounts)
**Last Updated:** 2026-03-14
**Purpose:** Reference for future payment processing integration

---

## Entities

| Entity | Description | Splashworks Relevance |
|--------|-------------|----------------------|
| **Charges** | Process credit card payments and refunds | Payment collection from customers |
| **Tokens** | Opaque container holding card/bank account info | Secure payment storage for recurring billing |
| **BankAccounts** | Process payments via bank accounts (ACH) | ACH payment processing |
| **Cards** | Store and manage credit card info for future payments | Card-on-file for recurring customers |
| **EChecks** | Process payments via electronic checks | Alternative payment method |

---

## Key Concepts

### Charges
- Create charges to process payments
- Supports capture (immediate) and authorization (hold then capture)
- Refunds processed through the Charges entity
- States: AUTHORIZED → CAPTURED → SETTLED (or REFUNDED, DECLINED)

### Tokens
- PCI-compliant tokenization of payment methods
- Generated client-side (never send raw card data to your server)
- Single-use or multi-use tokens
- Required for creating charges or storing cards

### Bank Accounts
- ACH/eCheck payment processing
- Routing number + account number stored securely
- Longer settlement time than card payments (3-5 business days)

### Cards
- Store credit card details for future charges
- Customer-level storage (one customer can have multiple cards)
- PCI compliance handled by Intuit

### EChecks
- Electronic check processing
- Similar to bank account payments but uses check routing
- Relevant for commercial accounts preferring check payment

---

## API Reference Links

- [Payments API Explorer](https://developer.intuit.com/app/developer/qbpayments/docs/api/resources/all-entities/bankaccounts)
- [Payments overview](https://developer.intuit.com/app/developer/qbpayments/docs/learn/explore-the-quickbooks-payments-api)
- [Process a payment workflow](https://developer.intuit.com/app/developer/qbpayments/docs/workflows/process-a-payment)
- [Charge and refund states](https://developer.intuit.com/app/developer/qbpayments/docs/workflows/understand-charge-and-refund-states)
- [Create tokens](https://developer.intuit.com/app/developer/qbpayments/docs/workflows/create-tokens)
- [OAuth 2.0 setup](https://developer.intuit.com/app/developer/qbpayments/docs/develop/authentication-and-authorization/oauth-2.0)
- [Error codes](https://developer.intuit.com/app/developer/qbpayments/docs/develop/troubleshooting/error-codes)
