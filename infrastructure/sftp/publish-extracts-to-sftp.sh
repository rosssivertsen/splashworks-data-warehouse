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

# ENTITLEMENTS: which companies each SFTP account may receive. FAIL-CLOSED — a jail
# with no entry here gets NOTHING (and says so loudly). Do NOT replace this with a
# glob that publishes everything to every jail: that is correct only while every
# partner happens to be entitled to every company, and silently leaks the day one
# isn't. (Same failure mode as a blanket GRANT — see SECURITY_AUDIT_2026-07-14.)
# Greenmill is the PE/ownership partner, entitled to all entities (confirmed by
# Ross 2026-07-14); `-ci` is the same partner's GitHub Actions pipeline.
declare -A ENTITLEMENTS=(
    [sftp-greenmill]="AQPS JOMO CLERMONT"
    [sftp-greenmill-ci]="AQPS JOMO CLERMONT"
)

JAILS=($JAIL_GLOB)
if [ ${#JAILS[@]} -eq 0 ]; then
    echo "$(date -u +%FT%TZ) ERROR: no SFTP jails matched ${JAIL_GLOB}" >&2
    exit 1
fi

# Checksum each available extract once — identical across jails.
declare -A META    # name -> "sha256 bytes mtime"
for guid in "${!MAP[@]}"; do
    name="${MAP[$guid]}"
    src="${SRC}/${guid}.db.gz"
    if [ -f "$src" ]; then
        META[$name]="$(sha256sum "$src" | cut -d' ' -f1) $(stat -c %s "$src") $(date -u -r "$src" +%Y-%m-%dT%H:%M:%SZ) ${guid}"
    else
        echo "$(date -u +%FT%TZ) WARN: missing extract for ${name}: ${src}" >&2
    fi
done

published=0
for dest in "${JAILS[@]}"; do
    account="$(basename "$(dirname "$dest")")"
    allowed="${ENTITLEMENTS[$account]:-}"
    if [ -z "$allowed" ]; then
        echo "$(date -u +%FT%TZ) SKIP: jail '${account}' has no ENTITLEMENTS entry — publishing nothing (add it deliberately)" >&2
        continue
    fi

    # Per-jail manifest lists ONLY that account's entitled files.
    manifest="$(mktemp)"
    {
        echo "# Splashworks nightly Skimmer extracts"
        echo "# published: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo "# file  sha256  bytes  source_mtime_utc"
    } > "$manifest"

    n=0
    for name in $allowed; do
        meta="${META[$name]:-}"
        [ -n "$meta" ] || { echo "$(date -u +%FT%TZ) WARN: ${account} entitled to ${name} but no extract present" >&2; continue; }
        read -r sum size mtime guid <<< "$meta"
        target="${dest}/${name}.db.gz"
        tmp="${target}.tmp.$$"
        install -o root -g root -m 644 "${SRC}/${guid}.db.gz" "$tmp"
        mv -f "$tmp" "$target"          # atomic swap — partners never see a partial file
        echo "${name}.db.gz  ${sum}  ${size}  ${mtime}" >> "$manifest"
        n=$((n + 1))
    done

    install -o root -g root -m 644 "$manifest" "${dest}/MANIFEST.txt"
    rm -f "$manifest"

    # Remove any extract in this jail the account is no longer entitled to.
    for f in "${dest}"/*.db.gz; do
        fname="$(basename "$f" .db.gz)"
        case " $allowed " in
            *" $fname "*) ;;
            *) rm -f "$f"; echo "$(date -u +%FT%TZ) removed ${fname}.db.gz from ${account} (not entitled)" >&2 ;;
        esac
    done

    published=$((published + 1))
    echo "$(date -u +%FT%TZ) published ${n} extract(s) to ${dest} [entitled: ${allowed}]"
done

echo "$(date -u +%FT%TZ) done — ${published} jail(s)"
