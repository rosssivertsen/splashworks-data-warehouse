# Branch workbook sync: what changes and what to do

**For:** Brian Hawkins · **From:** Ross · **Date:** 2026-10-08

## The short version

Your nightly job now has its own Microsoft identity, **"Splashworks Branch Workbook Sync"**. It can read and write **only** the Operations-BranchWorkbooks site. We tested it: it's refused everywhere else (other sites, users, groups). It replaces the OneDrive sync client, which caused the stuck publishes.

It signs in with a **certificate you create on your Mac**. The private half never leaves your Mac. If the Mac is ever lost or compromised, the worst case is that one site, and we can switch the identity off in minutes and roll files back from version history.

## Today, before anything else

- **Don't resolve the Clermont conflict on your Mac.** Beth has saved Clermont 15+ times since 10/6. If OneDrive uploads your local copy, it replaces her work.
- **Save a copy of your local Clermont file** to your Desktop (File → Save a Copy, outside OneDrive) and send it to Ross so we can check nothing of yours is lost.
- **Then stop syncing the Branch Workbooks library** in OneDrive (OneDrive menu bar icon → Settings → Account → Choose folders / Stop sync for that library). The new job reads and writes SharePoint directly, so it doesn't need the synced folder.

## Step 1: Create your certificate (2 minutes)

Run this in Terminal on your Mac. It creates a private key that stays on your Mac and a public certificate to send to Ross.

```bash
mkdir -p ~/.config/workbook-sync && chmod 700 ~/.config/workbook-sync && cd ~/.config/workbook-sync && (umask 077; openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=Splashworks Branch Workbook Sync (Brian MacBook)" -keyout workbook-sync.key.pem -out workbook-sync.cer.pem) && ls -l
```

- **Send Ross only `workbook-sync.cer.pem`** (the public certificate).
- **Never send, copy or commit `workbook-sync.key.pem`.** Keep it out of OneDrive, iCloud and Git.
- The certificate is valid for one year. Ross has a reminder to renew it.

Ross adds the certificate to the app and tells you when it's ready.

## Step 2: Rewire the job (paste this into Claude Code)

Once Ross confirms, open Claude Code in your branch-workbook project and paste the prompt below.

```text
I'm changing how my nightly branch-workbook job publishes to SharePoint. Today it writes into the
OneDrive-synced folder and relies on the OneDrive sync client, which keeps getting stuck in conflicts.
Please rework it to talk to SharePoint directly through Microsoft Graph, using an app identity IT has
set up for me. Read the existing code first and tell me your plan before changing anything.

IDENTITY (app-only, certificate auth; no user sign-in, no client secret)
- Tenant ID: 9da2d68e-642a-4fe3-89db-5f603f8d0493
- App (client) ID: 4a97e931-92a4-4a33-af38-491530d4bda7
- Certificate: ~/.config/workbook-sync/workbook-sync.cer.pem
- Private key: ~/.config/workbook-sync/workbook-sync.key.pem  (never copy it, print it, log it, or commit it;
  add *.key.pem to .gitignore)
- Token: client-credentials flow with a certificate assertion, scope https://graph.microsoft.com/.default.
  If the job is Python, use the msal library (ConfidentialClientApplication with client_credential
  {"private_key": ..., "thumbprint": SHA-1 thumbprint of the cert}). Otherwise use the equivalent MSAL library.
- This identity can ONLY reach this site, so any 403 means a wrong path, not a missing permission:
  Site: splashworkspool.sharepoint.com/sites/Operations-BranchWorkbooks
  Site ID: splashworkspool.sharepoint.com,5131bc21-e6b4-4e7e-ab75-dc860243be40,25fe7c51-19af-4b33-ac8a-64793d361c39
  Library: the site's default drive ("Documents"), folder "Branch Workbooks"
  e.g. GET https://graph.microsoft.com/v1.0/sites/{site-id}/drive/root:/Branch Workbooks/Clermont_Workbook.xlsx

HOW THE JOB MUST WORK (branch staff edit these workbooks all day, so their edits are inputs)
1. READ FROM THE SERVER, NEVER FROM A LOCAL SYNCED COPY. For each workbook (Jax_JOMO_Workbook.xlsx,
   Ocala_Splashworks_Workbook.xlsx, Clermont_Workbook.xlsx), download the current file from SharePoint
   into a local work folder OUTSIDE OneDrive/iCloud, and record its eTag.
2. Build the updated workbook from that downloaded copy, exactly as the job does today.
3. UPLOAD WITH A SAFETY CHECK. Always upload through an upload session on the EXISTING item
   (POST .../drive/items/{item-id}/createUploadSession) with the header if-match: <eTag from step 1>,
   whatever the file size. That keeps the same item, links and version history, and Microsoft documents
   that a changed eTag returns 412 Precondition Failed. If someone edited the file after we downloaded
   it, we get 412: do NOT retry blindly and do NOT overwrite. Mark that branch FAILED and alert.
4. VERIFY AFTER UPLOAD. Re-read the item and confirm size and lastModifiedDateTime changed, and that
   lastModifiedBy shows the "Splashworks Branch Workbook Sync" application. Only then log "published".
   The log must never say "published" without this check.
5. ALERT ON ANY FAILURE. Email Brian (and, later, the branch manager) via Resend from
   reports@workbooks.splashworkspools.com, one line per branch: published / FAILED + reason.
   Use the existing Resend setup for workbooks.splashworkspools.com.
6. Add a --dry-run flag that does everything except the upload and prints what it would write.
7. Keep the other outputs the job writes to this site (_reports, dashboards, briefs) on the same
   Graph path, with the same verify step.
8. Remove any dependency on the OneDrive-synced folder for these files.

TEST PLAN, before the real nightly run
- Run --dry-run against all three workbooks and show me the output.
- Then do one real run against a TEST copy uploaded as "Branch Workbooks/_TEST_Clermont_Workbook.xlsx".
  Confirm the If-Match safety works: edit the test copy in the browser after the download step and
  check the upload is refused with 412.
- Delete the test copy afterwards.

Also: make sure this project is in a git repo and commit the change, so it doesn't live only on this Mac.
```

## Step 3: Tell Ross when the dry run looks right

Ross runs a final check that your Mac's certificate works and is still refused outside the site, then removes the temporary test certificate. After that, the nightly job is on the new path.

## One more thing (separate from the job)

The **Coaching_Memo_\*** files and **Tech_Bonus_Calculator.xlsx** sit in the same folder the branch staff work in. If they mention specific employees or pay, staff in that folder can probably open them. Moving them to a restricted location protects them from the branches and keeps them outside the job's reach.

## Later

This is the short-term setup. The long-term home for the job is the Splashworks server, so it doesn't depend on your laptop being awake. Same identity, same site; only the certificate moves. Ross will set that up with you.
