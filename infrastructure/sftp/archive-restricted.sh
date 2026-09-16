#!/usr/bin/env bash
# archive-restricted.sh — copy PII-bearing partner uploads out of the SFTP jail into a
# RESTRICTED archive with tighter permissions and its own retention clock.  (IN-22)
#
# WHY A SECOND SCRIPT INSTEAD OF REUSING archive-incoming.sh:
#   archive-incoming.sh only copies a payload whose sidecar `*.manifest.json` VERIFIES.
#   BBSI sends no manifests. Pointing that script at a new directory would therefore
#   archive NOTHING and exit 0 — a success report for a job that did nothing, which is
#   the worst possible failure shape for a backup. This script carries its own
#   completion test instead, and says out loud which one it used.
#
# WHY IT EXISTS AT ALL:
#   `ARCHIVE_EXCLUDE=sftp-bbsi` (archive-incoming.sh) correctly keeps payroll/HR PII out
#   of the general-purpose partner archive that other tooling reads. The side effect is
#   that BBSI's uploads have NO durable copy anywhere: they live only in
#   /srv/sftp/sftp-bbsi/incoming, which the partner can overwrite or delete. A writable
#   location is not a backup. This closes that gap without putting PII in the shared pile.
#
# THE TRANSACTION BOUNDARY PROBLEM:
#   SFTP has no atomic completion signal — a file still uploading is indistinguishable
#   from a finished one. Greenmill solves this by uploading a manifest LAST. BBSI sends
#   nothing, so we fall back to a heuristic: the file must be SETTLE_MIN minutes old AND
#   its size must be unchanged across two reads. That is weaker than a checksum and is
#   labelled as such in every receipt. If BBSI ever supplies `<file>.sha256`, this script
#   uses it automatically and the receipt upgrades to verified=true with no code change.
#
# NEVER DELETES FROM THE DROP-OFF. It copies. The partner's working set is theirs.
#
# Cron — hourly, offset from the 00:30 shared archive so the two never interleave:
#   17 * * * * /opt/splashworks/infrastructure/sftp/archive-restricted.sh >> /opt/splashworks/data/restricted-archive.log 2>&1
set -euo pipefail
shopt -s nullglob

DROPOFF_ROOT="${SFTP_DROPOFF_ROOT:-/srv/sftp}"
RESTRICTED_ROOT="${RESTRICTED_ARCHIVE_DIR:-/opt/splashworks/data/restricted}"

# Accounts whose uploads are PII-bearing and must land HERE rather than in the shared
# partner archive. Must stay in sync with ARCHIVE_EXCLUDE in archive-incoming.sh — an
# account in neither list gets archived nowhere, and an account in both gets archived
# only here, which is the intent.
RESTRICTED_ACCOUNTS="${RESTRICTED_ACCOUNTS:-sftp-bbsi}"

# A file must be at least this old, and stable, before we believe the upload finished.
SETTLE_MIN="${SETTLE_MIN:-10}"

# Retention. DELETION IS OFF BY DEFAULT — holding payroll PII for a fixed window is a
# policy decision, and an automated destructive action needs explicit sign-off. With
# RETENTION_MODE=report the script only names what it WOULD remove.
RETENTION_DAYS="${RETENTION_DAYS:-90}"
RETENTION_MODE="${RETENTION_MODE:-report}"     # report | delete

# Optional encryption at rest. Set to a gpg recipient whose PRIVATE key is NOT on this
# box (keep it in Bitwarden). Unset = plaintext at 0600, and the log says so every run —
# a key stored beside the data it protects is decoration, not a control.
GPG_RECIPIENT="${RESTRICTED_GPG_RECIPIENT:-}"

ts() { date -u +%FT%TZ; }
archived=0; skipped=0; waiting=0; failed=0; expired=0

install -d -o root -g root -m 700 "$RESTRICTED_ROOT"

for account in $RESTRICTED_ACCOUNTS; do
    src_dir="${DROPOFF_ROOT}/${account}/incoming"
    if [ ! -d "$src_dir" ]; then
        echo "$(ts) FAIL ${account}: no drop-off at ${src_dir}" >&2
        failed=$((failed + 1)); continue
    fi
    dest="${RESTRICTED_ROOT}/${account}"
    install -d -o root -g root -m 700 "$dest"

    for src in "$src_dir"/*; do
        [ -f "$src" ] || continue
        name="$(basename "$src")"

        # Sidecars are metadata, not payloads — never archived in their own right.
        case "$name" in
            *.sha256|*.sha512|*.md5|*.manifest.json|MANIFEST.txt|MANIFEST.TXT) continue ;;
        esac

        got="$(sha256sum "$src" | cut -d' ' -f1)"

        # --- completion test -------------------------------------------------------
        # Prefer a real checksum if the partner supplied one; fall back to settle-time.
        verified=false; method="settle-time"
        sidecar=""
        for ext in .sha256 .sha512 .md5; do
            [ -f "${src}${ext}" ] && sidecar="${src}${ext}" && break
        done

        if [ -n "$sidecar" ]; then
            want="$(tr -d '\r' < "$sidecar" | head -1 | awk '{print $1}' | tr 'A-Z' 'a-z')"
            case "$sidecar" in
                *.sha256) mine="$got" ;;
                *.sha512) mine="$(sha512sum "$src" | cut -d' ' -f1)" ;;
                *.md5)    mine="$(md5sum    "$src" | cut -d' ' -f1)" ;;
            esac
            if [ "$want" != "$mine" ]; then
                # Loud and fatal for this file. A checksum that disagrees is a corrupt
                # transfer or a truncated upload — archiving it would preserve damage
                # under a name that implies fidelity.
                echo "$(ts) FAIL ${account}: ${name} checksum MISMATCH vs $(basename "$sidecar") — NOT archived" >&2
                failed=$((failed + 1)); continue
            fi
            verified=true; method="$(basename "$sidecar")"
        else
            # No sidecar: require age + stability. Two reads a second apart catch a
            # transfer in progress that happens to be older than SETTLE_MIN.
            age_min=$(( ( $(date +%s) - $(stat -c %Y "$src") ) / 60 ))
            if [ "$age_min" -lt "$SETTLE_MIN" ]; then
                echo "$(ts) WAIT ${account}: ${name} is ${age_min}m old (< ${SETTLE_MIN}m) — may still be uploading"
                waiting=$((waiting + 1)); continue
            fi
            size1="$(stat -c %s "$src")"; sleep 1; size2="$(stat -c %s "$src")"
            if [ "$size1" != "$size2" ]; then
                echo "$(ts) WAIT ${account}: ${name} size changed ${size1}->${size2} — upload in progress"
                waiting=$((waiting + 1)); continue
            fi
        fi

        # --- idempotency: do we already hold these BYTES, under any name? ------------
        # Deliberately content-addressed and name-blind. An earlier version filtered by
        # `find -name "$name"`, which silently failed on this partner's real filenames:
        # `Employee Census [920070] ....csv` contains square brackets, and -name takes a
        # GLOB, so [920070] was read as a character class and never matched the literal
        # file. Every run then re-archived it as a fresh .conflict copy. Hashing the
        # directory avoids the entire class of quoting bug and is a truer test anyway —
        # "already held" should mean the same bytes, not the same name.
        if find "$dest" -maxdepth 1 -type f ! -name '*.receipt.json' -print0 2>/dev/null \
             | xargs -0 -r sha256sum 2>/dev/null | cut -d' ' -f1 | grep -qx "$got"; then
            skipped=$((skipped + 1)); continue
        fi
        # An encrypted copy can't be compared by content hash — trust the receipt instead.
        if [ -n "$GPG_RECIPIENT" ] && [ -f "${dest}/${name}.receipt.json" ] \
           && grep -q "\"sha256\": \"${got}\"" "${dest}/${name}.receipt.json" 2>/dev/null; then
            skipped=$((skipped + 1)); continue
        fi

        target="${dest}/${name}"
        if [ -e "$target" ] || [ -e "${target}.gpg" ]; then
            # Same name, different bytes. Never overwrite — the stored copy may be the
            # only surviving record of the earlier version.
            target="${target}.conflict.$(date -u +%Y%m%dT%H%M%SZ)"
            echo "$(ts) WARN ${account}: ${name} differs from the stored copy — saved as $(basename "$target")" >&2
        fi

        if [ -n "$GPG_RECIPIENT" ]; then
            gpg --batch --yes --trust-model always --recipient "$GPG_RECIPIENT" \
                --output "${target}.gpg.part" --encrypt "$src"
            mv -f "${target}.gpg.part" "${target}.gpg"
            chown root:root "${target}.gpg"; chmod 600 "${target}.gpg"
            stored="$(basename "${target}.gpg")"
        else
            install -o root -g root -m 600 "$src" "${target}.part"
            mv -f "${target}.part" "$target"
            stored="$(basename "$target")"
        fi

        # Receipt: what we hold, how we know it is intact, and how confident we are.
        # `verified:false` is the honest state for a settle-time copy and is what makes
        # the case for asking BBSI to send a .sha256.
        cat > "${dest}/${name}.receipt.json" <<JSON
{
  "source_file": $(printf '%s' "$name" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'),
  "stored_as": $(printf '%s' "$stored" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'),
  "sha256": "${got}",
  "bytes": $(stat -c %s "$src"),
  "source_mtime_utc": "$(date -u -r "$src" +%Y-%m-%dT%H:%M:%SZ)",
  "archived_at_utc": "$(ts)",
  "verified": ${verified},
  "verification_method": "${method}",
  "encrypted": $( [ -n "$GPG_RECIPIENT" ] && echo true || echo false )
}
JSON
        chown root:root "${dest}/${name}.receipt.json"; chmod 600 "${dest}/${name}.receipt.json"

        echo "$(ts) archived ${account}/${name} ($(stat -c %s "$src") bytes, sha256 ${got:0:16}…, verified=${verified} via ${method})"
        archived=$((archived + 1))
    done

    # --- retention -------------------------------------------------------------------
    while IFS= read -r -d '' old; do
        if [ "$RETENTION_MODE" = "delete" ]; then
            rm -f -- "$old" "${old%.gpg}.receipt.json"
            echo "$(ts) EXPIRED ${account}: removed $(basename "$old") (> ${RETENTION_DAYS}d)"
        else
            echo "$(ts) RETENTION ${account}: $(basename "$old") is older than ${RETENTION_DAYS}d — would delete (RETENTION_MODE=delete to arm)"
        fi
        expired=$((expired + 1))
    done < <(find "$dest" -type f ! -name '*.receipt.json' -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null)
done

[ -n "$GPG_RECIPIENT" ] || echo "$(ts) NOTE: stored UNENCRYPTED at 0600 (set RESTRICTED_GPG_RECIPIENT to encrypt; keep the private key off this box)"

echo "$(ts) done — ${archived} archived, ${skipped} already held, ${waiting} not yet settled, ${expired} past retention, ${failed} failed"
[ "$failed" -eq 0 ]
