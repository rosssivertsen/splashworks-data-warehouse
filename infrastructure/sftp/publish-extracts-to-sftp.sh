#!/usr/bin/env bash
# publish-extracts-to-sftp.sh — copy the nightly Skimmer extracts into EVERY
# partner SFTP jail with human-readable names + a checksummed manifest.
#
# Runs AFTER the nightly sync (extracts land in $EXTRACT_DIR as CompanyId GUIDs).
# Publishes to every /srv/sftp/<account>/extracts jail, so adding a partner is
# just `setup-sftp-user.sh <account>` — no change here. Copies (not symlinks — a
# symlink would point outside the chroot) as root:root 0644 = partner read-only.
#
# Cron:
#   0 6 * * * /opt/splashworks/infrastructure/sftp/publish-extracts-to-sftp.sh >> /opt/splashworks/data/sftp-publish.log 2>&1
set -euo pipefail
shopt -s nullglob

SRC="${EXTRACT_DIR:-/opt/splashworks/data/extracts}"
JAIL_GLOB="${SFTP_JAIL_GLOB:-/srv/sftp/*/extracts}"

# CompanyId GUID -> friendly name (keep in sync with etl/config.py COMPANY_MAP)
declare -A MAP=(
    [e265c9dee47c47c6a73f689b0df467ca]=AQPS
    [95d37a64d1794a1caef111e801db5477]=JOMO
    [18E63E2C-371C-46B9-BF68-8BBDFDC1008D]=CLERMONT
)

JAILS=($JAIL_GLOB)
if [ ${#JAILS[@]} -eq 0 ]; then
    echo "$(date -u +%FT%TZ) ERROR: no SFTP jails matched ${JAIL_GLOB}" >&2
    exit 1
fi

# Build the manifest once (checksums are identical for every jail).
manifest="$(mktemp)"
staged=()   # "guid:name" pairs that actually exist
{
    echo "# Splashworks nightly Skimmer extracts"
    echo "# published: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# file  sha256  bytes  source_mtime_utc"
} > "$manifest"

for guid in "${!MAP[@]}"; do
    name="${MAP[$guid]}"
    src="${SRC}/${guid}.db.gz"
    if [ -f "$src" ]; then
        sum="$(sha256sum "$src" | cut -d' ' -f1)"
        size="$(stat -c %s "$src")"
        mtime="$(date -u -r "$src" +%Y-%m-%dT%H:%M:%SZ)"
        echo "${name}.db.gz  ${sum}  ${size}  ${mtime}" >> "$manifest"
        staged+=("${guid}:${name}")
    else
        echo "$(date -u +%FT%TZ) WARN: missing extract for ${name}: ${src}" >&2
    fi
done

published=0
for dest in "${JAILS[@]}"; do
    for pair in "${staged[@]}"; do
        guid="${pair%%:*}"; name="${pair##*:}"
        target="${dest}/${name}.db.gz"
        tmp="${target}.tmp.$$"
        install -o root -g root -m 644 "${SRC}/${guid}.db.gz" "$tmp"
        mv -f "$tmp" "$target"          # atomic swap — partners never see a partial file
    done
    install -o root -g root -m 644 "$manifest" "${dest}/MANIFEST.txt"
    published=$((published + 1))
    echo "$(date -u +%FT%TZ) published ${#staged[@]} extract(s) to ${dest}"
done

rm -f "$manifest"
echo "$(date -u +%FT%TZ) done — ${#staged[@]} extract(s) to ${published} jail(s)"
