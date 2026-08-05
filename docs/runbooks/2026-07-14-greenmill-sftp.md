# Runbook: Greenmill SFTP — extract delivery + backup drop-off

**What:** Hardened, chrooted, SFTP-only accounts on prod (`2.24.202.170` /
`srv1590691.hstgr.cloud`) that let Greenmill Capital (PE investment partner; entitlement
confirmed by Ross 2026-07-14 — ownership/board, Sam Leibovitz is board chair) **pull** the
nightly Skimmer extracts and — since 2026-08-05 — **push** their nightly governance backup
into a write-scoped drop-off. Replaces Sam's original ask for an Entra app registration into
M365; no inbound M365 credential, Splashworks stays the control point.

> **Status changed 2026-08-05.** Earlier revisions of this runbook said the account was
> **INERT**. That is no longer true and was stale for ~3 weeks. Both accounts are live.

## Accounts (there are TWO — the second was undocumented until 2026-08-05)

| Account | uid | Key comment | Role | Drop-off |
|---|---|---|---|---|
| `sftp-greenmill` | 999 | `greenmill-splashworks-sftp` | pull-only; **no logins on record** | none |
| `sftp-greenmill-ci` | 997 | `greenmill-ci-splashworks-sftp` | **the account actually in use** | `incoming/` |

`sftp-greenmill-ci` runs twice daily (~06:20 and ~07:30 UTC) from **rotating Microsoft Azure
egress IPs** — 19 logins Jul 26–Aug 5, 19 distinct source IPs, zero repeats. Consistent with
hosted CI runners.

**Consequence: source-IP allowlisting is not viable** as written in the old hardening list.
Greenmill would need a static egress / NAT gateway first. Do not plan on it otherwise.

**Open question (Ross):** the 2026-07-14 entitlement was confirmed for Greenmill as
ownership/board. Whether that covers an *automated CI pipeline* pulling nightly has not been
explicitly confirmed. Also unconfirmed: who created `-ci` on 2026-07-15 (5h after the main jail).

## Architecture

```
Skimmer → OneDrive → nightly rclone sync → /opt/splashworks/data/extracts/ (GUID names)
                                         → publish-extracts-to-sftp.sh (friendly names + manifest)
                                         → /srv/sftp/<account>/extracts/   [read-only, root:root 0644]
Greenmill --SFTP pull (key auth)--> extracts/   (read)
Greenmill --SFTP push (key auth)--> incoming/   (write + delete, sftp-greenmill-ci ONLY)
```

### Jail layout and why each mode is what it is

```
/srv/sftp/sftp-greenmill-ci/        root:root        0755   chroot root — MUST stay root-owned
├── extracts/                       root:root        0755   we publish here; partner reads only
│   └── *.db.gz, MANIFEST.txt       root:root        0644
└── incoming/          sftp-greenmill-ci:sftponly    0750   the ONLY writable path in the jail
```

OpenSSH refuses to chroot into a directory that is not root-owned and non-writable, so write
access can never be granted at the jail root. Scoping it to one subdir also keeps published
extracts tamper-proof — a partner cannot alter what we delivered to them.

## ⚠️ The chroot path trap

The client is chrooted, so **the server-side path will not work if you give it to a partner**:

| | Path |
|---|---|
| What Sam's client uses | `extracts/` and `incoming/` (jail root appears as `/`) |
| Real path on disk | `/srv/sftp/sftp-greenmill-ci/extracts/`, `.../incoming/` |

Handing over `/srv/sftp/...` produces a "no such file" / permission-shaped error that looks
like a broken account.

## Connection details to give a partner

```
Host      2.24.202.170   (srv1590691.hstgr.cloud)
Port      22
User      sftp-greenmill-ci
Auth      SSH public key ONLY — partner sends us their PUBLIC key.
          NEVER generate and transmit a private key on their behalf.
Download  extracts/     (read-only; refreshed nightly ~06:00 UTC — pull 06:15+)
Upload    incoming/     (write + delete; partner manages their own retention)
```

Host key fingerprints (for pinning — send via a channel separate from the hostname):
```
ED25519  SHA256:hLPH3APVWvDACDO7uPMrXMS+AL5zEt4Lzq0Ghrz1GAc
RSA      SHA256:Gr2HpD5eKkPiJ6wwydCzjmyqupnuXGXwdxuPuyR6rI0
```

## Logging (reworked 2026-08-05)

Previously **logins only** — we knew someone connected but had no record of what they took.
Now two layers:

1. **Connection** — sshd journals every `Accepted publickey`. Always on.
2. **Transfer** — `ForceCommand internal-sftp -l INFO` in the `Match Group sftponly` block
   emits per-file `open` / `close` / `remove` records with filenames and byte counts.
   **Without `-l INFO` there is no transfer record at all.**

`notify-sftp-access.sh` (cron `*/5`) reads both from the journal and posts to Slack:

- `:inbound_ping:` login — user + source IP
- `:inbox_tray:` **UPLOAD CONFIRMED** — user + path + size, per file (the write confirmation)
- `:outbox_tray:` download — summarised per run (count + total bytes) to avoid flooding
- `:wastebasket:` delete — partner pruning their own drop-off
- `:rotating_light:` / `:warning:` — root filesystem ≥85%, or a drop-off ≥2048 MB

Partner-supplied filenames are stripped of quotes/backslashes/control chars before entering the
Slack JSON payload. The run window advances **only after successful processing**, so a mid-run
failure retries rather than silently dropping audit events.

## Disk risk — read before raising any limit

`/srv` is **on the root filesystem alongside Postgres** (`/dev/sda1`, 193G, 31% used at
2026-08-05). An unbounded external writer is therefore an *availability* risk to the warehouse,
not just a storage nuisance. The guard **alerts only and never auto-deletes** partner data —
pruning someone else's backups is a destructive action requiring explicit approval.

If volume grows, the durable fix is a size-capped loopback mount for `incoming/`, not a bigger
threshold.

## Provisioning (IaC in `infrastructure/sftp/`)

```bash
# pull-only partner (default)
./setup-sftp-user.sh sftp-<partner> /path/to/partner.pub

# partner that also uploads
DROPOFF_DIR=incoming ./setup-sftp-user.sh sftp-<partner> /path/to/partner.pub
```

Idempotent. The sshd managed block is **rebuilt in place when its content changes**, so
re-running actually applies config updates (it previously only appended if absent, which is why
`-l INFO` could not be rolled out by re-running). Reload is gated on `sshd -t`.

**Note — `publish-extracts-to-sftp.sh` fans out via `JAIL_GLOB=/srv/sftp/*/extracts`.** Creating
a jail directory silently grants that account the full nightly extract set. Convenient for
onboarding; it also means **no approval step sits between "directory exists" and "partner has
all customer data."** Treat jail creation as the entitlement decision.

## Verification status (2026-08-05)

Verified:
- `ForceCommand internal-sftp -l INFO` present; `sshd -t` passed; ssh reloaded.
- Jail root and `extracts/` remain `root:root` — chroot requirement intact, extracts read-only.
- `incoming/` writable by `sftp-greenmill-ci`; create **and delete** confirmed via `sudo -u`.
- `sftp-greenmill` (other account) unchanged — no drop-off, still pull-only.
- Greenmill's installed public key **unmodified** (md5 `b33352fb…` before and after).
- `notify-sftp-access.sh` runs clean on prod (exit 0, bash 5.2).

**Not yet verified end-to-end:** an actual authenticated SFTP upload emitting an
`internal-sftp … close … written N` record and a resulting Slack post. This needs either a
real transfer from Greenmill or a throwaway test key installed by Ross. The first real pull
(~06:20 UTC) will confirm the download half.

## Revoke

```bash
# freeze one account
ssh root@2.24.202.170 'usermod -L sftp-greenmill-ci; : > /etc/ssh/sftp-keys/sftp-greenmill-ci'

# remove write access only (keep pull working)
ssh root@2.24.202.170 'chown root:root /srv/sftp/sftp-greenmill-ci/incoming'

# full removal
# userdel sftp-greenmill-ci; rm -rf /srv/sftp/sftp-greenmill-ci /etc/ssh/sftp-keys/sftp-greenmill-ci
# then drop the managed block from /etc/ssh/sshd_config, `sshd -t`, `systemctl reload ssh`
```

Config backups from every run: `/etc/ssh/sshd_config.bak.<UTC timestamp>` plus
`/root/sshd_config.pre-dropoff.<UTC timestamp>`.
