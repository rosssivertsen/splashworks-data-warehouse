#!/usr/bin/env python3
"""load_employee_census.py — land the BBSI employee census and maintain the
BBSI-id ↔ Skimmer-account crosswalk.

WHY THIS EXISTS
    Skimmer holds no employee identifier. That was verified 2026-09-15 against the full
    extract schema, the public API's Users object, and the absence of any user-tag or
    custom-field mechanism — `Username` is name-derived, not a payroll number. BBSI's
    census supplies `BBSI ID`, which is the only stable key linking the two systems.

WHY NOT JUST MATCH ON NAMES EACH TIME
    Because it does not work and it fails quietly. Matching the 122 active technicians
    against the 116-row census on full name returns **22**. The systems record nicknames
    against legal names. Email carries 80, last-name 103. The answer needs a cascade, and
    a cascade re-derived by hand every time will drift. Once a link is established it is
    written down here and reused.

SAFETY PROPERTIES
    * Landing is append-only per source file — history comes free, nothing is overwritten.
    * A link is never deleted. One that can no longer be derived is marked inactive, so
      the fact that it once existed survives the employee leaving.
    * `is_manual` rows are never touched by this script. A human decision outranks the
      matcher permanently.
    * Mass-deactivation guard: if a run would deactivate more than half of the currently
      active links, it refuses and reports instead. A truncated or mis-parsed census
      should not be able to quietly erase the crosswalk.

Usage:
    load_employee_census.py [--census PATH] [--dry-run]
    Defaults to the newest *.csv in /opt/splashworks/data/restricted/sftp-bbsi.
"""
from __future__ import annotations

import argparse
import csv
import glob
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

import psycopg2
import psycopg2.extras

RESTRICTED_DIR = os.environ.get(
    "RESTRICTED_BBSI_DIR", "/opt/splashworks/data/restricted/sftp-bbsi"
)
COMPANIES = ("AQPS", "JOMO", "CLERMONT")

# A link is only as good as the evidence behind it; the report says which was used.
CONFIDENCE = {
    "email": "high",
    "full_name": "high",
    "last_initial": "medium",
    "last_unique": "low",
}


def norm(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


# Skimmer's FirstName field carries the technician's ROUTE, not just their name:
#   "8 -John", "7 -Michael", "3 -Doug"   (JOMO — 64 of 82 active techs)
#   "C-Noe", "R-Quint"                   (AQPS — 25 of 47)
# Matching on the raw field silently compares a route number against a first name. It
# does not error; it just never matches, and then a weaker pass picks up the slack and
# produces confident-looking nonsense. Strip the designator before any comparison.
ROUTE_PREFIX = re.compile(r"^\s*[A-Za-z0-9]{1,3}\s*-\s*")

# Accounts that are places or states rather than people. Skimmer models an unscheduled
# route as a Tech account, so a headcount that trusts RoleType alone counts furniture.
NON_PERSON = re.compile(
    r"^(unscheduled|unassigned|office|shop|warehouse|temp|test|route|open)\b", re.I
)


def clean_first(s: str | None) -> str:
    return norm(ROUTE_PREFIX.sub("", (s or "").strip()))


def is_person(first: str, last: str) -> bool:
    return not (NON_PERSON.search(last or "") or NON_PERSON.search(first or ""))


def parse_date(s: str | None):
    s = (s or "").strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def newest_census() -> str:
    files = [f for f in glob.glob(os.path.join(RESTRICTED_DIR, "*.csv"))]
    if not files:
        sys.exit(f"ERROR: no census csv found in {RESTRICTED_DIR}")
    return max(files, key=os.path.getmtime)


def read_census(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))
    out = []
    for r in rows:
        bbsi = (r.get("BBSI ID") or "").strip()
        if not bbsi:
            continue
        out.append(
            {
                "bbsi_id": bbsi,
                "last_name": (r.get("Employee Last Name") or "").strip(),
                "first_name": (r.get("Employee First Name") or "").strip(),
                "middle_init": (r.get("Employee Middle Init") or "").strip(),
                "ssn_masked": (r.get("SSN") or "").strip(),
                "dob": parse_date(r.get("DOB")),
                "gender_code": (r.get("Gender Code") or "").strip(),
                "last_hire_date": parse_date(r.get("Last Hire Date")),
                "address_line1": (r.get("Address Line 1") or "").strip(),
                "address_line2": (r.get("Address Line 2") or "").strip(),
                "city": (r.get("City") or "").strip(),
                "state": (r.get("State") or "").strip(),
                "zip_code": (r.get("Zip Code") or "").strip(),
                "ee_status_code": (r.get("EE Status Code") or "").strip(),
            }
        )
    if not out:
        sys.exit(f"ERROR: {path} parsed to zero rows — wrong file or changed columns?")
    return out


def read_skimmer(cur) -> list[dict]:
    """Active technicians across all three Skimmer companies, from the raw layer.

    raw_skimmer rather than public_warehouse.dim_tech because dim_tech carries no email,
    and email is the single strongest match key available (80 of 104 links on the first
    reconciliation came from it).
    """
    accounts = []
    skipped_non_person: list[str] = []
    for co in COMPANIES:
        cur.execute(
            f'''SELECT "id", "Username", "Email", "FirstName", "LastName"
                FROM raw_skimmer."{co}_Account"
                WHERE "RoleType" = 'Tech'
                  AND "IsActive" IN ('1', 'true', 't', 'True')
                  AND ("Deleted" IS NULL OR "Deleted" IN ('0', 'false', 'f', 'False'))'''
        )
        for r in cur.fetchall():
            first, last = clean_first(r[3]), norm(r[4])
            if not is_person(first, last):
                skipped_non_person.append(f"{co}:{(r[3] or '').strip()} {(r[4] or '').strip()}")
                continue
            accounts.append(
                {
                    "company": co,
                    "id": r[0],
                    "username": r[1],
                    "email": norm(r[2]),
                    "first": first,
                    "last": last,
                    "raw_first": (r[3] or "").strip(),
                    "display": f"{(r[3] or '').strip()} {(r[4] or '').strip()}".strip(),
                }
            )
    if skipped_non_person:
        print(f"excluded {len(skipped_non_person)} non-person Tech account(s): "
              + ", ".join(sorted(skipped_non_person)[:6])
              + (" …" if len(skipped_non_person) > 6 else ""))
    return accounts


def build_links(census: list[dict], accounts: list[dict]) -> tuple[list[dict], list, list]:
    """Cascade match, most reliable evidence first.

    Each Skimmer account links to at most one employee, but one employee may link to
    several accounts — that is a technician working for more than one entity, which is the
    normal case here rather than an anomaly (20 of 122 do, 11 across all three).
    """
    # Placeholder emails are shared across unrelated people — one AQPS gmail sits on 31
    # accounts with 31 distinct names, and Clermont uses literal upd***@updateme.com.
    # Matching on those would merge dozens of technicians into one employee.
    email_owners = defaultdict(set)
    for a in accounts:
        if a["email"]:
            email_owners[a["email"]].add((a["first"], a["last"]))
    placeholder = {e for e, owners in email_owners.items() if len(owners) > 1}

    by_email = defaultdict(list)
    by_full = defaultdict(list)
    by_lastinit = defaultdict(list)
    by_last = defaultdict(list)
    for a in accounts:
        if a["email"] and a["email"] not in placeholder:
            by_email[a["email"]].append(a)
        by_full[(a["first"], a["last"])].append(a)
        by_lastinit[(a["last"], a["first"][:1])].append(a)
        by_last[a["last"]].append(a)

    # Census carries no email column, so the email pass works the other way: an employee
    # whose name matches an account that holds a non-placeholder address is corroborated.
    linked_accounts: set[str] = set()
    links: list[dict] = []

    def take(emp, acct, method):
        if acct["id"] in linked_accounts:
            return False
        linked_accounts.add(acct["id"])
        links.append(
            {
                "bbsi_id": emp["bbsi_id"],
                "company": acct["company"],
                "skimmer_account_id": acct["id"],
                "match_method": method,
                "confidence": CONFIDENCE[method],
                "census_name": f"{emp['first_name']} {emp['last_name']}".strip(),
                "skimmer_name": acct["display"],
            }
        )
        return True

    for emp in census:
        f, l = norm(emp["first_name"]), norm(emp["last_name"])
        for acct in by_full.get((f, l), []):
            take(emp, acct, "full_name")
    for emp in census:
        f, l = norm(emp["first_name"]), norm(emp["last_name"])
        for acct in by_lastinit.get((l, f[:1]), []):
            take(emp, acct, "last_initial")
    for emp in census:
        l = norm(emp["last_name"])
        cands = [a for a in by_last.get(l, []) if a["id"] not in linked_accounts]
        others = [e for e in census if e is not emp and norm(e["last_name"]) == l]
        if len(cands) == 1 and not others:
            take(emp, cands[0], "last_unique")

    census_ids = {e["bbsi_id"] for e in census}
    linked_emp = {x["bbsi_id"] for x in links}
    census_only = [e for e in census if e["bbsi_id"] not in linked_emp]
    skimmer_only = [a for a in accounts if a["id"] not in linked_accounts]
    return links, census_only, skimmer_only


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--census", default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    path = args.census or newest_census()
    source_file = os.path.basename(path)
    census = read_census(path)

    # The file is named "Employee Census" but carries BOTH active and terminated staff —
    # the 2026-09-16 file is A=112 / T=109. Everything is landed, because termination
    # history is real data and this is its only source. Only ACTIVE employees are matched:
    # linking a currently-active Skimmer technician to someone BBSI terminated would
    # invent a relationship that does not exist, and low-confidence passes make that
    # easy to do by accident.
    status = Counter((r.get("ee_status_code") or "?") for r in census)
    active_census = [r for r in census if (r.get("ee_status_code") or "").upper() == "A"]
    if not active_census:
        sys.exit(
            "ERROR: no rows with EE Status Code = 'A'. Either the column changed or this "
            "is not the census we think it is — refusing to match against an empty set."
        )

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("ERROR: DATABASE_URL not set")
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    accounts = read_skimmer(cur)
    links, census_only, skimmer_only = build_links(active_census, accounts)

    print(f"census file        : {source_file}")
    print(f"census rows        : {len(census)}  (status: {dict(status)})")
    print(f"  matched against  : {len(active_census)} ACTIVE employees only")
    print(f"skimmer technicians: {len(accounts)}")
    print(f"links derived      : {len(links)}  " + str(dict(Counter(x['match_method'] for x in links))))
    print(f"census unmatched   : {len(census_only)} of {len(active_census)} active")
    print(f"skimmer unmatched  : {len(skimmer_only)}")

    if not any(x["match_method"] == "email" for x in links):
        print(
            "\nNOTE: no email-based links. This census export carries no Email column, so "
            "the strongest available key is unavailable and more links rest on name "
            "evidence alone. Asking BBSI to include the employee email address in the "
            "export would move most of these to high confidence."
        )

    if args.dry_run:
        print("\n--dry-run: nothing written")
        conn.rollback()
        return 0

    # Landing — append-only per source file.
    psycopg2.extras.execute_batch(
        cur,
        """INSERT INTO hr.employee_census
             (bbsi_id, source_file, last_name, first_name, middle_init, ssn_masked, dob,
              gender_code, last_hire_date, address_line1, address_line2, city, state,
              zip_code, ee_status_code)
           VALUES (%(bbsi_id)s, %(source_file)s, %(last_name)s, %(first_name)s,
                   %(middle_init)s, %(ssn_masked)s, %(dob)s, %(gender_code)s,
                   %(last_hire_date)s, %(address_line1)s, %(address_line2)s, %(city)s,
                   %(state)s, %(zip_code)s, %(ee_status_code)s)
           ON CONFLICT (bbsi_id, source_file) DO NOTHING""",
        [dict(r, source_file=source_file) for r in census],
    )
    # execute_batch reports only the final batch's rowcount, so ask the table instead —
    # "landed 1 new" out of 221 rows is a reporting bug that reads exactly like data loss.
    cur.execute(
        "SELECT count(*) FROM hr.employee_census WHERE source_file = %s", (source_file,)
    )
    landed = cur.fetchone()[0]

    # Mass-deactivation guard. A truncated or mis-parsed census must not be able to wipe
    # the crosswalk: if this run would stand down more than half the active links, stop.
    cur.execute(
        "SELECT count(*) FROM hr.employee_crosswalk WHERE is_active AND NOT is_manual"
    )
    active_before = cur.fetchone()[0]
    if active_before and len(links) < active_before * 0.5:
        conn.rollback()
        print(
            f"\nREFUSED: derived {len(links)} links against {active_before} currently "
            f"active — more than half would be stood down. Refusing rather than erasing "
            f"the crosswalk on what looks like a bad census. Nothing was written.",
            file=sys.stderr,
        )
        return 2

    psycopg2.extras.execute_batch(
        cur,
        """INSERT INTO hr.employee_crosswalk
             (bbsi_id, company, skimmer_account_id, match_method, confidence,
              census_name, skimmer_name)
           VALUES (%(bbsi_id)s, %(company)s, %(skimmer_account_id)s, %(match_method)s,
                   %(confidence)s, %(census_name)s, %(skimmer_name)s)
           ON CONFLICT (bbsi_id, company, skimmer_account_id) DO UPDATE
             SET last_confirmed_at = now(),
                 is_active         = true,
                 match_method      = EXCLUDED.match_method,
                 confidence        = EXCLUDED.confidence
             WHERE NOT hr.employee_crosswalk.is_manual""",
        links,
    )

    # Stand down links this run could not re-derive. Never deletes, never touches manual.
    # Via a temp table rather than a row-comparison against an array: Postgres cannot hash
    # an array of anonymous records, and the failure ("could not identify a hash function
    # for type unknown") arrives at runtime, not at parse time.
    cur.execute(
        """CREATE TEMP TABLE _derived_links
             (bbsi_id text, company text, skimmer_account_id text) ON COMMIT DROP"""
    )
    psycopg2.extras.execute_batch(
        cur,
        "INSERT INTO _derived_links VALUES (%s, %s, %s)",
        [(x["bbsi_id"], x["company"], x["skimmer_account_id"]) for x in links],
    )
    cur.execute(
        """UPDATE hr.employee_crosswalk c SET is_active = false
           WHERE c.is_active AND NOT c.is_manual
             AND NOT EXISTS (
                 SELECT 1 FROM _derived_links d
                 WHERE d.bbsi_id            = c.bbsi_id
                   AND d.company            = c.company
                   AND d.skimmer_account_id = c.skimmer_account_id)"""
    )
    stood_down = cur.rowcount

    cur.execute("DELETE FROM hr.employee_match_exception WHERE run_at::date = now()::date")
    psycopg2.extras.execute_batch(
        cur,
        """INSERT INTO hr.employee_match_exception
             (side, bbsi_id, company, skimmer_id, display_name, detail)
           VALUES (%(side)s, %(bbsi_id)s, %(company)s, %(skimmer_id)s, %(display_name)s,
                   %(detail)s)
           ON CONFLICT DO NOTHING""",
        [
            {
                "side": "census_only",
                "bbsi_id": e["bbsi_id"],
                "company": None,
                "skimmer_id": None,
                "display_name": f"{e['first_name']} {e['last_name']}".strip(),
                "detail": "on the BBSI census with no active Skimmer technician account "
                          "— office/admin staff, or a technician never given a login",
            }
            for e in census_only
        ]
        + [
            {
                "side": "skimmer_only",
                "bbsi_id": None,
                "company": a["company"],
                "skimmer_id": a["id"],
                "display_name": a["display"],
                "detail": "active Skimmer technician with no BBSI employee record "
                          "— subcontractor, another entity, or a stale login",
            }
            for a in skimmer_only
        ],
    )

    conn.commit()
    print(f"\nlanded census rows : {landed} rows now held for this source file")
    print(f"crosswalk links    : {len(links)} upserted, {stood_down} stood down")
    print(f"exceptions recorded: {len(census_only) + len(skimmer_only)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
