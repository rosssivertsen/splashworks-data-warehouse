from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import health, query, schema

app = FastAPI(title="Splashworks Warehouse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(query.router)
app.include_router(schema.router)
