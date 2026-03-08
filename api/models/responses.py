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


# --- Schema endpoint models ---


class ColumnInfo(BaseModel):
    column_name: str
    data_type: str
    is_nullable: bool
    ordinal_position: int


class TableInfo(BaseModel):
    schema_name: str
    table_name: str
    columns: list[ColumnInfo]


class SchemaResponse(BaseModel):
    layer: str
    tables: list[TableInfo]


# --- Dictionary endpoint models ---


class BusinessTerm(BaseModel):
    term: str
    description: str
    synonyms: list[str] = []


class Relationship(BaseModel):
    name: str
    description: str


class VerifiedQuery(BaseModel):
    question: str
    sql: str | None = None


class DictionaryResponse(BaseModel):
    business_terms: list[BusinessTerm]
    relationships: list[Relationship]
    verified_queries: list[VerifiedQuery]


class PromptsResponse(BaseModel):
    prompts: list[str]
