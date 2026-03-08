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

const mockResponse: QueryResponse = {
  sql: "SELECT 1",
  columns: ["result"],
  results: [[1]],
  row_count: 1,
  explanation: "",
};

describe("DataView", () => {
  let apiClient: typeof import("../../services/ApiClient")["apiClient"];

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../services/ApiClient");
    apiClient = mod.apiClient;
  });

  it("renders SQL editor and Run button", async () => {
    const { DataView } = await import("../DataView");
    render(<DataView />);
    expect(screen.getByText("Data Explorer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument();
  });

  it("executes SQL and shows results", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.queryRaw).mockResolvedValueOnce(mockResponse);

    const { DataView } = await import("../DataView");
    render(<DataView />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "SELECT 1");
    await user.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => {
      expect(apiClient.queryRaw).toHaveBeenCalledWith("SELECT 1");
    });

    await waitFor(() => {
      expect(screen.getByText("1 rows")).toBeInTheDocument();
    });
  });

  it("shows error on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.queryRaw).mockRejectedValueOnce(new Error("Syntax error"));

    const { DataView } = await import("../DataView");
    render(<DataView />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "BAD SQL");
    await user.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => {
      expect(screen.getByText(/Syntax error/)).toBeInTheDocument();
    });
  });
});
