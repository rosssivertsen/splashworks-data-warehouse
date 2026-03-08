import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiClient } from "../ApiClient";
import type {
  HealthResponse,
  QueryResponse,
  SchemaResponse,
  DictionaryResponse,
} from "../../types/api";

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("/api");
    vi.restoreAllMocks();
  });

  it("health() returns data on success", async () => {
    const mockHealth: HealthResponse = {
      status: "healthy",
      postgres: "connected",
      last_etl_date: "2026-03-08",
      last_etl_rows: 712000,
      schemas: { public_warehouse: 15, public_staging: 26 },
    };

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockHealth), { status: 200 })
    );

    const result = await client.health();
    expect(result).toEqual(mockHealth);
    expect(global.fetch).toHaveBeenCalledWith("/api/health", expect.objectContaining({ method: "GET" }));
  });

  it("query() sends NL question and returns results", async () => {
    const mockResponse: QueryResponse = {
      sql: "SELECT COUNT(*) FROM customer",
      columns: ["count"],
      results: [[859]],
      row_count: 1,
      explanation: "Counts active customers",
    };

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const result = await client.query("How many active customers?", "warehouse");
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/query",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question: "How many active customers?", layer: "warehouse" }),
      })
    );
  });

  it("queryRaw() sends raw SQL and returns results", async () => {
    const mockResponse: QueryResponse = {
      sql: "SELECT 1",
      columns: ["1"],
      results: [[1]],
      row_count: 1,
      explanation: "Raw SQL execution",
    };

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const result = await client.queryRaw("SELECT 1", "staging");
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/query/raw",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sql: "SELECT 1", layer: "staging" }),
      })
    );
  });

  it("getSchema() returns table metadata", async () => {
    const mockSchema: SchemaResponse = {
      layer: "warehouse",
      tables: [
        {
          schema_name: "public_warehouse",
          table_name: "customer",
          columns: [
            { column_name: "id", data_type: "text", is_nullable: false, ordinal_position: 1 },
          ],
        },
      ],
    };

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockSchema), { status: 200 })
    );

    const result = await client.getSchema("warehouse");
    expect(result).toEqual(mockSchema);
    expect(global.fetch).toHaveBeenCalledWith("/api/schema?layer=warehouse", expect.objectContaining({ method: "GET" }));
  });

  it("getDictionary() returns business terms", async () => {
    const mockDict: DictionaryResponse = {
      business_terms: [
        { term: "Active Customer", description: "Not inactive or deleted", synonyms: ["current customer"] },
      ],
      relationships: [
        { name: "Customer -> ServiceLocation", description: "One to many" },
      ],
      verified_queries: [
        { question: "How many active customers?", sql: "SELECT COUNT(*) FROM customer WHERE is_inactive = 0" },
      ],
    };

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockDict), { status: 200 })
    );

    const result = await client.getDictionary();
    expect(result).toEqual(mockDict);
    expect(global.fetch).toHaveBeenCalledWith("/api/schema/dictionary", expect.objectContaining({ method: "GET" }));
  });

  it("throws on HTTP error with detail message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Only SELECT queries are allowed" }), { status: 400 })
    );

    await expect(client.query("DROP TABLE customer")).rejects.toThrow(
      "Only SELECT queries are allowed"
    );
  });

  it("throws on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(client.health()).rejects.toThrow("Failed to fetch");
  });
});
