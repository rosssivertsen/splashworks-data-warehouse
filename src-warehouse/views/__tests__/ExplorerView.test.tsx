import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SchemaResponse, DictionaryResponse, QueryResponse } from "../../types/api";

vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    query: vi.fn(),
    queryRaw: vi.fn(),
    getSchema: vi.fn(),
    getDictionary: vi.fn(),
  },
}));

const mockSchema: SchemaResponse = {
  layer: "warehouse",
  tables: [
    {
      schema_name: "public_warehouse",
      table_name: "customer",
      columns: [
        { column_name: "id", data_type: "integer", is_nullable: false, ordinal_position: 1 },
        { column_name: "name", data_type: "text", is_nullable: true, ordinal_position: 2 },
      ],
    },
    {
      schema_name: "public_warehouse",
      table_name: "invoice",
      columns: [
        { column_name: "id", data_type: "integer", is_nullable: false, ordinal_position: 1 },
      ],
    },
  ],
};

const mockDictionary: DictionaryResponse = {
  business_terms: [
    { term: "Active Customer", description: "A customer with IsInactive=0", synonyms: ["current"] },
  ],
  relationships: [
    { name: "Customer -> ServiceLocation", description: "One to many" },
  ],
  verified_queries: [],
};

const mockPreviewResponse: QueryResponse = {
  sql: "SELECT * FROM public_warehouse.customer LIMIT 100",
  columns: ["id", "name"],
  results: [[1, "Alice"]],
  row_count: 1,
  explanation: "",
};

describe("ExplorerView", () => {
  let apiClient: typeof import("../../services/ApiClient")["apiClient"];

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../services/ApiClient");
    apiClient = mod.apiClient;
  });

  it("loads and displays table list", async () => {
    vi.mocked(apiClient.getSchema).mockResolvedValueOnce(mockSchema);
    vi.mocked(apiClient.getDictionary).mockResolvedValueOnce(mockDictionary);

    const { ExplorerView } = await import("../ExplorerView");
    render(<ExplorerView />);

    await waitFor(() => {
      expect(screen.getByText("customer")).toBeInTheDocument();
    });
    expect(screen.getByText("invoice")).toBeInTheDocument();
  });

  it("shows columns when table is selected", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.getSchema).mockResolvedValueOnce(mockSchema);
    vi.mocked(apiClient.getDictionary).mockResolvedValueOnce(mockDictionary);

    const { ExplorerView } = await import("../ExplorerView");
    render(<ExplorerView />);

    await waitFor(() => {
      expect(screen.getByText("customer")).toBeInTheDocument();
    });

    await user.click(screen.getByText("customer"));

    await waitFor(() => {
      expect(screen.getByText("id")).toBeInTheDocument();
      expect(screen.getByText("integer")).toBeInTheDocument();
      expect(screen.getByText("name")).toBeInTheDocument();
      expect(screen.getByText("text")).toBeInTheDocument();
    });
  });

  it("shows business terms", async () => {
    vi.mocked(apiClient.getSchema).mockResolvedValueOnce(mockSchema);
    vi.mocked(apiClient.getDictionary).mockResolvedValueOnce(mockDictionary);

    const { ExplorerView } = await import("../ExplorerView");
    render(<ExplorerView />);

    await waitFor(() => {
      expect(screen.getByText("Active Customer")).toBeInTheDocument();
      expect(screen.getByText("A customer with IsInactive=0")).toBeInTheDocument();
    });
  });

  it("shows relationships", async () => {
    vi.mocked(apiClient.getSchema).mockResolvedValueOnce(mockSchema);
    vi.mocked(apiClient.getDictionary).mockResolvedValueOnce(mockDictionary);

    const { ExplorerView } = await import("../ExplorerView");
    render(<ExplorerView />);

    await waitFor(() => {
      expect(screen.getByText("Customer -> ServiceLocation")).toBeInTheDocument();
      expect(screen.getByText("One to many")).toBeInTheDocument();
    });
  });

  it("previews table data", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.getSchema).mockResolvedValueOnce(mockSchema);
    vi.mocked(apiClient.getDictionary).mockResolvedValueOnce(mockDictionary);
    vi.mocked(apiClient.queryRaw).mockResolvedValueOnce(mockPreviewResponse);

    const { ExplorerView } = await import("../ExplorerView");
    render(<ExplorerView />);

    await waitFor(() => {
      expect(screen.getByText("customer")).toBeInTheDocument();
    });

    await user.click(screen.getByText("customer"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preview/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() => {
      expect(apiClient.queryRaw).toHaveBeenCalledWith(
        "SELECT * FROM public_warehouse.customer LIMIT 100"
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
  });
});
