import json
import os
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from api.middleware.cf_access import CloudflareAccessMiddleware
from ripple.api.db import ensure_schema, get_connection
from ripple.api.models.schemas import ChatFeedback, ChatRequest, CorpusStatus
from ripple.api.services.doc_retriever import generate_answer_stream, search_docs

app = FastAPI(title="Ripple — Splashworks Knowledge Agent")

# CORS (registered first in source order so it executes AFTER auth on request path —
# Starlette reverses middleware order)
ALLOWED_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "https://ripple.splshwrks.com",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Cloudflare Access JWT validation (registered after CORS in source order,
# which means it executes BEFORE CORS on the request path).
# fail_closed=True in Docker (production/staging) — rejects all requests if auth is misconfigured.
# fail_closed=False locally — allows development without Cloudflare credentials.
_in_docker = os.path.exists("/.dockerenv")
app.add_middleware(
    CloudflareAccessMiddleware,
    aud=os.environ.get("CF_ACCESS_AUD", ""),
    team_domain=os.environ.get("CF_ACCESS_TEAM_DOMAIN", ""),
    fail_closed=_in_docker,
)


@app.on_event("startup")
def on_startup():
    ensure_schema()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ripple"}


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Main chat endpoint — retrieves docs and streams a response via SSE."""
    message_id = str(uuid.uuid4())

    async def event_generator():
        # Search for relevant chunks
        chunks = search_docs(request.message)

        if not chunks:
            yield {
                "event": "error",
                "data": json.dumps(
                    {"error": "No relevant documents found. The corpus may not be indexed yet."}
                ),
            }
            return

        # Send sources
        sources = [
            {
                "file": c["source_file"],
                "heading": c["heading"],
                "similarity": round(c["similarity"], 3),
            }
            for c in chunks[:5]  # Top 5 sources for display
        ]
        yield {
            "event": "sources",
            "data": json.dumps({"sources": sources}),
        }

        # Stream the answer
        for token in generate_answer_stream(request.message, chunks):
            yield {
                "event": "token",
                "data": json.dumps({"content": token}),
            }

        yield {
            "event": "done",
            "data": json.dumps({"message_id": message_id}),
        }

    return EventSourceResponse(event_generator())


@app.post("/api/chat/feedback")
def feedback(fb: ChatFeedback):
    """Store feedback on a response (Phase 2 — stores to DB)."""
    # For now, just acknowledge. DB storage comes in Phase 2.
    return {"status": "received", "message_id": fb.message_id}


@app.get("/api/corpus/status")
def corpus_status() -> CorpusStatus:
    """Return indexing status."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(DISTINCT source_file), COUNT(*) FROM ripple.doc_chunks")
            files, chunks = cur.fetchone()
            cur.execute("SELECT MAX(indexed_at) FROM ripple.doc_chunks")
            last_indexed = cur.fetchone()[0]
    finally:
        conn.close()

    return CorpusStatus(
        total_files=files,
        total_chunks=chunks,
        last_indexed_at=str(last_indexed) if last_indexed else None,
    )
