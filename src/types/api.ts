// Response types matching FastAPI models

export interface HealthResponse {
  status: string;
  postgres: string;
  last_etl_date: string | null;
  last_etl_rows: number | null;
  schemas: Record<string, number>;
}

export interface QueryResponse {
  sql: string;
  columns: string[];
  results: (string | number | boolean | null)[][];
  row_count: number;
  explanation: string;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  ordinal_position: number;
}

export interface TableInfo {
  schema_name: string;
  table_name: string;
  columns: ColumnInfo[];
}

export interface SchemaResponse {
  layer: string;
  tables: TableInfo[];
}

export interface BusinessTerm {
  term: string;
  description: string;
  synonyms: string[];
}

export interface Relationship {
  name: string;
  description: string;
}

export interface VerifiedQuery {
  question: string;
  sql: string | null;
}

export interface DictionaryResponse {
  business_terms: BusinessTerm[];
  relationships: Relationship[];
  verified_queries: VerifiedQuery[];
}

export interface QueryRequest {
  question: string;
  layer?: "warehouse" | "staging";
}

export interface RawQueryRequest {
  sql: string;
  layer?: "warehouse" | "staging";
}

export interface ApiError {
  detail: string;
}
