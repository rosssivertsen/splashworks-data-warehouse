#!/usr/bin/env bash
# archive-incoming.sh — copy VERIFIED partner uploads out of the SFTP jail into a
# root-owned archive.
#
# WHY THIS EXISTS: `incoming/` is partner-writable by definition — that is the
# whole point of a drop-off. A file sitting there is therefore not yet a backup:
# the partner (or anyone holding that key) can overwrite or delete it, and our
# only copy goes with it. Governance data we were asked to retain has to leave
# the writable surface before it counts as retained.
#
# Only files whose sidecar manifest verifies are archived. An unverified file is
# left in place and reported — we do not quietly preserve bytes we cannot vouch
# for, because a corrupt archive that looks authoritative is worse than none.
#
# Idempotent: a payload already archived with a matching sha256 is skipped, so
# this is safe to run on a schedule. A DIFFERENT payload arriving under a name
# already archived is never overwritten — it lands beside it with a .conflict
# suffix and is reported loudly.
#
# Cron (after the 06:00 publish, before the report reads state):
#   30 6 * * * /opt/splashworks/infrastructure/sftp/archive-incoming.sh >> /opt/splashworks/data/sftp-archive.log 2>&1
set -euo pipefail
shopt -s nullglob

DROPOFF_GLOB="${SFTP_DROPOFF_GLOB:-/srv/sftp/*/incoming}"
ARCHIVE_ROOT="${PARTNER_ARCHIVE_DIR:-/opt/splashworks/data/partner-incoming}"
ts() { date -u +%FT%TZ; }

archived=0; skipped=0; failed=0

for d in $DROPOFF_GLOB; do
    [ -d "$d" ] || continue
    account="$(basename "$(dirname "$d")")"
    dest="${ARCHIVE_ROOT}/${account}"
    install -d -o root -g root -m 750 "$dest"

    for manifest in "$d"/*.manifest.json; do
        # `file` is partner-controlled: force it to a bare basename so a crafted
        # manifest cannot make us read or write outside these two directories.
        payload_name="$(python3 -c '
import json,os,sys
try:
    d=json.load(open(sys.argv[1]))
    f=str(d.get("file","")).strip()
    print(os.path.basename(f) if f and f==os.path.basename(f) and f not in (".","..") else "")
except Exception:
    print("")' "$manifest")"

        if [ -z "$payload_name" ]; then
            echo "$(ts) FAIL ${account}: unusable manifest $(basename "$manifest")" >&2
            failed=$((failed + 1)); continue
        fi

        src="${d}/${payload_name}"
        if [ ! -f "$src" ]; then
            echo "$(ts) FAIL ${account}: ${payload_name} declared by $(basename "$manifest") but absent" >&2
            failed=$((failed + 1)); continue
        fi

        want="$(python3 -c 'import json,sys;print(str(json.load(open(sys.argv[1])).get("sha256","")).lower())' "$manifest")"
        got="$(sha256sum "$src" | cut -d" " -f1)"
        if [ "$want" != "$got" ]; then
            echo "$(ts) FAIL ${account}: ${payload_name} sha256 mismatch — NOT archived" >&2
            failed=$((failed + 1)); continue
        fi

        target="${dest}/${payload_name}"
        if [ -f "$target" ]; then
            if [ "$(sha256sum "$target" | cut -d' ' -f1)" = "$got" ]; then
                skipped=$((skipped + 1)); continue          # already have this exact payload
            fi
            # Same name, different bytes. Never overwrite: the archived copy may
            # be the only surviving record of the earlier version.
            target="${target}.conflict.$(date -u +%Y%m%dT%H%M%SZ)"
            echo "$(ts) WARN ${account}: ${payload_name} differs from the archived copy — saved as $(basename "$target")" >&2
        fi

        install -o root -g root -m 640 "$src" "${target}.part"
        mv -f "${target}.part" "$target"
        install -o root -g root -m 640 "$manifest" "${target%.conflict.*}.manifest.json" 2>/dev/null \
            || install -o root -g root -m 640 "$manifest" "${dest}/$(basename "$manifest")"
        echo "$(ts) archived ${account}/${payload_name} ($(stat -c %s "$target") bytes, sha256 ${got:0:16}…)"
        archived=$((archived + 1))
    done
done

echo "$(ts) done — ${archived} archived, ${skipped} already present, ${failed} failed"
[ "$failed" -eq 0 ]
