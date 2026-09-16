#!/usr/bin/env bash
# publish-restricted-to-sftp.sh — republish files we received in a RESTRICTED partner
# drop-off onward to another partner who is entitled to them.
#
# WHY THIS EXISTS RATHER THAN `cp`:
#   Copying a file into a partner's extracts/ by hand works exactly once and then rots.
#   It bypasses the fail-closed entitlement check that stops a partner receiving data
#   nobody authorised; it leaves no manifest, so the recipient cannot tell a complete
#   file from a truncated one; and nothing ever removes it, so a one-off share becomes a
#   permanent publication. Those three properties are the difference between sharing a
#   file and standing up a data feed. This script makes it a feed, deliberately.
#
# WHAT IT PUBLISHES:
#   Files already captured in the restricted archive (archive-restricted.sh, IN-22) —
#   i.e. files whose arrival we have verified and receipted. It never reads from the
#   partner-writable jail directly, so a partner cannot cause a publication by uploading.
#
# SENSITIVITY (recorded 2026-09-16, Ross's decision):
#   The BBSI census carries SSN **masked to last-4** (`###-##-9999`), but FULL date of
#   birth, FULL home address and gender code. That is ordinary employee PII. It is
#   published to Greenmill because they are the ownership partner and Ross authorised it.
#   It is NOT a candidate for any wider distribution, and the entitlement map below is the
#   control that keeps it that way. Do not replace it with a glob.
#
# Cron — 20 minutes past, after archive-restricted.sh has settled and receipted:
#   37 * * * * /opt/splashworks/infrastructure/sftp/publish-restricted-to-sftp.sh >> /opt/splashworks/data/restricted-publish.log 2>&1
set -euo pipefail
shopt -s nullglob

RESTRICTED_ROOT="${RESTRICTED_ARCHIVE_DIR:-/opt/splashworks/data/restricted}"
JAIL_ROOT="${SFTP_JAIL_ROOT:-/srv/sftp}"
PUBLISH_SUB="${PUBLISH_SUB:-extracts}"
MANIFEST_NAME="RESTRICTED_MANIFEST.txt"

# ENTITLEMENTS: "<recipient account>|<source restricted account>" pairs.
# FAIL-CLOSED — an account absent from this list receives nothing, and says so. Adding a
# line here is a deliberate authorisation to send one partner's data to another, which is
# a decision with a data-sharing basis behind it, not a convenience.
#   sftp-greenmill-ci <- sftp-bbsi : Greenmill is the PE/ownership partner and ingests the
#                                    employee census into their own warehouse. Authorised
#                                    by Ross 2026-09-16.
ENTITLEMENTS=(
    "sftp-greenmill-ci|sftp-bbsi"
)

# COLUMN PROJECTION — deny by default.
#
# Ross and Sam agreed 2026-09-16 that Greenmill receives only employee NAME and LABOR
# RATE; SSN fragments, DOB, gender, home address, phone and email are expunged. BBSI were
# asked to change the export at source, which is the right fix — but a promise upstream is
# not a control downstream. This allowlist enforces the same limit at our boundary, so a
# regression in BBSI's export, a column appearing silently, or a different report landing
# in the drop-off cannot widen what Greenmill receives.
#
# Deny-by-default matters here. An allowlist that misses a column publishes less than
# intended and someone complains; a denylist that misses a column publishes PII and nobody
# notices. Only the first failure is recoverable.
#
# Fail-closed: a CSV projecting to zero columns or zero rows is NOT published and the run
# reports a failure — an empty file would look like a successful delivery.
PROJECT_COLUMNS="${PROJECT_COLUMNS:-^(employee[ _-]*(last|first)[ _-]*name|employee[ _-]*middle[ _-]*init(ial)?|(labor|pay|hourly|bill)[ _-]*rate|rate)$}"

ts() { date -u +%FT%TZ; }
published=0; skipped=0; failed=0

for pair in "${ENTITLEMENTS[@]}"; do
    recipient="${pair%%|*}"
    source_acct="${pair##*|}"

    src_dir="${RESTRICTED_ROOT}/${source_acct}"
    dest="${JAIL_ROOT}/${recipient}/${PUBLISH_SUB}"

    if [ ! -d "$src_dir" ]; then
        echo "$(ts) SKIP ${recipient}: no restricted archive at ${src_dir} — nothing captured yet"
        continue
    fi
    if [ ! -d "$dest" ]; then
        echo "$(ts) FAIL ${recipient}: publish dir ${dest} does not exist" >&2
        failed=$((failed + 1)); continue
    fi

    manifest="$(mktemp)"
    {
        echo "# Splashworks — restricted partner data republished from ${source_acct}"
        echo "# published: $(ts)"
        echo "# Files carry employee PII. Handle under your own data-protection controls."
        echo "# Column-projected: name and labor rate only. Identifying fields are"
        echo "# removed at our boundary before publication (agreed Ross/Sam 2026-09-16)."
        echo "# file  sha256  bytes  received_utc  verified"
    } > "$manifest"

    n=0
    for receipt in "$src_dir"/*.receipt.json; do
        # The receipt is the authority: it names the stored file and proves what we hold.
        # Reading it rather than globbing the directory means we never publish something
        # that arrived but was never captured and checked.
        stored="$(python3 -c '
import json,os,sys
try:
    d=json.load(open(sys.argv[1]))
    f=str(d.get("stored_as","")).strip()
    print(os.path.basename(f) if f and f==os.path.basename(f) and f not in (".","..") else "")
except Exception:
    print("")' "$receipt")"
        [ -n "$stored" ] || { echo "$(ts) FAIL ${recipient}: unusable receipt $(basename "$receipt")" >&2; failed=$((failed+1)); continue; }

        srcf="${src_dir}/${stored}"
        [ -f "$srcf" ] || { echo "$(ts) FAIL ${recipient}: ${stored} named by receipt but absent" >&2; failed=$((failed+1)); continue; }

        # Encrypted copies are not republished — the recipient has no key, and shipping a
        # blob they cannot open is worse than shipping nothing.
        case "$stored" in *.gpg) echo "$(ts) SKIP ${recipient}: ${stored} is encrypted at rest — not republished"; continue ;; esac

        sum="$(sha256sum "$srcf" | cut -d' ' -f1)"
        bytes="$(stat -c %s "$srcf")"
        recv="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("source_mtime_utc",""))' "$receipt")"
        ver="$(python3 -c 'import json,sys;print(str(json.load(open(sys.argv[1])).get("verified",False)).lower())' "$receipt")"

        # Build what we will actually hand over. For a CSV that means projecting to the
        # allowed columns FIRST, so the published artifact never contains a field the
        # recipient is not entitled to — not even momentarily on disk.
        payload="$srcf"; projected=""
        case "$stored" in
          *.csv|*.CSV)
            payload="$(mktemp)"
            if ! python3 - "$srcf" "$payload" "$PROJECT_COLUMNS" <<'PYEOF'
import csv, re, sys
src, out, pattern = sys.argv[1], sys.argv[2], sys.argv[3]
rx = re.compile(pattern, re.I)
with open(src, newline="", encoding="utf-8-sig") as fh:
    rd = csv.DictReader(fh)
    cols = [c for c in (rd.fieldnames or []) if rx.match((c or "").strip())]
    if not cols:
        print("no columns survived the allowlist", file=sys.stderr); sys.exit(3)
    rows = list(rd)
if not rows:
    print("source had zero data rows", file=sys.stderr); sys.exit(4)
with open(out, "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow({c: r.get(c, "") for c in cols})
print(",".join(cols))
PYEOF
            then
                echo "$(ts) FAIL ${recipient}: ${stored} — column projection refused (nothing publishable after the allowlist). NOT published." >&2
                rm -f "$payload"; failed=$((failed + 1)); continue
            fi
            projected="$(python3 - "$srcf" "$payload" "$PROJECT_COLUMNS" <<'PYEOF'
import csv, re, sys
rx = re.compile(sys.argv[3], re.I)
with open(sys.argv[1], newline="", encoding="utf-8-sig") as fh:
    fn = csv.DictReader(fh).fieldnames or []
kept = [c for c in fn if rx.match((c or "").strip())]
print(f"{len(kept)} of {len(fn)} columns: " + ", ".join(kept))
PYEOF
)"
            sum="$(sha256sum "$payload" | cut -d' ' -f1)"
            bytes="$(stat -c %s "$payload")"
            echo "$(ts) projected ${stored} -> ${projected}"
            ;;
        esac

        target="${dest}/${stored}"
        if [ -f "$target" ] && [ "$(sha256sum "$target" | cut -d' ' -f1)" = "$sum" ]; then
            skipped=$((skipped + 1))
        else
            install -o root -g root -m 644 "$payload" "${target}.part"
            mv -f "${target}.part" "$target"     # atomic — the partner never sees a partial file
            echo "$(ts) published ${recipient}/${stored} (${bytes} bytes, sha256 ${sum:0:16}…, verified=${ver}${projected:+, PROJECTED})"
            published=$((published + 1))
        fi
        [ "$payload" = "$srcf" ] || rm -f "$payload"
        printf '%s  %s  %s  %s  %s\n' "$stored" "$sum" "$bytes" "$recv" "$ver" >> "$manifest"
        n=$((n + 1))
    done

    install -o root -g root -m 644 "$manifest" "${dest}/${MANIFEST_NAME}"
    rm -f "$manifest"

    # Withdraw anything we previously published that the restricted archive no longer
    # holds — retention there must propagate here, or expiring a record locally would
    # leave the partner's copy as the surviving one. ONLY files this script published
    # (named in the current or prior manifest set) are eligible; never touch the nightly
    # Skimmer extracts or anything the partner put there.
    for f in "$dest"/*; do
        [ -f "$f" ] || continue
        b="$(basename "$f")"
        case "$b" in "$MANIFEST_NAME"|MANIFEST.txt|*.db.gz) continue ;; esac
        if [ ! -f "${src_dir}/${b}" ]; then
            rm -f -- "$f"
            echo "$(ts) withdrew ${recipient}/${b} — no longer in the restricted archive" >&2
        fi
    done

    echo "$(ts) ${recipient}: ${n} file(s) listed in ${MANIFEST_NAME} from ${source_acct}"
done

echo "$(ts) done — ${published} published, ${skipped} already current, ${failed} failed"
[ "$failed" -eq 0 ]
