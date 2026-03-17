"""Tests for the Cloudflare Access JWT validation middleware."""

import json
import time
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from api.middleware.cf_access import CloudflareAccessMiddleware, _jwks_cache, _reset_cache

# --- Test key pair (RS256) ---

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_public_key = _private_key.public_key()

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
    jwk = jwt.algorithms.RSAAlgorithm.to_jwk(_public_key, as_dict=True)
    jwk["kid"] = "test-key-id"
    jwk["use"] = "sig"
    jwk["alg"] = "RS256"

    jwks_response = json.dumps({"keys": [jwk]}).encode()

    with patch("api.middleware.cf_access._fetch_jwks_raw") as mock_fetch:
        mock_fetch.return_value = jwks_response
        _reset_cache()
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
        token = _make_jwt(exp_offset=-3600)
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
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_options_bypasses_auth(self, mock_jwks):
        app = _make_app()
        client = TestClient(app)
        resp = client.options("/api/prompts")
        assert resp.status_code != 401

    def test_disabled_when_aud_empty(self):
        """When aud is empty, middleware is disabled — all requests pass."""
        app = _make_app(aud="", team_domain="")
        client = TestClient(app)
        resp = client.get("/api/prompts")
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
            _reset_cache()
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
