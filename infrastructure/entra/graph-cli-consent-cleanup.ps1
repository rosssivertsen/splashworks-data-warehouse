#Requires -Version 7
<#
.SYNOPSIS
  Remove broad delegated consent from "Microsoft Graph Command Line Tools" (14d82eec-…).

.DESCRIPTION
  Found 2026-10-08: a tenant-wide (AllPrincipals) grant gave EVERY user User.Read.All, Group.Read.All and
  DeviceManagementManagedDevices.Read* through this public client, with no prompt. That's the device-code
  phishing vehicle. A 30-day sign-in review showed no dependent users.

  What it does, with ONE operator sign-in:
    1. Shows every delegated grant on that client (tenant-wide, and per-user if -IncludeMyGrant).
    2. Tenant-wide grant: removes only the -RemoveScopes and keeps the rest. Harmless sign-in scopes stay,
       so first-party sign-in behaviour doesn't change. With -DeleteTenantGrant, the whole grant is deleted instead.
    3. -IncludeMyGrant: deletes the operator's own per-user grant (today's Sites.FullControl.All etc.).
    4. Prints before/after and asks you to type 'yes' before any change.

  Reversible: an admin can re-consent at any time (Enterprise apps → Permissions).
#>
param(
    [string[]]$RemoveScopes = @('User.Read.All', 'Group.Read.All', 'DeviceManagementManagedDevices.Read.All', 'DeviceManagementManagedDevices.Read'),
    [switch]$DeleteTenantGrant,
    [switch]$IncludeMyGrant
)
$ErrorActionPreference = 'Stop'
$Graph = 'https://graph.microsoft.com/v1.0'
$CliClientId = '14d82eec-204b-4c2f-b7e8-296a70dab67e'

function Get-OperatorToken([string]$Scope) {
    $dc = Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/organizations/oauth2/v2.0/devicecode' -Body @{ client_id = $CliClientId; scope = $Scope }
    Write-Host "`n>>> $($dc.message)`n" -ForegroundColor Yellow
    $deadline = (Get-Date).AddSeconds($dc.expires_in)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $dc.interval
        try {
            return (Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token' `
                    -Body @{ grant_type = 'urn:ietf:params:oauth:grant-type:device_code'; client_id = $CliClientId; device_code = $dc.device_code }).access_token
        } catch {
            $err = ($_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue).error
            if ($err -notin 'authorization_pending', 'slow_down') { throw "Sign-in failed: $err" }
        }
    }
    throw 'Device code expired.'
}
function Invoke-G([string]$Token, [string]$Method, [string]$Path, $Body) {
    $p = @{ Method = $Method; Uri = "$Graph$Path"; Headers = @{ Authorization = "Bearer $Token" } }
    if ($Body) { $p.Body = ($Body | ConvertTo-Json -Depth 5); $p.ContentType = 'application/json' }
    Invoke-RestMethod @p
}

$t = Get-OperatorToken 'DelegatedPermissionGrant.ReadWrite.All Application.Read.All User.Read'
$me = Invoke-G $t GET '/me?$select=id,userPrincipalName'
$sp = Invoke-G $t GET "/servicePrincipals(appId='$CliClientId')?`$select=id,displayName"
$grants = (Invoke-G $t GET "/oauth2PermissionGrants?`$filter=clientId eq '$($sp.id)'").value

$plan = foreach ($g in $grants) {
    $scopes = @($g.scope -split '\s+' | Where-Object { $_ })
    if ($g.consentType -eq 'AllPrincipals') {
        $keep = @($scopes | Where-Object { $_ -notin $RemoveScopes })
        $action = $DeleteTenantGrant ? 'DELETE' : ((@($scopes).Count -eq @($keep).Count) ? 'none' : 'TRIM')
        [pscustomobject]@{ Grant = $g.id; Who = 'ALL USERS (tenant-wide)'; Before = $scopes -join ' '; After = ($action -eq 'DELETE') ? '(deleted)' : ($keep -join ' '); Action = $action; Keep = $keep }
    } elseif ($g.principalId -eq $me.id) {
        $action = $IncludeMyGrant ? 'DELETE' : 'none'
        [pscustomobject]@{ Grant = $g.id; Who = "$($me.userPrincipalName) only"; Before = $scopes -join ' '; After = ($action -eq 'DELETE') ? '(deleted)' : '(unchanged)'; Action = $action; Keep = $null }
    } else {
        [pscustomobject]@{ Grant = $g.id; Who = "user $($g.principalId)"; Before = $scopes -join ' '; After = '(unchanged)'; Action = 'none'; Keep = $null }
    }
}
Write-Host "`nDelegated grants on '$($sp.displayName)':" -ForegroundColor Cyan
$plan | ForEach-Object { Write-Host "`n[$($_.Action)] $($_.Who)`n   before: $($_.Before)`n   after:  $($_.After)" }

$todo = @($plan | Where-Object Action -ne 'none')
if (-not $todo) { Write-Host "`nNothing to change." -ForegroundColor Green; return }
if ((Read-Host "`nApply $($todo.Count) change(s) above? Type 'yes' to proceed") -ne 'yes') { Write-Host 'Aborted. Nothing changed.' -ForegroundColor Yellow; return }

foreach ($p in $todo) {
    if ($p.Action -eq 'TRIM') { $null = Invoke-G $t PATCH "/oauth2PermissionGrants/$($p.Grant)" @{ scope = ($p.Keep -join ' ') } }
    else { $null = Invoke-G $t DELETE "/oauth2PermissionGrants/$($p.Grant)" }
    Write-Host "DONE  [$($p.Action)] $($p.Who)" -ForegroundColor Green
}
# Reconciliation: re-read and show the state now.
$after = (Invoke-G $t GET "/oauth2PermissionGrants?`$filter=clientId eq '$($sp.id)'").value
Write-Host "`nAFTER:" -ForegroundColor Cyan
$after | ForEach-Object { Write-Host ("  {0,-14} {1}" -f $_.consentType, $_.scope) }
