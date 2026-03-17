import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import health, query, schema

app = FastAPI(title="Splashworks Warehouse API")

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
