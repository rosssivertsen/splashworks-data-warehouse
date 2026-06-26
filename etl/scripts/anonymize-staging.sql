-- anonymize-staging.sql
-- PII masking for the STAGING mirror. Runs after a fresh prod restore, before staging serves traffic.
--
-- Design:
--   * Self-discovering: sweeps every BASE TABLE in the data schemas and masks any column whose
--     name matches a known-PII pattern. This auto-covers raw_skimmer's per-company tables AND the
--     dated drift-snapshot copies (AQPS_Customer_20260308, ...), and survives schema drift.
--   * Deterministic on VALUE: each mask is a pure function of the plaintext (md5/hashtext), so the
--     same input masks to the same output in every table -> cross-report name consistency without
--     needing a shared join key. Joins are on IDs (untouched), so query correctness is preserved.
--   * Idempotent in practice: it runs against a fresh prod restore each night; re-masking an already
--     masked value is harmless (stable function of input).
--
-- SAFETY: wrap in BEGIN/ROLLBACK to dry-run (see verify block at bottom). The nightly job runs it committed.

DO $$
DECLARE
  r          record;
  pii_regex  text :=
    '^(firstname|first_name|lastname|last_name|fullname|full_name'
    '|customername|customer_name|clean_customer_name|companyname|company_name'
    '|poolname|pool_name|techniciantname|technician_name|contactname|contact_name|contact'
    '|email[0-9]?|phone[0-9]?|mobile|cellphone|cell'
    '|address[0-9]?|street|serviceaddress|service_address|service_location_address|billingaddress|billing_address'
    '|zip|zipcode|postalcode|billing_zip|service_zip)$';
  expr       text;
  n          bigint;
  total      bigint := 0;
  cols       int := 0;
BEGIN
  FOR r IN
    SELECT c.table_schema AS s, c.table_name AS t, c.column_name AS col
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name   = c.table_name
     AND tb.table_type   = 'BASE TABLE'
    WHERE c.table_schema IN ('raw_skimmer','public_warehouse','public_semantic')
      AND lower(c.column_name) ~ pii_regex
      AND c.data_type IN ('text','character varying','character')
      -- exclusions: operating-company entity (AQPS/JOMO), not personal data
      AND NOT (lower(c.table_name) = 'dim_company'
               AND lower(c.column_name) IN ('company_name','company_full_name'))
      AND lower(c.column_name) NOT IN
          ('_company_name','product_name','item_name','month_name','day_name','tag_name','clean_tag_name')
  LOOP
    expr := CASE
      WHEN lower(r.col) ~ 'email'              THEN format('''user_'' || substr(md5(%I),1,10) || ''@example.invalid''', r.col)
      WHEN lower(r.col) ~ 'phone|mobile|cell'  THEN format('''555-'' || lpad((abs(hashtext(%I)) %% 10000)::text,4,''0'')', r.col)
      WHEN lower(r.col) ~ 'zip|postal'         THEN format('lpad((abs(hashtext(%I)) %% 100000)::text,5,''0'')', r.col)
      WHEN lower(r.col) ~ 'address|street'     THEN format('(abs(hashtext(%I)) %% 9899 + 100)::text || '' Mock St''', r.col)
      ELSE                                          format('''Masked_'' || upper(substr(md5(%I),1,10))', r.col)
    END;

    EXECUTE format('UPDATE %I.%I SET %I = %s WHERE %I IS NOT NULL AND %I <> %L',
                   r.s, r.t, r.col, expr, r.col, r.col, '');
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n; cols := cols + 1;
    RAISE NOTICE 'masked %.%.% -> % rows', r.s, r.t, r.col, n;
  END LOOP;

  RAISE NOTICE '=== anonymization complete: % columns across % data schemas, % cells masked ===', cols, 3, total;
END $$;
