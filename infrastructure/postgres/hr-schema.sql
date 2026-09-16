-- hr-schema.sql — employee census landing + the BBSI↔Skimmer identity crosswalk.
--
-- WHY THIS SCHEMA IS SEPARATE AND UNGRANTED:
--   These tables carry employee PII — names, date of birth, home address, masked SSN.
--   `audit` (IN-11) keeps splashworks_ro out at the TABLE level while still granting USAGE
--   on the schema. This goes further: the read-only roles get no USAGE at all, so the AI
--   query API cannot even enumerate these tables, let alone read them. A schema the
--   generated-SQL path cannot see is a stronger control than a table it can see but not
--   select from.
--
-- WHY A CROSSWALK EXISTS AT ALL:
--   Skimmer has NO employee identifier — verified 2026-09-15 across the full extract
--   schema (48 tables), the public API's Users object (id, firstName, lastName, username,
--   email, role, isActive), and the absence of any user tag or custom-field mechanism.
--   `Username` is name-derived, not a payroll number. So the only durable key linking a
--   technician in Skimmer to an employee at BBSI is the one BBSI supplies: `BBSI ID`.
--   Matching on names alone returns 22 of 122 — the two systems record nicknames against
--   legal names. This schema is what stops that being re-derived by hand every time.
--
-- Idempotent. Safe to re-run.

CREATE SCHEMA IF NOT EXISTS hr;
COMMENT ON SCHEMA hr IS
  'Employee PII and the BBSI-to-Skimmer identity crosswalk. Deliberately NOT granted to '
  'splashworks_ro / metabase_ro / powerbi_ro / ripple_rw. Do not grant USAGE without a '
  'decision recorded in docs/runbooks/2026-08-10-bbsi-sftp.md.';

REVOKE ALL ON SCHEMA hr FROM PUBLIC;

-- ---------------------------------------------------------------------------------------
-- Landing: the census exactly as BBSI sent it, append-only per source file.
-- Keeping every load rather than overwriting gives change history for free — hire dates,
-- status transitions and address changes are all visible by comparing loads, and nothing
-- has to be reconstructed later from files that may have aged out of the archive.
-- ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr.employee_census (
    bbsi_id          text        NOT NULL,
    source_file      text        NOT NULL,
    last_name        text,
    first_name       text,
    middle_init      text,
    ssn_masked       text,                  -- arrives as ###-##-9999; last four only
    dob              date,
    gender_code      text,
    last_hire_date   date,
    address_line1    text,
    address_line2    text,
    city             text,
    state            text,
    zip_code         text,
    ee_status_code   text,
    loaded_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (bbsi_id, source_file)
);
COMMENT ON COLUMN hr.employee_census.ssn_masked IS
  'BBSI sends this already masked to the last four digits (###-##-9999), verified across '
  'all 221 rows of the 2026-09-16 file. Never store an unmasked SSN here.';

CREATE INDEX IF NOT EXISTS employee_census_name_idx
    ON hr.employee_census (lower(last_name), lower(first_name));

-- Current state = the most recent load that mentions each employee.
CREATE OR REPLACE VIEW hr.v_employee_current AS
SELECT DISTINCT ON (bbsi_id) *
FROM hr.employee_census
ORDER BY bbsi_id, loaded_at DESC, source_file DESC;

-- ---------------------------------------------------------------------------------------
-- The crosswalk. One row per (employee, company) — a technician working for two entities
-- holds two Skimmer accounts and therefore two rows against one bbsi_id. That is the shape
-- of the real workforce: of 122 active technicians, 20 work for more than one entity and
-- 11 for all three.
--
-- SURVIVORSHIP RULE: a link, once made, is never silently withdrawn. The loader refreshes
-- last_confirmed_at when it re-derives a link and sets is_active = false when it can no
-- longer see one, but it never deletes the row and never modifies a row where is_manual is
-- true. A human decision outranks the matcher permanently — that is the entire point of
-- recording it.
-- ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr.employee_crosswalk (
    bbsi_id            text        NOT NULL,
    company            text        NOT NULL,      -- AQPS | JOMO | CLERMONT
    skimmer_account_id text        NOT NULL,
    match_method       text        NOT NULL,      -- email | full_name | last_initial | last_unique | manual
    confidence         text        NOT NULL,      -- high | medium | low
    is_manual          boolean     NOT NULL DEFAULT false,
    is_active          boolean     NOT NULL DEFAULT true,
    census_name        text,                      -- name as BBSI spelled it, at link time
    skimmer_name       text,                      -- name as Skimmer spelled it, at link time
    notes              text,
    first_linked_at    timestamptz NOT NULL DEFAULT now(),
    last_confirmed_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (bbsi_id, company, skimmer_account_id)
);
COMMENT ON TABLE hr.employee_crosswalk IS
  'BBSI employee id <-> Skimmer account id. Rows are never deleted by the loader; a link '
  'that can no longer be derived is marked is_active = false so the history of the link '
  'survives the person leaving. is_manual = true makes a row permanently loader-proof.';

CREATE INDEX IF NOT EXISTS employee_crosswalk_skimmer_idx
    ON hr.employee_crosswalk (skimmer_account_id);

-- ---------------------------------------------------------------------------------------
-- Exceptions. An unmatched record on either side is a finding, not an absence — a
-- technician with no employee record may be a contractor, an investor holding a login, or
-- a stale account, and each of those is worth someone's attention. Recording them makes
-- the gap visible instead of leaving it as the silent difference between two counts.
-- ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr.employee_match_exception (
    exception_id  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_at        timestamptz NOT NULL DEFAULT now(),
    side          text        NOT NULL,   -- census_only | skimmer_only
    bbsi_id       text,
    company       text,
    skimmer_id    text,
    display_name  text,
    detail        text
);

-- One row per side/identity per run. A surrogate key rather than a composite one because
-- Postgres will not accept expressions (coalesce over the nullable id columns) in a
-- PRIMARY KEY; the uniqueness that actually matters is expressed here instead.
CREATE UNIQUE INDEX IF NOT EXISTS employee_match_exception_run_idx
    ON hr.employee_match_exception
       (run_at, side, coalesce(bbsi_id, ''), coalesce(skimmer_id, ''));

CREATE INDEX IF NOT EXISTS employee_match_exception_side_idx
    ON hr.employee_match_exception (side, run_at DESC);

-- ---------------------------------------------------------------------------------------
-- Reporting view: one row per linked person-company, joining the census identity to the
-- Skimmer account. This is what analytics should read — never the census table directly.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW hr.v_technician_identity AS
SELECT x.bbsi_id,
       x.company,
       x.skimmer_account_id,
       e.first_name,
       e.last_name,
       e.last_hire_date,
       e.ee_status_code,
       e.city,
       e.state,
       e.zip_code,
       x.match_method,
       x.confidence,
       x.is_manual,
       x.is_active,
       x.last_confirmed_at
FROM hr.employee_crosswalk x
LEFT JOIN hr.v_employee_current e USING (bbsi_id);

-- Deliberately no GRANTs below this line. Adding one is a decision, not a convenience.
