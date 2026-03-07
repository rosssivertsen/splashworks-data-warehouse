SELECT
  sl.SourceDb,
  sl.id AS ServiceLocationId,
  sl.CustomerId
FROM u_ServiceLocation sl
LEFT JOIN u_Customer c
  ON c.id = sl.CustomerId
 AND c.SourceDb = sl.SourceDb
WHERE c.id IS NULL
ORDER BY sl.SourceDb, sl.id;
