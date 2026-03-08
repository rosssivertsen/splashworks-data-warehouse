from enum import Enum

import psycopg2
from fastapi import APIRouter, HTTPException, Query

from api.config import DATABASE_URL
from api.models.responses import (
    BusinessTerm,
    ColumnInfo,
    DictionaryResponse,
    PromptsResponse,
    Relationship,
    SchemaResponse,
    TableInfo,
    VerifiedQuery,
)
from api.services.schema_context import LAYER_SCHEMAS, load_semantic_layer

router = APIRouter()


class LayerParam(str, Enum):
    warehouse = "warehouse"
    staging = "staging"


@router.get("/api/schema", response_model=SchemaResponse)
def get_schema(layer: LayerParam = Query(default=LayerParam.warehouse)):
    """Return table and column metadata from the warehouse."""
    schemas = LAYER_SCHEMAS[layer.value]
    placeholders = ",".join(["%s"] * len(schemas))

    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cur = conn.cursor()
        cur.execute(f"""
            SELECT table_schema, table_name, column_name, data_type,
                   is_nullable, ordinal_position
            FROM information_schema.columns
            WHERE table_schema IN ({placeholders})
            ORDER BY table_schema, table_name, ordinal_position
        """, schemas)
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    # Group rows into TableInfo objects
    tables_map: dict[tuple[str, str], list[ColumnInfo]] = {}
    for schema_name, table_name, col_name, data_type, is_nullable, ordinal in rows:
        key = (schema_name, table_name)
        tables_map.setdefault(key, []).append(
            ColumnInfo(
                column_name=col_name,
                data_type=data_type,
                is_nullable=is_nullable == "YES",
                ordinal_position=ordinal,
            )
        )

    tables = [
        TableInfo(schema_name=k[0], table_name=k[1], columns=cols)
        for k, cols in tables_map.items()
    ]

    return SchemaResponse(layer=layer.value, tables=tables)


@router.get("/api/schema/dictionary", response_model=DictionaryResponse)
def get_dictionary():
    """Return semantic descriptions and business terms from the YAML semantic layer."""
    sl = load_semantic_layer()

    # Parse business terms
    business_terms = []
    for term_name, info in (sl.get("business_terms") or {}).items():
        business_terms.append(
            BusinessTerm(
                term=term_name,
                description=info.get("description", ""),
                synonyms=info.get("synonyms", []),
            )
        )

    # Parse relationships
    relationships = []
    for rel_name, info in (sl.get("relationships") or {}).items():
        relationships.append(
            Relationship(
                name=rel_name,
                description=info.get("description", ""),
            )
        )

    # Parse verified queries
    verified_queries = []
    for vq in sl.get("verified_queries") or []:
        verified_queries.append(
            VerifiedQuery(
                question=vq.get("question", ""),
                sql=vq.get("sql_query"),
            )
        )

    return DictionaryResponse(
        business_terms=business_terms,
        relationships=relationships,
        verified_queries=verified_queries,
    )


@router.get("/api/prompts", response_model=PromptsResponse)
def get_prompts():
    """Return starter prompt questions from the semantic layer."""
    sl = load_semantic_layer()
    prompts = [vq.get("question", "") for vq in sl.get("verified_queries", []) if vq.get("question")]
    return PromptsResponse(prompts=prompts)
