-- Migration: dedup fact_service_stop (DL-15)
--
-- Removes accumulated duplicate rows caused by a NULL in the incremental
-- unique_key (route_stop_id, service_stop_id, _company_name). Unmatched route
-- stops had service_stop_id = NULL; NULL never matches on merge, so dbt re-
-- INSERTed them every nightly run. JOMO reached 3.5x its true size.
--
-- Pairs with the model change (coalesce(service_stop_id, route_stop_id)). Order:
--   1) deploy the model change   2) run THIS migration   3) dbt run fact+
-- so the cleaned table and the new model output agree on the key.
--
-- IN-PLACE dedup, NOT `dbt run --full-refresh`: the fact accumulates stops that
-- have aged out of the raw's rolling 6-month window, so a full rebuild would
-- silently destroy legitimate history (see CLAUDE.md). Idempotent, transactional,
-- self-verifying (aborts if a company drops below its distinct-grain floor).
--
-- Apply as the DB owner:
--   docker exec -i splashworks-postgres psql -U splashworks -d splashworks \
--     < infrastructure/postgres/migrations/2026-07-15-dedup-fact-service-stop.sql

\set ON_ERROR_STOP on
BEGIN;

-- BEFORE snapshot + the distinct-grain floor each company must not drop below.
CREATE TEMP TABLE _dedup_expect ON COMMIT DROP AS
SELECT _company_name,
       count(*)                                                          AS before_rows,
       count(DISTINCT (route_stop_id, coalesce(service_stop_id, route_stop_id))) AS grain
FROM public_warehouse.fact_service_stop
GROUP BY _company_name;

DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT * FROM _dedup_expect ORDER BY _company_name LOOP
        RAISE NOTICE 'BEFORE %: rows=% grain=% (will delete %)',
            r._company_name, r.before_rows, r.grain, r.before_rows - r.grain;
    END LOOP;
END $$;

-- Step 1: align existing unmatched rows with the new model output (NULL ->
-- route_stop_id) so the next dbt merge matches them instead of re-appending.
UPDATE public_warehouse.fact_service_stop
   SET service_stop_id = route_stop_id
 WHERE service_stop_id IS NULL;

-- Step 2: delete duplicate rows, keeping one per (company, route_stop_id,
-- service_stop_id). ctid = physical row id, stable within the transaction.
DELETE FROM public_warehouse.fact_service_stop f
USING (
    SELECT ctid,
           row_number() OVER (
               PARTITION BY _company_name, route_stop_id, service_stop_id
               ORDER BY ctid
           ) AS rn
    FROM public_warehouse.fact_service_stop
) d
WHERE f.ctid = d.ctid AND d.rn > 1;

-- Verify: each company now equals its distinct-grain floor exactly (no under- or
-- over-delete). Abort the whole transaction on any mismatch.
DO $$
DECLARE r record; actual bigint;
BEGIN
    FOR r IN SELECT * FROM _dedup_expect ORDER BY _company_name LOOP
        SELECT count(*) INTO actual FROM public_warehouse.fact_service_stop
         WHERE _company_name = r._company_name;
        IF actual <> r.grain THEN
            RAISE EXCEPTION 'FAIL %: expected % rows, got % — rolling back', r._company_name, r.grain, actual;
        END IF;
        RAISE NOTICE 'AFTER  %: rows=% (matches grain) ✓', r._company_name, actual;
    END LOOP;
END $$;

COMMIT;
