import re

import psycopg2
import psycopg2.extras
import psycopg2.pool

from api.config import DATABASE_URL, ROW_LIMIT, STATEMENT_TIMEOUT

# Lazy connection pool: initialized on first use
_pool = None


def _get_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.SimpleConnectionPool(1, 10, DATABASE_URL)
    return _pool

PROHIBITED_KEYWORDS = re.compile(
    r'\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE)\b',
    re.IGNORECASE,
)


def validate_sql(sql: str | None) -> str | None:
    """Validate that SQL is a safe SELECT query.

    Returns None if valid, or an error message string if invalid.
    """
    if not sql or not sql.strip():
        return "Empty query"

    stripped = sql.strip().rstrip(";").strip()

    # Must start with SELECT or WITH (CTE)
    if not re.match(r'^(SELECT|WITH)\b', stripped, re.IGNORECASE):
        return "Query type not allowed — only SELECT queries are permitted"

    # Reject dollar-quoting (Postgres feature that can bypass string removal)
    if re.search(r'\$[a-zA-Z_]*\$', stripped):
        return "Dollar-quoted strings are not allowed"

    # Remove single-quoted strings (handle escaped quotes '' correctly)
    no_strings = re.sub(r"'(?:[^']|'')*'", "''", stripped)

    if PROHIBITED_KEYWORDS.search(no_strings):
        return "Prohibited keyword detected — only SELECT queries are allowed"

    # Check for multi-statement (semicolons outside quotes)
    if ";" in no_strings:
        return "Multi-statement queries are not allowed"

    return None


def execute_query(sql: str, database_url: str = None) -> tuple[list[str], list[list]]:
    """Execute a validated SELECT query against Postgres.

    Applies statement timeout and row limit guardrails.
    Returns (column_names, rows).
    """
    # Use pool for default URL, direct connect for custom URLs (tests)
    if database_url is not None:
        conn = psycopg2.connect(database_url)
        return_to_pool = False
    else:
        conn = _get_pool().getconn()
        return_to_pool = True

    try:
        cur = conn.cursor()
        cur.execute("SET statement_timeout = %s", (STATEMENT_TIMEOUT,))

        # Wrap in row limit
        limited_sql = f"SELECT * FROM ({sql.rstrip(';')}) sub LIMIT {ROW_LIMIT}"
        cur.execute(limited_sql)

        columns = [desc[0] for desc in cur.description]
        rows = [list(row) for row in cur.fetchall()]

        cur.close()
        return columns, rows
    finally:
        if return_to_pool:
            _get_pool().putconn(conn)
        else:
            conn.close()
