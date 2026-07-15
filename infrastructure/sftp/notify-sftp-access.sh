#!/usr/bin/env bash
# notify-sftp-access.sh — Slack alert on each new SFTP login (Greenmill et al.).
#
# SFTP/SSH logins are logged by sshd to the systemd journal ("Accepted publickey
# for sftp-<partner> from <ip>"). This scans for new such events since the last
# run (timestamp-windowed so each login is reported exactly once) and posts to
# Slack. Runs from cron every 5 min — near-real-time, no long-running service and
# NO sshd config change (login events are always logged, independent of transfer
# logging). Matches any `sftp-*` account so future partners are covered.
#
# Cron:
#   */5 * * * * /opt/splashworks/infrastructure/sftp/notify-sftp-access.sh >> /opt/splashworks/data/sftp-notify.log 2>&1
set -euo pipefail

STATE_DIR="/var/lib/sftp-notify"
LAST_FILE="$STATE_DIR/last_until"
WEBHOOK_FILE="/root/.slack_webhook"
USER_PREFIX="sftp-"          # match sftp-greenmill and any future sftp-* account

mkdir -p "$STATE_DIR"
[ -f "$WEBHOOK_FILE" ] || { echo "$(date -u +%FT%TZ) no slack webhook; skipping"; exit 0; }
WEBHOOK="$(cat "$WEBHOOK_FILE")"

NOW="$(date -u '+%Y-%m-%d %H:%M:%S')"
# First run: only look back 5 min (don't flood with history).
SINCE="$(cat "$LAST_FILE" 2>/dev/null || date -u -d '5 minutes ago' '+%Y-%m-%d %H:%M:%S')"

# New sshd journal lines in [SINCE, NOW).
NEW="$(journalctl _COMM=sshd --since "$SINCE" --until "$NOW" -o short-iso --no-pager 2>/dev/null || true)"
echo "$NOW" > "$LAST_FILE"

# Login lines for any sftp-* account.
LOGINS="$(printf '%s\n' "$NEW" | grep -E "Accepted (publickey|password) for ${USER_PREFIX}" || true)"
[ -n "$LOGINS" ] || exit 0

post() {  # $1 = plain text (no double-quotes/backslashes)
    curl -s -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$1\"}" "$WEBHOOK" >/dev/null 2>&1 || \
        echo "$(date -u +%FT%TZ) WARN: slack post failed"
}

while IFS= read -r line; do
    [ -n "$line" ] || continue
    ts="$(printf '%s' "$line" | awk '{print $1}')"
    user="$(printf '%s' "$line" | grep -oE "for ${USER_PREFIX}[a-z0-9_-]+" | awk '{print $2}')"
    ip="$(printf '%s' "$line" | grep -oE 'from [0-9a-fA-F:.]+' | awk '{print $2}')"
    post ":inbound_ping: *SFTP access* — \`${user}\` logged in from \`${ip:-unknown}\` at ${ts}. (Pulls customer extracts from the jail.)"
    echo "$(date -u +%FT%TZ) notified: ${user} from ${ip}"
done <<< "$LOGINS"
