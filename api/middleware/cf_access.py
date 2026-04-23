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

# Module-level JWKS cache (reset in tests via _jwks_cache.clear())
_jwks_cache = {"keys": None, "fetched_at": 0.0}


def _reset_cache():
    """Reset cache to initial state. Used by tests."""
    _jwks_cache["keys"] = None
    _jwks_cache["fetched_at"] = 0.0
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

    # Slow path: refresh keys
    # On cold start (no cache), block and wait so we don't 503 concurrent requests.
    # On warm refresh (stale cache exists), non-blocking — others use stale cache.
    is_cold_start = _jwks_cache["keys"] is None
    acquired = _jwks_lock.acquire(blocking=is_cold_start)
    if not acquired:
        # Another thread is refreshing; use stale cache
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

    def __init__(self, app, aud: str = "", team_domain: str = "", fail_closed: bool = False):
        self.app = app
        self.aud = aud
        self.team_domain = team_domain
        self.enabled = bool(aud and team_domain)
        self.fail_closed = fail_closed
        if not self.enabled:
            if self.fail_closed:
                logger.error(
                    "CF Access middleware FAIL-CLOSED — CF_ACCESS_AUD or CF_ACCESS_TEAM_DOMAIN not set. "
                    "All non-exempt requests will be rejected."
                )
            else:
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

        # Disabled mode: passthrough (local dev) or fail-closed (production misconfig)
        if not self.enabled:
            if self.fail_closed:
                # Exempt health even when fail-closed
                if request.url.path == "/api/health" or request.method == "OPTIONS":
                    await self.app(scope, receive, send)
                    return
                resp = JSONResponse(
                    status_code=503,
                    content={"detail": "Authentication not configured"},
                )
                await resp(scope, receive, send)
                return
            await self.app(scope, receive, send)
            return

        # Health endpoint: try to validate JWT if present, but always allow through
        if request.url.path == "/api/health":
            token = request.cookies.get("CF_Authorization")
            if not token:
                auth_header = request.headers.get("authorization", "")
                if auth_header.startswith("Bearer "):
                    token = auth_header[7:]
            if not token:
                token = request.headers.get("cf-access-jwt-assertion", "")
            if token:
                try:
                    keys = _get_jwks(self.team_domain)
                    if keys:
                        expected_issuer = f"https://{self.team_domain}.cloudflareaccess.com"
                        public_keys = {}
                        for key_data in keys:
                            kid = key_data.get("kid")
                            if kid:
                                public_keys[kid] = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
                        unverified_header = jwt.get_unverified_header(token)
                        kid = unverified_header.get("kid")
                        key = public_keys.get(kid)
                        if not key and public_keys:
                            key = next(iter(public_keys.values()))
                        if key:
                            payload = jwt.decode(
                                token, key, algorithms=["RS256"],
                                audience=self.aud, issuer=expected_issuer,
                            )
                            request.state.cf_user_email = payload.get("email")
                    else:
                        logger.warning("Health JWT present but JWKS fetch returned empty; enriched data suppressed")
                except jwt.ExpiredSignatureError:
                    logger.warning("Health JWT expired; enriched data suppressed")
                except jwt.InvalidTokenError as exc:
                    logger.warning("Health JWT invalid: %s; enriched data suppressed", exc)
                except Exception as exc:
                    logger.warning("Health JWT validation unexpected error: %s; enriched data suppressed", exc)
            await self.app(scope, receive, send)
            return

        # Exempt OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            await self.app(scope, receive, send)
            return

        # Extract token from cookie, Authorization header, or CF header
        token = request.cookies.get("CF_Authorization")
        if not token:
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
        if not token:
            token = request.headers.get("cf-access-jwt-assertion", "")

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
