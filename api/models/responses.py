from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    postgres: str
    last_etl_date: str | None
    last_etl_rows: int | None
    schemas: dict[str, int]
