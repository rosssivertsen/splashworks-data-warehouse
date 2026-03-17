# Cloudflare Access JWT Validation (IN-5) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a FastAPI middleware that validates Cloudflare Access JWTs on every request (except `/api/health` and `OPTIONS`), extracting verified user email from JWT claims instead of a spoofable header.

**Architecture:** A Starlette middleware (`api/middleware/cf_access.py`) validates RS256-signed JWTs against Cloudflare's JWKS public keys (cached in-memory with 5-min TTL). Disabled when `CF_ACCESS_AUD` is unset (local dev/tests). Integrated into existing audit logging via `request.state.cf_user_email`.

**Tech Stack:** PyJWT[crypto], FastAPI/Starlette middleware, urllib for JWKS fetch

**Spec:** `docs/superpowers/specs/2026-03-17-cloudflare-jwt-auth-design.md`
**Branch:** `feature/in-5-cf-jwt-auth`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `api/middleware/__init__.py` | Create | Empty package init |
| `api/middleware/cf_access.py` | Create | JWKS cache, JWT validation, Starlette middleware |
| `api/tests/unit/test_cf_access_middleware.py` | Create | 13 unit tests for middleware |
| `api/config.py` | Modify | Add CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD |
| `api/main.py` | Modify | Register middleware (before CORS) |
| `api/routers/query.py` | Modify | Read email from request.state instead of header |
| `api/requirements.txt` | Modify | Add PyJWT[crypto] |
| `docker-compose.yml` | Modify | Pass CF_ACCESS_* env vars to API |
| `docker-compose.staging.yml` | Modify | Pass CF_ACCESS_* env vars to staging API |
| `.env.example` | Modify | Document new env vars |

---

## Task 1: Config + dependencies

**Files:**
- Modify: `api/config.py`
- Modify: `api/requirements.txt`
- Create: `api/middleware/__init__.py`

- [ ] **Step 1: Add config variables**

Add to `api/config.py`:

```python
CF_ACCESS_TEAM_DOMAIN = os.environ.get("CF_ACCESS_TEAM_DOMAIN", "")
CF_ACCESS_AUD = os.environ.get("CF_ACCESS_AUD", "")
```

- [ ] **Step 2: Add PyJWT to requirements**

Add to `api/requirements.txt`:

```
PyJWT[crypto]>=2.8.0
```

- [ ] **Step 3: Create middleware package**

Create empty `api/middleware/__init__.py`.

- [ ] **Step 4: Install locally and verify import**

```bash
pip install "PyJWT[crypto]>=2.8.0"
python -c "import jwt; print(jwt.__version__)"
```

Expected: version number printed, no errors.

- [ ] **Step 5: Commit**

```bash
git add api/config.py api/requirements.txt api/middleware/__init__.py
git commit -m "feat(IN-5): add CF Access config vars and PyJWT dependency"
```

---

## Task 2: Middleware — tests first

**Files:**
- Create: `api/middleware/cf_access.py`
- Create: `api/tests/unit/test_cf_access_middleware.py`

- [ ] **Step 1: Write all tests**

Create `api/tests/unit/test_cf_access_middleware.py`:

```python
"""Tests for the Cloudflare Access JWT validation middleware."""

import json
import time
from unittest.mock import MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import JSONResponse

from api.middleware.cf_access import CloudflareAccessMiddleware, _jwks_cache

# --- Test key pair (RS256) ---

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_public_key = _private_key.public_key()
_public_pem = _public_key.public_bytes(
    serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
)

TEAM_DOMAIN = "testteam"
AUD = "test-audience-tag-1234567890abcdef"
ISS = f"https://{TEAM_DOMAIN}.cloudflareaccess.com"


def _make_jwt(email="user@test.com", aud=AUD, iss=ISS, exp_offset=3600, **extra):
    payload = {
        "email": email,
        "aud": [aud],
        "iss": iss,
        "exp": int(time.time()) + exp_offset,
        "iat": int(time.time()),
        "sub": "test-user-id",
        **extra,
    }
    return jwt.encode(payload, _private_key, algorithm="RS256")


def _make_app(aud=AUD, team_domain=TEAM_DOMAIN):
    """Create a test FastAPI app with the CF Access middleware."""
    app = FastAPI()
    app.add_middleware(CloudflareAccessMiddleware, aud=aud, team_domain=team_domain)

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    @app.get("/api/prompts")
    async def prompts(request: Request):
        return {"email": getattr(request.state, "cf_user_email", None)}

    return app


@pytest.fixture
def mock_jwks():
    """Patch JWKS fetch to return our test public key."""
    from jwt import algorithms
    pub_numbers = _public_key.public_numbers()
    jwk = algorithms.RSAAlgorithm.to_jwk(_public_key, as_dict=True)
    jwk["kid"] = "test-key-id"
    jwk["use"] = "sig"
    jwk["alg"] = "RS256"

    jwks_response = json.dumps({"keys": [jwk], "public_cert": {"kid": "test-key-id"}, "public_certs": []}).encode()

    with patch("api.middleware.cf_access._fetch_jwks_raw") as mock_fetch:
        mock_fetch.return_value = jwks_response
        # Clear cache before each test
        _jwks_cache.clear()
        yield mock_fetch


class TestCFAccessMiddleware:
    def test_valid_jwt_passes(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        token = _make_jwt()
        resp = client.get("/api/prompts", cookies={"CF_Authorization": token})
        assert resp.status_code == 200
        assert resp.json()["email"] == "user@test.com"

    def test_expired_jwt_returns_401(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        token = _make_jwt(exp_offset=-3600)  # expired 1 hour ago
        resp = client.get("/api/prompts", cookies={"CF_Authorization": token})
        assert resp.status_code == 401

    def test_wrong_audience_returns_401(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        token = _make_jwt(aud="wrong-audience")
        resp = client.get("/api/prompts", cookies={"CF_Authorization": token})
        assert resp.status_code == 401

    def test_wrong_issuer_returns_401(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        token = _make_jwt(iss="https://evil.cloudflareaccess.com")
        resp = client.get("/api/prompts", cookies={"CF_Authorization": token})
        assert resp.status_code == 401

    def test_invalid_signature_returns_401(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        # Sign with a different key
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        payload = {"email": "user@test.com", "aud": [AUD], "iss": ISS,
                   "exp": int(time.time()) + 3600, "iat": int(time.time())}
        token = jwt.encode(payload, other_key, algorithm="RS256")
        resp = client.get("/api/prompts", cookies={"CF_Authorization": token})
        assert resp.status_code == 401

    def test_missing_jwt_returns_401(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        resp = client.get("/api/prompts")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Authentication required"

    def test_malformed_jwt_returns_401(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        resp = client.get("/api/prompts", cookies={"CF_Authorization": "not-a-jwt"})
        assert resp.status_code == 401

    def test_health_bypasses_auth(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        resp = client.get("/api/health")  # no token
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_options_bypasses_auth(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        resp = client.options("/api/prompts")  # no token, OPTIONS method
        assert resp.status_code != 401

    def test_disabled_when_aud_empty(self):
        """When aud is empty, middleware is disabled — all requests pass."""
        app = _make_app(aud="", team_domain="")
        client = TestClient(app)
        resp = client.get("/api/prompts")  # no token
        assert resp.status_code == 200
        assert resp.json()["email"] is None

    def test_bearer_header_fallback(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        token = _make_jwt()
        resp = client.get("/api/prompts", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "user@test.com"

    def test_jwks_fetch_failure_no_cache_returns_503(self):
        """When JWKS fetch fails and no cache exists, return 503."""
        with patch("api.middleware.cf_access._fetch_jwks_raw") as mock_fetch:
            mock_fetch.side_effect = Exception("Network error")
            _jwks_cache.clear()
            app = _make_app()
            client = TestClient(app)
            token = _make_jwt()
            resp = client.get("/api/prompts", cookies={"CF_Authorization": token})
            assert resp.status_code == 503

    def test_jwks_fetch_failure_uses_stale_cache(self, mock_jwks):
        """When JWKS fetch fails but stale cache exists, requests still succeed."""
        app = _make_app()
        client = TestClient(app)
        token = _make_jwt()
        # First request populates cache
        resp = client.get("/api/prompts", cookies={"CF_Authorization": token})
        assert resp.status_code == 200
        # Now make fetch fail and expire the cache
        mock_jwks.side_effect = Exception("Network error")
        _jwks_cache["fetched_at"] = 0
        # Second request should still work via stale cache
        token2 = _make_jwt()
        resp2 = client.get("/api/prompts", cookies={"CF_Authorization": token2})
        assert resp2.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
DATABASE_URL="postgresql://test:test@localhost:5432/test" python -m pytest api/tests/unit/test_cf_access_middleware.py -v
```

Expected: `ModuleNotFoundError: No module named 'api.middleware.cf_access'`

- [ ] **Step 3: Write the middleware implementation**

Create `api/middleware/cf_access.py`:

```python
"""Cloudflare Access JWT validation middleware.

Validates the CF-Authorization cookie (or Authorization: Bearer header)
against Cloudflare's JWKS public keys. Extracts verified email into
request.state.cf_user_email.

Disabled when CF_ACCESS_AUD is empty (local dev / tests).
"""

import json
import logging
import threading
import time
import urllib.request

import jwt

logger = logging.getLogger(__name__)

# Module-level JWKS cache (cleared in tests via _jwks_cache.clear())
_jwks_cache = {"keys": None, "fetched_at": 0.0}
_jwks_lock = threading.Lock()
_JWKS_TTL = 300  # 5 minutes
_JWKS_TIMEOUT = 5  # seconds


def _fetch_jwks_raw(url: str) -> bytes:
    """Fetch raw JWKS JSON from Cloudflare. Separated for testability."""
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=_JWKS_TIMEOUT) as resp:
        return resp.read()


def _get_jwks(team_domain: str) -> list[dict] | None:
    """Get JWKS keys, using cache with TTL and stampede protection."""
    now = time.time()

    # Fast path: cache is fresh
    if _jwks_cache["keys"] and (now - _jwks_cache["fetched_at"]) < _JWKS_TTL:
        return _jwks_cache["keys"]

    # Slow path: try to refresh (only one thread at a time)
    acquired = _jwks_lock.acquire(blocking=False)
    if not acquired:
        # Another thread is refreshing; use stale cache if available
        return _jwks_cache["keys"]

    try:
        url = f"https://{team_domain}.cloudflareaccess.com/cdn-cgi/access/certs"
        raw = _fetch_jwks_raw(url)
        data = json.loads(raw)
        keys = data.get("keys", [])
        if keys:
            _jwks_cache["keys"] = keys
            _jwks_cache["fetched_at"] = now
            return keys
        logger.warning("JWKS response had no keys")
        return _jwks_cache["keys"]  # stale fallback
    except Exception:
        logger.exception("Failed to fetch JWKS from Cloudflare")
        return _jwks_cache["keys"]  # stale fallback (may be None)
    finally:
        _jwks_lock.release()


class CloudflareAccessMiddleware:
    """Starlette middleware for Cloudflare Access JWT validation."""

    def __init__(self, app, aud: str = "", team_domain: str = ""):
        self.app = app
        self.aud = aud
        self.team_domain = team_domain
        self.enabled = bool(aud and team_domain)
        if not self.enabled:
            logger.warning(
                "CF Access middleware DISABLED — CF_ACCESS_AUD or CF_ACCESS_TEAM_DOMAIN not set"
            )

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        from starlette.requests import Request
        from starlette.responses import JSONResponse

        request = Request(scope, receive)

        # Always set default
        request.state.cf_user_email = None

        # Disabled mode: passthrough
        if not self.enabled:
            await self.app(scope, receive, send)
            return

        # Exempt paths
        if request.url.path == "/api/health":
            await self.app(scope, receive, send)
            return

        # Exempt OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            await self.app(scope, receive, send)
            return

        # Extract token from cookie or Authorization header
        token = request.cookies.get("CF_Authorization")
        if not token:
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]

        if not token:
            resp = JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"},
            )
            await resp(scope, receive, send)
            return

        # Get JWKS
        keys = _get_jwks(self.team_domain)
        if not keys:
            resp = JSONResponse(
                status_code=503,
                content={"detail": "Auth service temporarily unavailable"},
            )
            await resp(scope, receive, send)
            return

        # Validate JWT
        expected_issuer = f"https://{self.team_domain}.cloudflareaccess.com"
        try:
            # Build public keys from JWKS
            public_keys = {}
            for key_data in keys:
                kid = key_data.get("kid")
                if kid:
                    public_keys[kid] = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)

            # Decode header to get kid
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
            key = public_keys.get(kid)

            if not key and public_keys:
                # If no kid match, try first key
                key = next(iter(public_keys.values()))

            if not key:
                raise jwt.InvalidTokenError("No matching key found")

            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=self.aud,
                issuer=expected_issuer,
            )

            request.state.cf_user_email = payload.get("email")

        except jwt.ExpiredSignatureError:
            logger.warning("CF Access JWT expired")
            resp = JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"},
            )
            await resp(scope, receive, send)
            return
        except jwt.InvalidTokenError as exc:
            logger.warning("CF Access JWT validation failed: %s", exc)
            resp = JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"},
            )
            await resp(scope, receive, send)
            return
        except Exception as exc:
            logger.exception("Unexpected error during JWT validation: %s", exc)
            resp = JSONResponse(
                status_code=500,
                content={"detail": "Internal authentication error"},
            )
            await resp(scope, receive, send)
            return

        await self.app(scope, receive, send)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
DATABASE_URL="postgresql://test:test@localhost:5432/test" python -m pytest api/tests/unit/test_cf_access_middleware.py -v
```

Expected: 13 passed

- [ ] **Step 5: Commit**

```bash
git add api/middleware/cf_access.py api/tests/unit/test_cf_access_middleware.py
git commit -m "feat(IN-5): add CF Access JWT middleware with tests"
```

---

## Task 3: Wire middleware into FastAPI app

**Files:**
- Modify: `api/main.py`
- Modify: `api/routers/query.py`

- [ ] **Step 1: Add middleware to main.py**

Add the middleware import and registration. Register CF Access **after** CORS in source order — Starlette reverses registration order, so CF Access executes **first** on the request path. This is correct: JWT check runs before CORS headers are added, and the OPTIONS bypass in the middleware handles preflight:

```python
# Add import at top:
from api.config import CF_ACCESS_AUD, CF_ACCESS_TEAM_DOMAIN
from api.middleware.cf_access import CloudflareAccessMiddleware

# Add AFTER the CORS middleware block:
app.add_middleware(
    CloudflareAccessMiddleware,
    aud=CF_ACCESS_AUD,
    team_domain=CF_ACCESS_TEAM_DOMAIN,
)
```

- [ ] **Step 2: Update `_cf_email()` in query.py**

Change the helper to read from `request.state` instead of the header:

```python
def _cf_email(request: Request) -> str | None:
    """Extract Cloudflare Access authenticated user email from validated JWT."""
    return getattr(request.state, "cf_user_email", None)
```

- [ ] **Step 3: Run full unit test suite**

```bash
DATABASE_URL="postgresql://test:test@localhost:5432/test" python -m pytest api/tests/unit/ -v
```

Expected: All tests pass (middleware disabled in test env because CF_ACCESS_AUD is not set).

- [ ] **Step 4: Commit**

```bash
git add api/main.py api/routers/query.py
git commit -m "feat(IN-5): wire CF Access middleware into app and query endpoints"
```

---

## Task 4: Docker Compose + env config

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.staging.yml`
- Modify: `.env.example`

- [ ] **Step 1: Update docker-compose.yml**

Add to the `api` service `environment` block:

```yaml
      CF_ACCESS_TEAM_DOMAIN: ${CF_ACCESS_TEAM_DOMAIN:-}
      CF_ACCESS_AUD: ${CF_ACCESS_AUD:-}
```

- [ ] **Step 2: Update docker-compose.staging.yml**

Add to the `staging-api` service `environment` block:

```yaml
      CF_ACCESS_TEAM_DOMAIN: ${CF_ACCESS_TEAM_DOMAIN:-}
      CF_ACCESS_AUD: ${CF_ACCESS_AUD:-}
```

- [ ] **Step 3: Update .env.example**

Add after the Cloudflare Tunnel section:

```
# Cloudflare Access (JWT validation — required for production API auth)
CF_ACCESS_TEAM_DOMAIN=<your-team-domain>
CF_ACCESS_AUD=<your-application-audience-tag>
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml docker-compose.staging.yml .env.example
git commit -m "feat(IN-5): add CF Access env vars to Docker Compose and .env.example"
```

---

## Task 5: Deploy to staging and test

- [ ] **Step 1: Push the feature branch**

```bash
git push -u origin feature/in-5-cf-jwt-auth
```

- [ ] **Step 2: Get the Cloudflare Access audience tag**

In Cloudflare dashboard: Zero Trust → Access → Applications → your app → Overview → Application Audience (AUD) Tag. Copy the 64-character hex string.

- [ ] **Step 3: Add env vars to VPS .env**

```bash
ssh root@76.13.29.44 "echo 'CF_ACCESS_TEAM_DOMAIN=splashworks' >> /opt/splashworks/.env && echo 'CF_ACCESS_AUD=<paste-the-aud-tag>' >> /opt/splashworks/.env"
```

- [ ] **Step 4: Deploy feature branch to staging**

```bash
ssh root@76.13.29.44 "cd /opt/splashworks && git fetch origin && git checkout feature/in-5-cf-jwt-auth && docker compose -f docker-compose.staging.yml up -d --build staging-api"
```

- [ ] **Step 5: Verify staging**

```bash
# Health should work without auth
ssh root@76.13.29.44 'curl -s http://localhost:8081/api/health | python3 -m json.tool'

# Prompts should return 401 without auth
ssh root@76.13.29.44 'curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/api/prompts'
```

Expected: health returns 200, prompts returns 401.

- [ ] **Step 6: Test through Cloudflare (browser)**

Navigate to `https://staging-app.splshwrks.com` — log in via Cloudflare Access and verify the app works normally (queries execute, audit log captures email).

- [ ] **Step 7: Open PR**

```bash
gh pr create --title "feat(IN-5): Cloudflare Access JWT validation middleware" --body "$(cat <<'EOF'
## Summary
- Adds FastAPI middleware that validates Cloudflare Access JWTs on every request (except /api/health and OPTIONS)
- Extracts verified user email from JWT claims (not spoofable header)
- JWKS public keys cached in-memory with 5-min TTL, stampede protection, stale fallback
- Disabled when CF_ACCESS_AUD is unset (local dev / tests)
- Rate limits: 20/min on /api/query, 30/min on /api/query/raw (existing)

## Test plan
- [ ] 12 unit tests pass locally
- [ ] Health endpoint returns 200 without auth on staging
- [ ] /api/prompts returns 401 without auth on staging
- [ ] App works normally through Cloudflare Access on staging
- [ ] Audit log captures JWT-verified email

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
