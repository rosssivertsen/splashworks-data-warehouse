import logging

import psycopg2
from fastapi import APIRouter, Request

from api.config import DATABASE_URL
from api.models.responses import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/health", response_model=HealthResponse)
def health(request: Request):
    # Authenticated users get full details; unauthenticated get minimal status
    is_authenticated = bool(getattr(request.state, "cf_user_email", None))

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Simple connectivity check (always)
        cur.execute("SELECT 1")

        if is_authenticated:
            # Last ETL run
            cur.execute("""
                SELECT extract_date, sum(row_count)
                FROM public.etl_load_log
                WHERE status = 'completed'
                GROUP BY extract_date
                ORDER BY extract_date DESC
                LIMIT 1
            """)
            row = cur.fetchone()
            last_date = str(row[0]) if row else None
            last_rows = int(row[1]) if row else None

            # Schema object counts
            cur.execute("""
                SELECT schemaname, count(*)
                FROM (
                    SELECT schemaname FROM pg_tables
                    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                    UNION ALL
                    SELECT schemaname FROM pg_views
                    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                ) x
                GROUP BY schemaname ORDER BY schemaname
            """)
            schemas = {r[0]: r[1] for r in cur.fetchall()}
        else:
            last_date = None
            last_rows = None
            schemas = {}

        cur.close()
        conn.close()

        return HealthResponse(
            status="healthy",
            postgres="connected",
            last_etl_date=last_date,
            last_etl_rows=last_rows,
            schemas=schemas,
        )
    except Exception:
        logger.exception("Health check failed")
        return HealthResponse(
            status="unhealthy",
            postgres="unavailable",
            last_etl_date=None,
            last_etl_rows=None,
            schemas={},
        )
