from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: str | None = None


class ChatFeedback(BaseModel):
    message_id: str
    rating: str = Field(..., pattern="^(up|down)$")
    comment: str | None = None


class CorpusStatus(BaseModel):
    total_files: int
    total_chunks: int
    last_indexed_at: str | None
