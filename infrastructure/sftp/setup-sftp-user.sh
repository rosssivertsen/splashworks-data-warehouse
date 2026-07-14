#!/usr/bin/env bash
# setup-sftp-user.sh — create a hardened, chrooted, SFTP-only account for an
# external partner to PULL the nightly Skimmer extracts. Idempotent.
#
# Design (SECURITY_AUDIT_2026-07-14 follow-on; Greenmill file-transfer):
#   - Dedicated system user, NO shell (/usr/sbin/nologin), password LOCKED,
#     key-based auth only, primary group `sftponly`.
#   - ChrootDirectory jail owned root:root 0755 (OpenSSH requires the jail and
#     all parents to be root-owned + non-writable). The partner is dropped into
#     the jail and cannot traverse out, get a shell, or reach the DB socket.
#   - Read-only `extracts/` subdir where the pipeline publishes files. Partner
#     has read only (no write) — tighter than a normal upload jail.
#   - authorized_keys kept OUTSIDE the jail (/etc/ssh/sftp-keys/%u, root-owned)
#     so the partner can never modify their own key set.
#   - sshd Match block appended to the END of the main config (Match must follow
#     all global directives; Ubuntu's Include sits at the top, so a drop-in would
#     wrongly capture globals). Reload is gated on `sshd -t`.
#
# Does NOT enable ufw — that's a shared-box change (jomo-inventory also serves
# 80/443 here) and needs the partner's source IPs; handled separately.
#
# Usage (run as root on the target box):
#   ./setup-sftp-user.sh [USERNAME] [PUBKEY_FILE]
#   USERNAME    default: sftp-greenmill
#   PUBKEY_FILE optional path to the partner's SSH public key; if omitted the
#               account is created inert (key file empty) until the key arrives.
set -euo pipefail

PARTNER_USER="${1:-sftp-greenmill}"
PUBKEY_FILE="${2:-}"
GROUP="sftponly"
SFTP_ROOT="/srv/sftp"
JAIL="${SFTP_ROOT}/${PARTNER_USER}"
DATA_DIR="${JAIL}/extracts"
KEY_DIR="/etc/ssh/sftp-keys"
KEY_FILE="${KEY_DIR}/${PARTNER_USER}"
CFG="/etc/ssh/sshd_config"
MARK_BEGIN="# >>> sftp-jail (${GROUP}) managed block >>>"
MARK_END="# <<< sftp-jail (${GROUP}) managed block <<<"

[ "$(id -u)" -eq 0 ] || { echo "ERROR: must run as root" >&2; exit 1; }

log() { echo ">> $*"; }

# 1. group
if ! getent group "$GROUP" >/dev/null; then groupadd "$GROUP"; log "created group $GROUP"; fi

# 2. user — system account, no shell, no create-home (jail is root-owned)
if ! id "$PARTNER_USER" >/dev/null 2>&1; then
    useradd --system --home-dir "$JAIL" --no-create-home \
            --shell /usr/sbin/nologin --gid "$GROUP" "$PARTNER_USER"
    log "created user $PARTNER_USER"
fi
passwd -l "$PARTNER_USER" >/dev/null 2>&1 || true   # lock password: key-only

# 3. jail + parents must be root:root and non-writable (chroot requirement)
mkdir -p "$SFTP_ROOT" "$JAIL" "$DATA_DIR"
chown root:root "$SFTP_ROOT" "$JAIL" "$DATA_DIR"
chmod 755 "$SFTP_ROOT" "$JAIL" "$DATA_DIR"

# 4. authorized_keys location outside the jail (partner cannot edit it)
mkdir -p "$KEY_DIR"; chown root:root "$KEY_DIR"; chmod 755 "$KEY_DIR"
if [ -n "$PUBKEY_FILE" ]; then
    [ -f "$PUBKEY_FILE" ] || { echo "ERROR: pubkey $PUBKEY_FILE not found" >&2; exit 1; }
    install -o root -g root -m 644 "$PUBKEY_FILE" "$KEY_FILE"
    log "installed public key into $KEY_FILE"
elif [ ! -f "$KEY_FILE" ]; then
    touch "$KEY_FILE"; chown root:root "$KEY_FILE"; chmod 644 "$KEY_FILE"
    log "created EMPTY key file $KEY_FILE (account inert until a key is added)"
fi

# 5. sshd Match block — appended to END of main config, guarded, idempotent
if ! grep -qF "$MARK_BEGIN" "$CFG"; then
    cp -a "$CFG" "${CFG}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
    {
        echo ""
        echo "$MARK_BEGIN"
        echo "Match Group ${GROUP}"
        echo "    ChrootDirectory ${SFTP_ROOT}/%u"
        echo "    ForceCommand internal-sftp"
        echo "    AuthorizedKeysFile ${KEY_DIR}/%u"
        echo "    PasswordAuthentication no"
        echo "    AllowTcpForwarding no"
        echo "    AllowAgentForwarding no"
        echo "    X11Forwarding no"
        echo "    PermitTunnel no"
        echo "$MARK_END"
    } >> "$CFG"
    log "appended Match block to $CFG (backup saved alongside)"
fi

# 6. validate BEFORE reload — abort if config is bad (set -e)
sshd -t
log "sshd -t passed"
systemctl reload ssh
log "reloaded ssh"

log "DONE. user=${PARTNER_USER} jail=${JAIL} data=${DATA_DIR} keys=${KEY_FILE}"
