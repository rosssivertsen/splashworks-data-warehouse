import os

import psycopg2
from pgvector.psycopg2 import register_vector


def get_connection():
    """Get a database connection with pgvector support."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    register_vector(conn)
    return conn


def ensure_schema():
    """Create the ripple schema and doc_chunks table if they don't exist."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
            cur.execute("CREATE SCHEMA IF NOT EXISTS ripple")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS ripple.doc_chunks (
                    id              SERIAL PRIMARY KEY,
                    source_file     TEXT NOT NULL,
                    chunk_index     INTEGER NOT NULL,
                    heading         TEXT,
                    content         TEXT NOT NULL,
                    embedding       vector(1536),
                    doc_type        TEXT NOT NULL,
                    entity          TEXT,
                    checksum        TEXT NOT NULL,
                    indexed_at      TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(source_file, chunk_index)
                )
            """)
            # Create index if it doesn't exist
            cur.execute("""
                SELECT 1 FROM pg_indexes
                WHERE schemaname = 'ripple' AND indexname = 'doc_chunks_embedding_idx'
            """)
            if cur.fetchone() is None:
                cur.execute("""
                    CREATE INDEX doc_chunks_embedding_idx
                    ON ripple.doc_chunks USING ivfflat (embedding vector_cosine_ops)
                    WITH (lists = 10)
                """)
            conn.commit()
    finally:
        conn.close()
