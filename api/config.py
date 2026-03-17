import os

DATABASE_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
STATEMENT_TIMEOUT = os.environ.get("STATEMENT_TIMEOUT", "10s")
ROW_LIMIT = int(os.environ.get("ROW_LIMIT", "10000"))
