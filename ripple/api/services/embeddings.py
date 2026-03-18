import os

from openai import OpenAI

_client: OpenAI | None = None

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 1536


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


def embed_text(text: str) -> list[float]:
    """Embed a single text string."""
    client = _get_client()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )
    return response.data[0].embedding


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in a single API call (max 2048 per batch)."""
    client = _get_client()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]
