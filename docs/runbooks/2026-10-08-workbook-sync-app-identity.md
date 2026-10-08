# Runbook — Branch Workbook Sync app identity (one library only)

**Created:** 2026-10-08 · **Owner:** Ross Sivertsen (CTO) · **Script:** `infrastructure/entra/workbook-sync-app.ps1`
**Decision record:** sherpa-vault `memory/knowledge/decisions/splashworks-entra-graph-access-requests-register.md`

## Status (2026-10-08)

| Item | Value |
|---|---|
| App | `Splashworks Branch Workbook Sync`, appId `4a97e931-92a4-4a33-af38-491530d4bda7`, spId `a7f8bb26-c034-441f-9b0f-c82bcb4b4dad` |
| Tenant | `9da2d68e-642a-4fe3-89db-5f603f8d0493` |
| Permission | Microsoft Graph **Sites.Selected** (application) only |
| Grant | `write` on site `Operations-BranchWorkbooks` (`splashworkspool.sharepoint.com,5131bc21-…,25fe7c51-…`) |
| Scope decision | **Site, not library.** The site is dedicated: one library, one folder. So Sites.Selected reaches exactly the same content as a library grant, without breaking inheritance. |
| Boundary check | **8/8 PASS.** Read/write/delete in the granted library allowed. A different site (JOMO Operations), the tenant root site, sites search, users and groups all returned 403. |
| Credentials | Test certificate (thumbprint `5075EE6E…`) is still on the app, but **its private key was destroyed** after Verify, so it can't be used. Remove it when Brian's certificate is added. |
| Leftover | `boundary-probe-*.txt` in the site recycle bin (created and deleted by Verify) |

**Next:** Brian generates his key pair on his Mac (step 7) and sends the public `.cer.pem` → add it to the app → run Verify from his Mac → remove the test certificate. Brian's instructions: `docs/handoff/2026-10-08-brian-workbook-sync.md`.

### Related cleanup (same day): consent on Microsoft Graph Command Line Tools

Found while confirming that no org-wide consent had been granted: an older **tenant-wide** delegated grant on Graph CLI Tools (`14d82eec…`) for `User.Read.All`, `Group.Read.All` and Intune device read. Every user could get those scopes through the device-code phishing client with no prompt. A 30-day sign-in review (interactive and non-interactive) showed no dependent users.
- **Fixed by hand** (Ross): Entra → Enterprise apps → Microsoft Graph Command Line Tools → Permissions → Admin consent → `…` → Revoke permission, for each of the three. Remaining: `openid profile offline_access`.
- The operator's own per-user grant from today was revoked at **myapps.microsoft.com → the app → Revoke consent**. The Entra portal can't revoke User consent. The User consent tab was verified empty.
- `infrastructure/entra/graph-cli-consent-cleanup.ps1` does the same thing in one run (shows before/after, requires a typed `yes`). It's kept for next time; it wasn't used here.
- **Rule going forward:** admin scripts sign in with the operator's own consent. Never tick "Consent on behalf of your organization".

## Why

Brian's nightly branch-workbook job (Jax, Ocala, Clermont) runs on his MacBook under launchd and publishes through the OneDrive sync client. Three times in ten days a sync conflict left a branch on stale data while the log said "published". Clermont has been stale since 10/3.

Brian asked for Graph admin consent in two forms. Both were declined:
- **A:** tenant-wide consent on Microsoft Graph Command Line Tools. That grants .All file scopes to every user, through the client most often used in device-code phishing.
- **B:** a new app with delegated Files/Sites.ReadWrite.All. That gives access to everything the CEO can reach, held on a laptop.

**Chosen:** an app identity with **Lists.SelectedOperations.Selected**, granted `write` on **one library**, authenticated by a **certificate whose private key is created on, and never leaves, the machine that runs the job**. It's the same identity the job will use once it moves to the VPS: move the certificate, keep the grant.

## Blast radius if the Mac is compromised

One library: read, modify and delete its files. Nothing else in the tenant. Brian's account is not involved.
Recovery: run `Disable` (minutes), then restore from library version history and the recycle bin.

## Decision needed before GrantList: where the grant lands

A list-level grant **breaks permission inheritance on that library**, according to Microsoft's Selected-permissions docs. Staff access is copied as it was at that moment. People added to the site later will **not** automatically get access to the library.

| Option | Effect | Use when |
|---|---|---|
| Grant on the existing "Operations - Branch Workbooks" library | Inheritance breaks; library membership must be managed separately from then on | The library already has its own permissions, or that's acceptable |
| **Move the 3 workbooks to a dedicated site** and use `Sites.Selected` | No inheritance break (the site is the root); still small | Inheritance matters, or you'd rather not manage library-level permissions |

## Procedure

**0. Prerequisites (Ross, in the UI)**
- [ ] Recover Clermont first: version history → any staff edits since 10/3.
- [ ] Library settings → Versioning: on, major versions, keep at least 100. Recycle bin retention: default 93 days.
- [ ] Create a **test library** on the same site, e.g. `Workbook Sync Test`. Use it for every step below before touching production.

**1. Discover (read-only).** `-Phase Discover -SiteSearch "Operations"` → record the tenant ID, site ID, library IDs, and confirm no app with this name already exists.

**2. Certificate.** Create a test certificate on Ross's Mac for the boundary test. Brian's Mac creates its own certificate later.
```bash
umask 077; openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -subj "/CN=Splashworks Branch Workbook Sync (test)" -keyout test.key.pem -out test.cer.pem
```
Only `test.cer.pem` (public) goes to Entra. The script refuses a file that contains a private key.

**3. CreateApp.** Dry run first, then `-Apply`. This creates the app and service principal and grants consent for Lists.SelectedOperations.Selected **only**. Data access is still zero at this point.

**4. GrantList → test library.** `-Role write`. Dry run, then `-Apply`.

**5. Verify (the reconciliation step).** Use `-ControlListId` for a second library on the same site. All of these must pass:

| Test | Expected |
|---|---|
| Read / write / delete in the granted library | allowed |
| Another library on the same site | denied |
| Site default library | denied |
| Search all sites | denied, or empty |
| Users, groups | denied |

If any test fails, stop. Run `Revoke` and `Disable` and investigate.

**6. Production cut-over.** Run `Revoke` on the test library, `GrantList` on the production library, and `Verify` again. Remove the test certificate from the app.

**7. Brian's certificate.** Brian generates a key pair on his Mac (same command, his own CN) and sends **only** the `.cer.pem`. Add it to the app (Entra → App registrations → Certificates), confirm `Verify` passes from his Mac, then remove the test certificate. Store the private key in Keychain if possible; otherwise as a `chmod 600` file outside OneDrive and iCloud.

**8. Job changes (Brian + Claude Code).**
- Download the workbook from SharePoint through Graph, build, then upload to the same path. This creates a new version and keeps the item ID and links.
- Stop syncing these files via OneDrive on the Mac.
- After upload, read the file back (eTag / lastModifiedDateTime) and alert by email from `reports@workbooks.splashworkspools.com` on any mismatch. Never log "published" without that check.

## Operations

| Task | How |
|---|---|
| Kill switch | `-Phase Disable -AppId <id> -Apply`. Existing tokens expire within about an hour. |
| Remove access | `-Phase Revoke -SiteId … -ListId … -AppId … -Apply` |
| Audit | Entra → Sign-in logs → Service principal sign-ins (filter by app ID); Purview audit for file activity |
| Certificate expiry | 365 days. Calendar reminder 30 days before; add the new certificate, then remove the old one |
| Move to VPS | Generate a certificate on the VPS, add it, verify, then remove the Mac certificate. The grant stays the same. |

## Open questions
- Does the job need to **read** anything outside this library (for example the Skimmer nightly extract, Pool Deck Exports)? If so, each needs its own explicit grant, ideally `read`. Don't widen this grant to cover them.
- Does the job use the Excel workbook API (editing cells in place) or whole-file upload? App-only support for the workbook API must be tested before relying on it.
