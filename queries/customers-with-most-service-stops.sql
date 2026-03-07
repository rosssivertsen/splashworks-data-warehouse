SELECT
  c.SourceDb,
  c.id AS CustomerId,
  c.FirstName,
  c.LastName,
  COUNT(DISTINCT ss.id) AS service_stop_count
FROM u_Customer c
JOIN u_ServiceLocation sl
  ON sl.CustomerId = c.id
 AND sl.SourceDb = c.SourceDb
JOIN u_Pool p
  ON p.ServiceLocationId = sl.id
 AND p.SourceDb = sl.SourceDb
JOIN u_ServiceStop ss
  ON ss.PoolId = p.id
 AND ss.SourceDb = p.SourceDb
WHERE c.IsInactive = 0
  AND c.Deleted = 0
GROUP BY c.SourceDb, c.id, c.FirstName, c.LastName
ORDER BY service_stop_count DESC
LIMIT 50;
