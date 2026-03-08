# Cloudflare Access Authentication — Design

## Goal

Protect `app.splshwrks.com` and `api.splshwrks.com` behind Cloudflare Access so customer data is not exposed to the public internet.

## Architecture

Cloudflare Access sits at the network edge, in front of the existing Cloudflare Tunnel (`splashworks-warehouse`). Unauthenticated requests are redirected to a Cloudflare-hosted login page. After authentication, Cloudflare injects a signed JWT (`CF-Authorization` cookie) and proxies the request through the tunnel to the Docker containers on the VPS. No application code changes required.

## What We Configure

1. **Access Application** — covers both `app.splshwrks.com` and `api.splshwrks.com`
2. **Login Methods** — GitHub OAuth + Google OAuth + email OTP (fallback)
3. **Access Policy** — allow specific email addresses only
4. **Session Duration** — 24 hours (re-auth daily)

### Initial Allowed Users

| Email | Provider |
|-------|----------|
| mail@ross-sivertsen.com | GitHub |
| ross.sivertsen@gmail.com | Google |

Additional users can be added via the Cloudflare Zero Trust dashboard under Access > Applications > policy.

## What We Do NOT Change

- No frontend code changes
- No backend code changes
- No Docker or nginx changes
- No tunnel configuration changes

## Configuration Steps

All configuration is done in the Cloudflare Zero Trust dashboard (https://one.dash.cloudflare.com/):

1. **Zero Trust > Settings > Authentication > Login Methods**
   - Add "GitHub" identity provider (OAuth, no config needed)
   - Add "Google" identity provider (OAuth, no config needed)
   - "One-time PIN" is enabled by default

2. **Zero Trust > Access > Applications > Add an Application**
   - Type: Self-hosted
   - Application name: "Splashworks Warehouse"
   - Session duration: 24 hours
   - Application domain 1: `app.splshwrks.com`
   - Application domain 2: `api.splshwrks.com`

3. **Policy: Allow Authorized Users**
   - Policy name: "Authorized Users"
   - Action: Allow
   - Include rule: Emails — `mail@ross-sivertsen.com`, `ross.sivertsen@gmail.com`

## Testing Plan

1. Open `app.splshwrks.com` in incognito — should see Cloudflare login page
2. Login with GitHub — should redirect to the app
3. Logout, login with Google — should also work
4. Unauthenticated `curl https://api.splshwrks.com/api/health` — should get 302 redirect (not 200)
5. Verify normal app usage works after login (API calls carry `CF-Authorization` cookie automatically)

## Adding More Users Later

In Cloudflare Zero Trust dashboard:
- Access > Applications > "Splashworks Warehouse" > Policies
- Edit the "Authorized Users" policy
- Add email addresses to the Include rule

## Security Notes

- Requests never reach the VPS unless authenticated at Cloudflare's edge
- The tunnel only accepts traffic from Cloudflare — direct IP access to the VPS is not exposed
- `CF-Authorization` JWT is signed by Cloudflare and scoped to the Access application
- CORS (`allow_origins=["*"]`) in FastAPI is safe because Cloudflare Access blocks unauthenticated requests before they reach the origin
