import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from api.rate_limit import limiter
from api.routers import health, query, schema

app = FastAPI(title="Splashworks Warehouse API")

# Rate limiting
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down."},
    )


# CORS
ALLOWED_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "https://app.splshwrks.com,https://staging-app.splshwrks.com",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(health.router)
app.include_router(query.router)
app.include_router(schema.router)
