from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    postgres: str
    last_etl_date: str | None
    last_etl_rows: int | None
    schemas: dict[str, int]


class QueryResponse(BaseModel):
    sql: str
    columns: list[str]
    results: list[list]
    row_count: int
    explanation: str


class ErrorResponse(BaseModel):
    error: str
    sql: str | None = None
