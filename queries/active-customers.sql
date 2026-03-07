SELECT
  SourceDb,
  COUNT(*) AS active_customers
FROM u_Customer
WHERE IsInactive = 0
  AND Deleted = 0
GROUP BY SourceDb
ORDER BY SourceDb;
