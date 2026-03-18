import os

import anthropic
import numpy as np

from ripple.api.db import get_connection
from ripple.api.services.embeddings import embed_text

_client: anthropic.Anthropic | None = None

HAIKU_MODEL = "claude-haiku-4-5-20251001"
TOP_K = 8


def _get_anthropic() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def search_docs(query: str, top_k: int = TOP_K) -> list[dict]:
    """Search doc_chunks by cosine similarity. Returns top-k results."""
    query_embedding = embed_text(query)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT source_file, heading, content, doc_type, entity,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM ripple.doc_chunks
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (query_embedding, query_embedding, top_k),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {
            "source_file": row[0],
            "heading": row[1],
            "content": row[2],
            "doc_type": row[3],
            "entity": row[4],
            "similarity": float(row[5]),
        }
        for row in rows
    ]


def generate_answer(question: str, chunks: list[dict]) -> str:
    """Generate an answer from retrieved chunks using Haiku."""
    context = "\n\n---\n\n".join(
        f"Source: {c['source_file']}"
        + (f" > {c['heading']}" if c["heading"] else "")
        + f"\n{c['content']}"
        for c in chunks
    )

    client = _get_anthropic()
    response = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=1024,
        system=(
            "You are Ripple, a knowledge assistant for Splashworks — a pool service company. "
            "Answer questions using ONLY the provided context. "
            "Be concise and accurate. Cite your sources by filename. "
            "If the context doesn't contain enough information, say so honestly."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Context:\n{context}\n\n---\n\n"
                    f"Question: {question}\n\n"
                    "Answer the question based on the context above. "
                    "Cite sources in parentheses, e.g. (customer.md)."
                ),
            }
        ],
    )
    return response.content[0].text


def generate_answer_stream(question: str, chunks: list[dict]):
    """Stream an answer from retrieved chunks using Haiku. Yields text deltas."""
    context = "\n\n---\n\n".join(
        f"Source: {c['source_file']}"
        + (f" > {c['heading']}" if c["heading"] else "")
        + f"\n{c['content']}"
        for c in chunks
    )

    client = _get_anthropic()
    with client.messages.stream(
        model=HAIKU_MODEL,
        max_tokens=1024,
        system=(
            "You are Ripple, a knowledge assistant for Splashworks — a pool service company. "
            "Answer questions using ONLY the provided context. "
            "Be concise and accurate. Cite your sources by filename. "
            "If the context doesn't contain enough information, say so honestly."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Context:\n{context}\n\n---\n\n"
                    f"Question: {question}\n\n"
                    "Answer the question based on the context above. "
                    "Cite sources in parentheses, e.g. (customer.md)."
                ),
            }
        ],
    ) as stream:
        for text in stream.text_stream:
            yield text
