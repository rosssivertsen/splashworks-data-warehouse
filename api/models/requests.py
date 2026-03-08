from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    layer: str = Field(default="warehouse", pattern="^(warehouse|staging)$")


class RawQueryRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=10000)
    layer: str = Field(default="warehouse", pattern="^(warehouse|staging)$")
