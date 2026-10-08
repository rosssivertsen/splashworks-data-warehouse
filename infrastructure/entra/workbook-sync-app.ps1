#Requires -Version 7
<#
.SYNOPSIS
  Branch-workbook sync: app identity limited to ONE SharePoint library (Lists.SelectedOperations.Selected).

.DESCRIPTION
  Phases, run in order. Writes happen only with -Apply; without it, each phase prints what it WOULD send.

    Discover   read-only. Finds the site and its libraries, the Graph app-role id, and any existing app.
    CreateApp  registers the app (single tenant, no secret, no redirect URI), uploads the PUBLIC cert,
               and grants admin consent for the one application role. This alone grants NO data access.
    GrantList  grants the app 'write' on exactly one library. This is the only data grant.
    Verify     signs in AS THE APP (certificate) and proves the boundary:
               the granted library is reachable, everything else returns 403.
    Disable    kill switch. Disables the service principal (reversible).
    Revoke     removes the library grant.

  Admin phases use device-code sign-in as the operator. Use the raw REST flow, not Connect-MgGraph
  -UseDeviceCode, because the SDK times out after 120 s (see feedback_graph_devicecode_timeout).
  When the consent screen appears, do NOT tick "Consent on behalf of your organization".
  Tokens stay in process memory and are never printed or written to disk.

.EXAMPLE
  ./workbook-sync-app.ps1 -Phase Discover -SiteSearch "Operations"
  ./workbook-sync-app.ps1 -Phase CreateApp -CertPath ./brian-workbook-sync.cer            # dry run
  ./workbook-sync-app.ps1 -Phase CreateApp -CertPath ./brian-workbook-sync.cer -Apply
  ./workbook-sync-app.ps1 -Phase GrantList -SiteId <id> -ListId <id> -AppId <appId> -Apply
  ./workbook-sync-app.ps1 -Phase Verify -SiteId <id> -ListId <id> -AppId <appId> -TenantId <tid> `
      -CertPemPath ./test.cer.pem -KeyPemPath ./test.key.pem -ControlListId <other-library-id>
#>
param(
    [Parameter(Mandatory)][ValidateSet('Discover', 'Setup', 'CreateApp', 'GrantList', 'Verify', 'Disable', 'Revoke')]
    [string]$Phase,
    # Site = Sites.Selected on one site (no inheritance break; use when the site is dedicated to the workbooks).
    # List = Lists.SelectedOperations.Selected on one library (breaks inheritance on that library).
    [ValidateSet('Site', 'List')][string]$Scope = 'Site',
    [string]$ControlSiteId,          # Verify: a different site the app must NOT reach
    [string]$SiteSearch,
    [string]$SitePath,               # Discover: e.g. splashworkspool.sharepoint.com/sites/Operations-BranchWorkbooks
    [string]$FolderPath,             # Discover: folder inside the default library, e.g. "Branch Workbooks"
    [string]$ItemSearch,            # Discover: find libraries/folders/files by name (e.g. "Branch Workbooks")
    [string]$SiteId,
    [string]$ListId,
    [string]$ControlListId,          # a library on the same site that the app must NOT reach
    [string]$AppId,
    [string]$TenantId,
    [string]$CertPath,               # public .cer (DER or PEM). The private key never leaves its machine.
    [string]$CertPemPath,            # Verify only: public cert PEM
    [string]$KeyPemPath,             # Verify only: private key PEM (chmod 600)
    [string]$DisplayName = 'Splashworks Branch Workbook Sync',
    [ValidateSet('read', 'write')][string]$Role = 'write',
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$Graph = 'https://graph.microsoft.com/v1.0'
$GraphAppId = '00000003-0000-0000-c000-000000000000'
$CliClientId = '14d82eec-204b-4c2f-b7e8-296a70dab67e'   # operator sign-in only, consented per-user

function Get-OperatorToken([string]$Scope) {
    $dc = Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/organizations/oauth2/v2.0/devicecode' `
        -Body @{ client_id = $CliClientId; scope = $Scope }
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
    $p = @{ Method = $Method; Uri = ($Path -like 'https://*' ? $Path : "$Graph$Path"); Headers = @{ Authorization = "Bearer $Token" } }
    if ($Body) { $p.Body = ($Body | ConvertTo-Json -Depth 10); $p.ContentType = 'application/json' }
    Invoke-RestMethod @p
}

function Show-Plan([string]$Method, [string]$Path, $Body) {
    Write-Host "DRY RUN  $Method $Path" -ForegroundColor Cyan
    if ($Body) { $Body | ConvertTo-Json -Depth 10 | Write-Host }
}

$RoleValue = ($Scope -eq 'Site') ? 'Sites.Selected' : 'Lists.SelectedOperations.Selected'

function Get-RoleId([string]$Token) {
    $sp = Invoke-G $Token GET "/servicePrincipals(appId='$GraphAppId')?`$select=id,appRoles"
    $role = $sp.appRoles | Where-Object value -eq $RoleValue
    if (-not $role) { throw "$RoleValue app role not found on Microsoft Graph in this tenant." }
    [pscustomobject]@{ GraphSpId = $sp.id; RoleId = $role.id }
}

function Read-PublicCert([string]$Path) {
    $raw = Get-Content -Raw -LiteralPath $Path
    $der = $raw -match 'BEGIN CERTIFICATE' `
        ? [Convert]::FromBase64String(($raw -replace '-----[^-]+-----', '' -replace '\s', '')) `
        : [IO.File]::ReadAllBytes((Resolve-Path $Path))
    if ($raw -match 'PRIVATE KEY') { throw 'Refusing: that file contains a private key. Pass the PUBLIC certificate only.' }
    $x509 = [Security.Cryptography.X509Certificates.X509Certificate2]::new($der)
    Write-Host "Cert: $($x509.Subject)  thumbprint=$($x509.Thumbprint)  expires=$($x509.NotAfter)"
    [pscustomobject]@{ Der = $der; Subject = $x509.Subject }
}

function Get-AppBody($Cert, [string]$RoleId) {
    @{
        displayName            = $DisplayName
        signInAudience         = 'AzureADMyOrg'
        notes                  = "Owner: Ross Sivertsen (CTO). Purpose: nightly branch-workbook publish. Scope: ONE $($Scope.ToLower()) via $RoleValue. Runbook: splashworks-data-warehouse/docs/runbooks/2026-10-08-workbook-sync-app-identity.md"
        requiredResourceAccess = @(@{ resourceAppId = $GraphAppId; resourceAccess = @(@{ id = $RoleId; type = 'Role' }) })
        keyCredentials         = @(@{ type = 'AsymmetricX509Cert'; usage = 'Verify'; key = [Convert]::ToBase64String($Cert.Der); displayName = $Cert.Subject })
    }
}

function Get-GrantRequest([string]$ForAppId) {
    $app = @{ application = @{ id = $ForAppId; displayName = $DisplayName } }
    ($Scope -eq 'Site') `
        ? @{ Path = "/sites/$SiteId/permissions"; Body = @{ roles = @($Role); grantedToIdentities = @($app) } } `
        : @{ Path = "/sites/$SiteId/lists/$ListId/permissions"; Body = @{ roles = @($Role); grantedToV2 = $app } }
}

# The library the app is supposed to reach: the site's default library, or the named list's drive.
function Get-GrantedDrivePath { ($Scope -eq 'Site') ? "/sites/$SiteId/drive" : "/sites/$SiteId/lists/$ListId/drive" }

switch ($Phase) {
    'Discover' {
        $t = Get-OperatorToken 'Sites.Read.All Application.Read.All'
        $org = (Invoke-G $t GET '/organization?$select=id,displayName').value[0]
        Write-Host "Tenant: $($org.displayName)  ($($org.id))"
        $r = Get-RoleId $t
        Write-Host "Graph SP: $($r.GraphSpId)   $RoleValue role: $($r.RoleId)"
        $existing = (Invoke-G $t GET "/applications?`$filter=displayName eq '$DisplayName'&`$select=appId,id,createdDateTime").value
        Write-Host "Existing app named '$DisplayName': $(@($existing).Count)"
        $existing | Format-Table | Out-String | Write-Host
        if ($SitePath) {
            # Read-only inventory of one site: libraries, what the default library holds, and who saved each workbook when.
            $s = Invoke-G $t GET "/sites/$($SitePath -replace '^https://', '' -replace '^([^/]+)/', '$1:/')?`$select=id,displayName,webUrl"
            Write-Host "`nSITE  $($s.displayName)  $($s.webUrl)`n      id=$($s.id)" -ForegroundColor Green
            (Invoke-G $t GET "/sites/$($s.id)/lists?`$select=id,displayName,list").value | Where-Object { $_.list.template -eq 'documentLibrary' } |
                ForEach-Object { Write-Host ("      LIB  {0,-30} id={1}" -f $_.displayName, $_.id) }
            $drive = Invoke-G $t GET "/sites/$($s.id)/drive?`$select=id,name"
            Write-Host "`nDEFAULT LIBRARY '$($drive.name)' top level (everything a library-wide grant would expose):" -ForegroundColor Green
            (Invoke-G $t GET "/drives/$($drive.id)/root/children?`$select=name,folder,file,size,lastModifiedDateTime&`$top=200").value |
                ForEach-Object { Write-Host ("      {0,-6} {1,-45} items={2,-5} modified={3}" -f ($_.folder ? 'DIR' : 'FILE'), $_.name, $_.folder.childCount, $_.lastModifiedDateTime) }
            if ($FolderPath) {
                Write-Host "`nFOLDER '$FolderPath':" -ForegroundColor Green
                $kids = (Invoke-G $t GET "/drives/$($drive.id)/root:/$([uri]::EscapeDataString($FolderPath) -replace '%2F','/'):/children?`$select=id,name,file,size,lastModifiedDateTime,lastModifiedBy&`$top=200").value
                foreach ($k in $kids) {
                    Write-Host ("  {0,-50} {1,8:N0} KB  modified={2}  by={3}" -f $k.name, ($k.size / 1KB), $k.lastModifiedDateTime, $k.lastModifiedBy.user.displayName)
                    if ($k.file) {
                        (Invoke-G $t GET "/drives/$($drive.id)/items/$($k.id)/versions?`$top=15").value | Select-Object -First 15 |
                            ForEach-Object { Write-Host ("      v{0,-7} {1}  {2}" -f $_.id, $_.lastModifiedDateTime, $_.lastModifiedBy.user.displayName) }
                    }
                }
            }
        }
        if ($ItemSearch) {
            # Microsoft Search finds libraries and folders by name; /sites?search only matches site names.
            foreach ($type in 'list', 'driveItem') {
                $req = @{ requests = @(@{ entityTypes = @($type); query = @{ queryString = $ItemSearch }; size = 25 }) }
                $hits = (Invoke-G $t POST '/search/query' $req).value[0].hitsContainers[0].hits
                Write-Host "`nSEARCH [$type] '$ItemSearch': $(@($hits).Count) hit(s)" -ForegroundColor Green
                foreach ($h in $hits) {
                    $r = $h.resource
                    Write-Host ("  {0,-45} {1}" -f ($r.name ?? $r.displayName), $r.webUrl)
                    if ($r.parentReference.siteId) { Write-Host "      siteId=$($r.parentReference.siteId)  driveId=$($r.parentReference.driveId)" }
                }
            }
        }
        if ($SiteSearch) {
            $sites = (Invoke-G $t GET "/sites?search=$([uri]::EscapeDataString($SiteSearch))&`$select=id,displayName,webUrl").value
            foreach ($s in $sites) {
                Write-Host "`nSITE  $($s.displayName)  $($s.webUrl)`n      id=$($s.id)" -ForegroundColor Green
                (Invoke-G $t GET "/sites/$($s.id)/lists?`$select=id,displayName,list").value |
                    Where-Object { $_.list.template -eq 'documentLibrary' } |
                    ForEach-Object { Write-Host ("      LIB  {0,-40} id={1}" -f $_.displayName, $_.id) }
            }
        }
    }

    'Setup' {
        # One operator sign-in: create the app, consent its single role, grant the one site/library.
        # Refuses to run if an app with this name already exists (no duplicates, no silent re-grants).
        if (-not ($CertPath -and $SiteId)) { throw '-CertPath and -SiteId are required.' }
        if ($Scope -eq 'List' -and -not $ListId) { throw '-ListId is required with -Scope List.' }
        $cert = Read-PublicCert $CertPath
        if (-not $Apply) {
            Show-Plan POST '/applications' (Get-AppBody $cert "<role id for $RoleValue>")
            Show-Plan POST '/servicePrincipals' @{ appId = '<new appId>' }
            Show-Plan POST '/servicePrincipals/<new spId>/appRoleAssignedTo' @{ principalId = '<new spId>'; resourceId = '<Graph spId>'; appRoleId = "<$RoleValue>" }
            $g = Get-GrantRequest '<new appId>'; Show-Plan POST $g.Path $g.Body
            Write-Host "`nNo sign-in, nothing sent. Re-run with -Apply to execute." -ForegroundColor Cyan
            break
        }
        $t = Get-OperatorToken 'Application.ReadWrite.All AppRoleAssignment.ReadWrite.All Sites.FullControl.All'
        if (@((Invoke-G $t GET "/applications?`$filter=displayName eq '$DisplayName'&`$select=appId").value).Count) { throw "An app named '$DisplayName' already exists. Aborting; nothing was changed." }
        $r = Get-RoleId $t
        $app = Invoke-G $t POST '/applications' (Get-AppBody $cert $r.RoleId)
        Write-Host "1/4 app created           appId=$($app.appId)" -ForegroundColor Green
        $sp = Invoke-G $t POST '/servicePrincipals' @{ appId = $app.appId; tags = @('WindowsAzureActiveDirectoryIntegratedApp') }
        Write-Host "2/4 service principal     spId=$($sp.id)" -ForegroundColor Green
        $null = Invoke-G $t POST "/servicePrincipals/$($sp.id)/appRoleAssignedTo" @{ principalId = $sp.id; resourceId = $r.GraphSpId; appRoleId = $r.RoleId }
        Write-Host "3/4 consent: $RoleValue only (grants nothing by itself)" -ForegroundColor Green
        # A brand-new service principal can take a few seconds to replicate before SharePoint will accept a grant.
        $g = Get-GrantRequest $app.appId
        for ($i = 1; ; $i++) {
            try { $perm = Invoke-G $t POST $g.Path $g.Body; break }
            catch { if ($i -ge 6) { throw "Grant failed after $i attempts. App exists (appId=$($app.appId)); re-run -Phase GrantList. $_" }; Start-Sleep -Seconds (10 * $i) }
        }
        Write-Host "4/4 granted '$($perm.roles -join ',')' on $($Scope.ToLower())   permissionId=$($perm.id)" -ForegroundColor Green
        Write-Host "`nNEXT: -Phase Verify -AppId $($app.appId) -TenantId <tid> -SiteId $SiteId ..." -ForegroundColor Yellow
    }

    'CreateApp' {
        if (-not $CertPath) { throw '-CertPath (public certificate) is required.' }
        $cert = Read-PublicCert $CertPath
        if (-not $Apply) { Show-Plan POST '/applications' (Get-AppBody $cert "<role id for $RoleValue>"); break }
        $t = Get-OperatorToken 'Application.ReadWrite.All AppRoleAssignment.ReadWrite.All'
        $r = Get-RoleId $t
        $app = Invoke-G $t POST '/applications' (Get-AppBody $cert $r.RoleId)
        $sp = Invoke-G $t POST '/servicePrincipals' @{ appId = $app.appId; tags = @('WindowsAzureActiveDirectoryIntegratedApp') }
        $null = Invoke-G $t POST "/servicePrincipals/$($sp.id)/appRoleAssignedTo" @{ principalId = $sp.id; resourceId = $r.GraphSpId; appRoleId = $r.RoleId }
        Write-Host "`nCREATED  appId=$($app.appId)  objectId=$($app.id)  spId=$($sp.id)" -ForegroundColor Green
        Write-Host "Consent granted for $RoleValue only. Data access is still ZERO until GrantList."
    }

    'GrantList' {
        if (-not ($SiteId -and $AppId)) { throw '-SiteId and -AppId are required.' }
        if ($Scope -eq 'List' -and -not $ListId) { throw '-ListId is required with -Scope List.' }
        $g = Get-GrantRequest $AppId
        if (-not $Apply) { Show-Plan POST $g.Path $g.Body; break }
        $t = Get-OperatorToken 'Sites.FullControl.All'
        $perm = Invoke-G $t POST $g.Path $g.Body
        Write-Host "GRANTED  role=$($perm.roles -join ',')  permissionId=$($perm.id)" -ForegroundColor Green
        if ($Scope -eq 'List') { Write-Host 'Note: a list-level grant BREAKS permission inheritance on this library. Re-check staff access now.' }
    }

    'Verify' {
        $need = @('SiteId', 'AppId', 'TenantId', 'CertPemPath', 'KeyPemPath') + (($Scope -eq 'List') ? @('ListId') : @())
        foreach ($v in $need) { if (-not (Get-Variable $v -ValueOnly)) { throw "-$v is required." } }
        $cert = [Security.Cryptography.X509Certificates.X509Certificate2]::CreateFromPemFile($CertPemPath, $KeyPemPath)
        $b64u = { param($b) [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        $aud = "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token"
        $hdr = & $b64u ([Text.Encoding]::UTF8.GetBytes((@{ alg = 'RS256'; typ = 'JWT'; x5t = (& $b64u $cert.GetCertHash()) } | ConvertTo-Json -Compress)))
        $pay = & $b64u ([Text.Encoding]::UTF8.GetBytes((@{ aud = $aud; iss = $AppId; sub = $AppId; jti = [guid]::NewGuid().ToString(); nbf = $now; exp = $now + 300 } | ConvertTo-Json -Compress)))
        $sig = & $b64u ([Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert).SignData([Text.Encoding]::ASCII.GetBytes("$hdr.$pay"), 'SHA256', [Security.Cryptography.RSASignaturePadding]::Pkcs1))
        $t = (Invoke-RestMethod -Method Post -Uri $aud -Body @{
                client_id = $AppId; scope = 'https://graph.microsoft.com/.default'; grant_type = 'client_credentials'
                client_assertion_type = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'; client_assertion = "$hdr.$pay.$sig" }).access_token

        $results = [Collections.Generic.List[object]]::new()
        # A call may return the string 'empty' to mean "200, but nothing visible", which counts as denied.
        function Test-Call([string]$Name, [string]$Expect, [scriptblock]$Call) {
            try { $out = & $Call; $got = ($out -is [string] -and $out -eq 'empty') ? 'denied (200, empty)' : 'allowed' }
            catch { $code = [int]$_.Exception.Response.StatusCode; $got = ($code -in 401, 403, 404) ? "denied ($code)" : "error ($code)" }
            $pass = ($Expect -eq 'allowed') ? ($got -eq 'allowed') : ($got -like 'denied*')
            $results.Add([pscustomobject]@{ Test = $Name; Expected = $Expect; Got = $got; Result = $pass ? 'PASS' : 'FAIL' })
        }
        $probe = "boundary-probe-$(Get-Date -Format yyyyMMddHHmmss).txt"
        $d = Get-GrantedDrivePath
        Test-Call 'Read granted library'        allowed { Invoke-G $t GET "$d/root/children" }
        Test-Call 'Write granted library'       allowed { Invoke-RestMethod -Method Put -Uri "$Graph$d/root:/$($probe):/content" -Headers @{ Authorization = "Bearer $t" } -Body 'probe' -ContentType 'text/plain' }
        Test-Call 'Delete own probe file'       allowed { Invoke-G $t DELETE "$d/root:/$($probe)" }
        if ($ControlSiteId) { Test-Call 'Read a DIFFERENT site'  denied { Invoke-G $t GET "/sites/$ControlSiteId/drive/root/children" } }
        if ($ControlListId) { Test-Call 'Read OTHER library, same site' denied { Invoke-G $t GET "/sites/$SiteId/lists/$ControlListId/drive/root/children" } }
        if ($Scope -eq 'List') { Test-Call 'Read site root library' denied { Invoke-G $t GET "/sites/$SiteId/drive/root/children" } }
        Test-Call 'Read tenant root site'       denied  { Invoke-G $t GET '/sites/root/drive/root/children' }
        Test-Call 'Search all sites'            denied  { $r = Invoke-G $t GET '/sites?search=*'; if (@($r.value).Count -eq 0) { 'empty' } }
        Test-Call 'List users'                  denied  { Invoke-G $t GET '/users?$top=1' }
        Test-Call 'List groups / Teams'         denied  { Invoke-G $t GET '/groups?$top=1' }
        $results | Format-Table -AutoSize | Out-String | Write-Host
        $fails = @($results | Where-Object Result -eq 'FAIL').Count
        Write-Host ($fails ? "BOUNDARY CHECK FAILED ($fails). Do not hand this identity to anyone." : 'BOUNDARY CHECK PASSED.') -ForegroundColor ($fails ? 'Red' : 'Green')
    }

    'Disable' {
        if (-not $AppId) { throw '-AppId is required.' }
        if (-not $Apply) { Show-Plan PATCH "/servicePrincipals(appId='$AppId')" @{ accountEnabled = $false }; break }
        $t = Get-OperatorToken 'Application.ReadWrite.All'
        $null = Invoke-G $t PATCH "/servicePrincipals(appId='$AppId')" @{ accountEnabled = $false }
        Write-Host 'DISABLED. New tokens refused; tokens already issued expire within ~1 hour.' -ForegroundColor Green
    }

    'Revoke' {
        if (-not ($SiteId -and $AppId)) { throw '-SiteId and -AppId are required.' }
        if ($Scope -eq 'List' -and -not $ListId) { throw '-ListId is required with -Scope List.' }
        $base = ($Scope -eq 'Site') ? "/sites/$SiteId/permissions" : "/sites/$SiteId/lists/$ListId/permissions"
        $t = Get-OperatorToken 'Sites.FullControl.All'
        $perms = (Invoke-G $t GET $base).value |
            Where-Object { $_.grantedToV2.application.id -eq $AppId -or $_.grantedToIdentitiesV2.application.id -contains $AppId -or $_.grantedToIdentities.application.id -contains $AppId }
        if (-not $perms) { Write-Host 'No grant for that app found here.'; break }
        foreach ($p in $perms) {
            if (-not $Apply) { Show-Plan DELETE "$base/$($p.id)"; continue }
            Invoke-G $t DELETE "$base/$($p.id)"
            Write-Host "REVOKED permission $($p.id)" -ForegroundColor Green
        }
    }
}
