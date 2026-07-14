#!/usr/bin/env bash
# publish-extracts-to-sftp.sh — copy the nightly Skimmer extracts into the
# Greenmill SFTP jail with human-readable names + a checksummed manifest.
#
# Runs AFTER the nightly sync (extracts land in $EXTRACT_DIR as CompanyId GUIDs).
# Copies (not symlinks — a symlink would point outside the chroot) into the jail
# as root:root 0644 so the jailed partner has read-only access.
#
# Wire after sync in cron, e.g.:
#   45 1 * * * /opt/splashworks/infrastructure/sftp/publish-extracts-to-sftp.sh >> /opt/splashworks/data/sftp-publish.log 2>&1
set -euo pipefail

SRC="${EXTRACT_DIR:-/opt/splashworks/data/extracts}"
DEST="${SFTP_DATA_DIR:-/srv/sftp/sftp-greenmill/extracts}"

# CompanyId GUID -> friendly name (keep in sync with etl/config.py COMPANY_MAP)
declare -A MAP=(
    [e265c9dee47c47c6a73f689b0df467ca]=AQPS
    [95d37a64d1794a1caef111e801db5477]=JOMO
    [18E63E2C-371C-46B9-BF68-8BBDFDC1008D]=CLERMONT
)

[ -d "$DEST" ] || { echo "ERROR: SFTP data dir missing: $DEST" >&2; exit 1; }

manifest="$(mktemp)"
echo "# Splashworks nightly Skimmer extracts" > "$manifest"
echo "# published: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$manifest"
echo "# file  sha256  bytes  source_mtime_utc" >> "$manifest"

count=0
for guid in "${!MAP[@]}"; do
    name="${MAP[$guid]}"
    src="${SRC}/${guid}.db.gz"
    if [ -f "$src" ]; then
        dst="${DEST}/${name}.db.gz"
        # atomic: copy to temp in same dir, then move into place
        tmp="${dst}.tmp.$$"
        install -o root -g root -m 644 "$src" "$tmp"
        mv -f "$tmp" "$dst"
        sum="$(sha256sum "$dst" | cut -d' ' -f1)"
        size="$(stat -c %s "$dst")"
        mtime="$(date -u -r "$src" +%Y-%m-%dT%H:%M:%SZ)"
        echo "${name}.db.gz  ${sum}  ${size}  ${mtime}" >> "$manifest"
        count=$((count + 1))
    else
        echo "WARN: missing extract for ${name}: ${src}" >&2
    fi
done

install -o root -g root -m 644 "$manifest" "${DEST}/MANIFEST.txt"
rm -f "$manifest"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) published ${count} extract(s) to ${DEST}"
