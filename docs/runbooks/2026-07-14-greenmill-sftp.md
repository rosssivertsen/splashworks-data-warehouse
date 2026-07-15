# Runbook: Greenmill SFTP extract delivery

**What:** A hardened, chrooted, SFTP-only account (`sftp-greenmill`) on the prod box
(`2.24.202.170`) that lets Greenmill Capital (the PE investment partner; entitlement
confirmed by Ross 2026-07-14 — they are ownership/board, Sam Leibovitz is board chair)
**pull** the nightly Skimmer extracts. Replaces Sam's original ask for an Entra app
registration into M365 — no inbound M365 credential, Splashworks stays the control point.

## Architecture

```
Skimmer → OneDrive → nightly rclone sync → /opt/splashworks/data/extracts/ (GUID names)
                                          → publish-extracts-to-sftp.sh (friendly names + manifest)
                                          → /srv/sftp/sftp-greenmill/extracts/  [the jail]
Greenmill  --SFTP pull (key auth)-->  jail (read-only, chrooted, no shell)
```

## What was provisioned (IaC in `infrastructure/sftp/`)

- `setup-sftp-user.sh` — creates group `sftponly`, user `sftp-greenmill` (system acct,
  `/usr/sbin/nologin`, password locked, key-only), the root-owned jail
  `/srv/sftp/sftp-greenmill` + `extracts/`, the out-of-jail key file
  `/etc/ssh/sftp-keys/sftp-greenmill`, and an sshd `Match Group sftponly` block
  (ChrootDirectory + ForceCommand internal-sftp + no forwarding). Reload gated on `sshd -t`.
- `publish-extracts-to-sftp.sh` — copies the GUID-named extracts into the jail as
  friendly names (`AQPS.db.gz` / `JOMO.db.gz` / `CLERMONT.db.gz`) + a checksummed
  `MANIFEST.txt`. Root-owned `0644` (partner has read only).

## Security properties (verified 2026-07-14 with a throwaway key, since removed)

- Shell denied: `ssh sftp-greenmill@host 'cmd'` → "This service allows sftp connections only."
- Jailed: session lands in `/` = jail root; `ls` shows only `extracts`; `cd /etc` → no such
  file; host filesystem (incl. Postgres socket, `/opt/splashworks`) unreachable.
- Read-only download works; files intact (gzip valid); manifest exposes sha256 + sizes.
- Account is currently **INERT** — key file empty, auth denied — until Greenmill's key is added.

## To activate for Greenmill

1. Get Greenmill's SSH **public** key from Sam (out-of-band; verify via a known channel).
2. Install it:
   ```bash
   scp greenmill.pub root@2.24.202.170:/tmp/greenmill.pub
   ssh root@2.24.202.170 'install -o root -g root -m 644 /tmp/greenmill.pub /etc/ssh/sftp-keys/sftp-greenmill && rm /tmp/greenmill.pub'
   ```
3. Give Greenmill: host `2.24.202.170` (or a dedicated `sftp.splshwrks.com` A record),
   port `22`, user `sftp-greenmill`, path `extracts/`. Files refresh nightly at ~06:00 UTC (tell partners to pull 06:15 UTC or later).

## Nightly refresh

Cron on prod publishes the latest extracts into the jail after the sync:
```
0 6 * * * /opt/splashworks/infrastructure/sftp/publish-extracts-to-sftp.sh >> /opt/splashworks/data/sftp-publish.log 2>&1
```

## Outstanding hardening (do before/at go-live)

- **`ufw` + source-IP allowlist.** ufw is currently inactive on this shared box (also
  serves jomo-inventory on 80/443). Enable default-deny inbound allowing 22/80/443, and —
  if Greenmill has static egress IPs — restrict port 22 (or a dedicated SFTP port) to those
  IPs. Coordinate with the inventory-app owner. (SECURITY_AUDIT_2026-07-14 LOW.)
- **Consider moving off the prod warehouse box.** The jail contains the blast radius, but a
  dedicated/staging host would remove the SFTP listener from the PII/Postgres host entirely.
- **Data-sharing basis** documented for the audit trail (entitlement confirmed; record the
  DPA/agreement reference when available).

## Revoke

```bash
ssh root@2.24.202.170 'usermod -L sftp-greenmill; : > /etc/ssh/sftp-keys/sftp-greenmill'
# or fully: userdel sftp-greenmill; rm -rf /srv/sftp/sftp-greenmill /etc/ssh/sftp-keys/sftp-greenmill
# then remove the Match block from /etc/ssh/sshd_config, `sshd -t`, `systemctl reload ssh`
```
