SELECT
  SourceDb,
  Status,
  PaymentStatus,
  COUNT(*) AS invoice_count,
  ROUND(SUM(COALESCE(Total, 0)), 2) AS total_amount,
  ROUND(SUM(COALESCE(AmountDue, 0)), 2) AS amount_due
FROM u_Invoice
GROUP BY SourceDb, Status, PaymentStatus
ORDER BY SourceDb, invoice_count DESC;
