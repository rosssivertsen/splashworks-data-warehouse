#!/usr/bin/env bash
# notify-sftp-access.sh — Slack alert on SFTP logins AND file transfers.
#
# Two classes of event, both scanned from the systemd journal since the last run
# (timestamp-windowed so each event is reported exactly once):
#
#   1. LOGINS      — sshd "Accepted publickey for sftp-<partner> from <ip>".
#                    Always logged, independent of any sshd setting.
#   2. TRANSFERS   — internal-sftp open/close/remove records. These require
#                    `ForceCommand internal-sftp -l INFO` in the sshd Match block
#                    (set by setup-sftp-user.sh). WITHOUT -l INFO this section
#                    silently finds nothing and only logins are reported.
#
# Uploads into a partner's drop-off dir are reported individually and loudly —
# that is the write-confirmation this exists for. Downloads are summarised per
# run to avoid flooding (4 extracts x2/day/partner).
#
# Cron:
#   */5 * * * * /opt/splashworks/infrastructure/sftp/notify-sftp-access.sh >> /opt/splashworks/data/sftp-notify.log 2>&1
set -euo pipefail

STATE_DIR="/var/lib/sftp-notify"
LAST_FILE="$STATE_DIR/last_until"
DISK_STATE="$STATE_DIR/last_disk_warn"
WEBHOOK_FILE="/root/.slack_webhook"
USER_PREFIX="sftp-"                       # matches any sftp-* account
SFTP_ROOT="/srv/sftp"
DROPOFF_WARN_MB="${DROPOFF_WARN_MB:-2048}"   # alert if a drop-off exceeds this
DISK_WARN_PCT="${DISK_WARN_PCT:-85}"         # alert if / crosses this

mkdir -p "$STATE_DIR"
[ -f "$WEBHOOK_FILE" ] || { echo "$(date -u +%FT%TZ) no slack webhook; skipping"; exit 0; }
WEBHOOK="$(cat "$WEBHOOK_FILE")"

NOW="$(date -u '+%Y-%m-%d %H:%M:%S')"
SINCE="$(cat "$LAST_FILE" 2>/dev/null || date -u -d '5 minutes ago' '+%Y-%m-%d %H:%M:%S')"

# sshd and internal-sftp log under different syslog identifiers — match both.
NEW="$(journalctl -t sshd -t internal-sftp --since "$SINCE" --until "$NOW" \
        -o short-iso --no-pager 2>/dev/null || true)"

# JSON-safe: partner-supplied filenames reach Slack, so strip quotes/backslashes
# and control characters rather than trusting them into the payload.
san() { printf '%s' "$1" | tr -d '"\\' | tr -c '[:print:]' ' ' | cut -c1-300; }

post() {  # $1 = plain text
    curl -s -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$(san "$1")\"}" "$WEBHOOK" >/dev/null 2>&1 || \
        echo "$(date -u +%FT%TZ) WARN: slack post failed"
}

human() {  # $1 = bytes
    awk -v b="$1" 'BEGIN{
        split("B KB MB GB TB",u," "); i=1
        while (b>=1024 && i<5) { b/=1024; i++ }
        printf (i==1 ? "%d %s" : "%.1f %s"), b, u[i]
    }'
}

# ---------------------------------------------------------------- 1. logins
LOGINS="$(printf '%s\n' "$NEW" | grep -E "Accepted (publickey|password) for ${USER_PREFIX}" || true)"
if [ -n "$LOGINS" ]; then
    while IFS= read -r line; do
        [ -n "$line" ] || continue
        ts="$(printf '%s' "$line" | awk '{print $1}')"
        user="$(printf '%s' "$line" | grep -oE "for ${USER_PREFIX}[a-z0-9_.-]+" | awk '{print $2}')"
        ip="$(printf '%s' "$line" | grep -oE 'from [0-9a-fA-F:.]+' | awk '{print $2}')"
        post ":inbound_ping: *SFTP login* - \`${user}\` from \`${ip:-unknown}\` at ${ts}"
        echo "$(date -u +%FT%TZ) notified: ${user} from ${ip}"
    done <<< "$LOGINS"
fi

# ------------------------------------------------------------- 2. transfers
# Map internal-sftp pid -> username from its own session-open line, so a
# transfer can be attributed. Degrades to "unknown" rather than failing.
declare -A PIDUSER=()
while IFS= read -r line; do
    [ -n "$line" ] || continue
    p="$(printf '%s' "$line" | grep -oE 'internal-sftp\[[0-9]+\]' | grep -oE '[0-9]+' || true)"
    u="$(printf '%s' "$line" | grep -oE "local user ${USER_PREFIX}[a-z0-9_.-]+" | awk '{print $3}' || true)"
    [ -n "$p" ] && [ -n "$u" ] && PIDUSER["$p"]="$u"
done <<< "$(printf '%s\n' "$NEW" | grep -E 'internal-sftp\[[0-9]+\].*session opened for local user' || true)"

whois_pid() { local p="$1"; printf '%s' "${PIDUSER[$p]:-unknown}"; }

dl_count=0; dl_bytes=0
while IFS= read -r line; do
    [ -n "$line" ] || continue
    pid="$(printf '%s' "$line" | grep -oE 'internal-sftp\[[0-9]+\]' | grep -oE '[0-9]+' || true)"
    path="$(printf '%s' "$line" | sed -nE 's/.*close "([^"]*)".*/\1/p')"
    wrote="$(printf '%s' "$line" | sed -nE 's/.*written ([0-9]+).*/\1/p')"
    read_b="$(printf '%s' "$line" | sed -nE 's/.*bytes read ([0-9]+).*/\1/p')"
    [ -n "$path" ] || continue
    user="$(whois_pid "${pid:-0}")"

    if [ "${wrote:-0}" -gt 0 ]; then
        # WRITE CONFIRMED — a file landed in the jail. This is the audit event.
        post ":inbox_tray: *SFTP UPLOAD CONFIRMED* - \`${user}\` wrote \`${path}\` ($(human "${wrote}")) into the jail"
        echo "$(date -u +%FT%TZ) UPLOAD: ${user} ${path} ${wrote} bytes"
    elif [ "${read_b:-0}" -gt 0 ]; then
        dl_count=$((dl_count + 1)); dl_bytes=$((dl_bytes + read_b))
    fi
done <<< "$(printf '%s\n' "$NEW" | grep -E 'internal-sftp\[[0-9]+\]: close ' || true)"

if [ "$dl_count" -gt 0 ]; then
    post ":outbox_tray: *SFTP download* - ${dl_count} file(s), $(human "$dl_bytes") pulled from the extract jail(s)"
    echo "$(date -u +%FT%TZ) DOWNLOAD: ${dl_count} files ${dl_bytes} bytes"
fi

# deletes (partners prune their own drop-off retention)
while IFS= read -r line; do
    [ -n "$line" ] || continue
    pid="$(printf '%s' "$line" | grep -oE 'internal-sftp\[[0-9]+\]' | grep -oE '[0-9]+' || true)"
    path="$(printf '%s' "$line" | sed -nE 's/.*remove name "([^"]*)".*/\1/p')"
    [ -n "$path" ] || continue
    post ":wastebasket: *SFTP delete* - \`$(whois_pid "${pid:-0}")\` removed \`${path}\`"
    echo "$(date -u +%FT%TZ) DELETE: ${path}"
done <<< "$(printf '%s\n' "$NEW" | grep -E 'internal-sftp\[[0-9]+\]: remove name ' || true)"

# ------------------------------------------------------- 3. disk/size guard
# /srv shares the root filesystem with Postgres here, so an unbounded writer is
# an availability risk. Alert only — never auto-delete partner data (that needs
# explicit approval). State-tracked so this fires once per day, not every 5 min.
TODAY="$(date -u +%F)"
if [ "$(cat "$DISK_STATE" 2>/dev/null || echo none)" != "$TODAY" ]; then
    warned=0
    pct="$(df --output=pcent / 2>/dev/null | tail -1 | tr -dc '0-9')"
    if [ -n "$pct" ] && [ "$pct" -ge "$DISK_WARN_PCT" ]; then
        post ":rotating_light: *Disk* - root filesystem at ${pct}% on $(hostname). Postgres shares this volume."
        warned=1
    fi
    for d in "$SFTP_ROOT"/*/; do
        [ -d "$d" ] || continue
        for sub in "$d"*/; do
            [ -d "$sub" ] || continue
            case "$sub" in *extracts/) continue;; esac    # we publish those
            mb="$(du -sm "$sub" 2>/dev/null | awk '{print $1}')"
            if [ -n "$mb" ] && [ "$mb" -ge "$DROPOFF_WARN_MB" ]; then
                post ":warning: *SFTP drop-off large* - ${sub} is ${mb} MB (threshold ${DROPOFF_WARN_MB} MB). Check partner retention/pruning."
                warned=1
            fi
        done
    done
    [ "$warned" -eq 1 ] && echo "$TODAY" > "$DISK_STATE"
fi

# Window advances only after successful processing — a mid-run failure retries
# the window next tick rather than silently dropping audit events.
echo "$NOW" > "$LAST_FILE"
