import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://splashworks:changeme@localhost:5432/splashworks",
)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
STATEMENT_TIMEOUT = os.environ.get("STATEMENT_TIMEOUT", "10s")
ROW_LIMIT = int(os.environ.get("ROW_LIMIT", "10000"))
