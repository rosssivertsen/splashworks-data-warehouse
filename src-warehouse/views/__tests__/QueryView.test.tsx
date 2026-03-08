import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QueryResponse } from "../../types/api";

vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    query: vi.fn(),
    queryRaw: vi.fn(),
    getSchema: vi.fn(),
    getDictionary: vi.fn(),
  },
}));

const mockQueryResponse: QueryResponse = {
  sql: "SELECT id, name FROM customer LIMIT 5",
  columns: ["id", "name"],
  results: [
    [1, "Alice"],
    [2, "Bob"],
  ],
  row_count: 2,
  explanation: "This query returns customer names.",
};

const mockRawResponse: QueryResponse = {
  sql: "SELECT id FROM customer",
  columns: ["id"],
  results: [[1], [2], [3]],
  row_count: 3,
  explanation: "",
};

describe("QueryView", () => {
  let apiClient: typeof import("../../services/ApiClient")["apiClient"];

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../services/ApiClient");
    apiClient = mod.apiClient;
  });

  it("renders input and Ask button", async () => {
    const { QueryView } = await import("../QueryView");
    render(<QueryView />);
    expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask/i })).toBeInTheDocument();
  });

  it("submits NL query and shows results", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.query).mockResolvedValueOnce(mockQueryResponse);

    const { QueryView } = await import("../QueryView");
    render(<QueryView />);

    await user.type(screen.getByPlaceholderText(/ask a question/i), "Show customers");
    await user.click(screen.getByRole("button", { name: /ask/i }));

    await waitFor(() => {
      expect(apiClient.query).toHaveBeenCalledWith("Show customers");
    });

    await waitFor(() => {
      expect(screen.getByText("This query returns customer names.")).toBeInTheDocument();
    });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows error on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.query).mockRejectedValueOnce(new Error("API unavailable"));

    const { QueryView } = await import("../QueryView");
    render(<QueryView />);

    await user.type(screen.getByPlaceholderText(/ask a question/i), "bad query");
    await user.click(screen.getByRole("button", { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText(/API unavailable/)).toBeInTheDocument();
    });
  });

  it("allows editing SQL and re-running", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.query).mockResolvedValueOnce(mockQueryResponse);
    vi.mocked(apiClient.queryRaw).mockResolvedValueOnce(mockRawResponse);

    const { QueryView } = await import("../QueryView");
    render(<QueryView />);

    // First, submit NL query
    await user.type(screen.getByPlaceholderText(/ask a question/i), "Show customers");
    await user.click(screen.getByRole("button", { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    // Now click "Run SQL" to re-run the (potentially edited) SQL
    const runSqlButton = screen.getByRole("button", { name: /run sql/i });
    await user.click(runSqlButton);

    await waitFor(() => {
      expect(apiClient.queryRaw).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText("3 rows")).toBeInTheDocument();
    });
  });
});
