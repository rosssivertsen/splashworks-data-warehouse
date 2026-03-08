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
  sql: "SELECT COUNT(*) AS cnt FROM customer",
  columns: ["cnt"],
  results: [[42]],
  row_count: 1,
  explanation: "",
};

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("DashboardView", () => {
  let apiClient: typeof import("../../services/ApiClient")["apiClient"];

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    const mod = await import("../../services/ApiClient");
    apiClient = mod.apiClient;
  });

  it("shows empty state", async () => {
    const { DashboardView } = await import("../DashboardView");
    render(<DashboardView />);
    expect(screen.getByText("No cards yet.")).toBeInTheDocument();
  });

  it("renders add card form", async () => {
    const { DashboardView } = await import("../DashboardView");
    render(<DashboardView />);
    expect(screen.getByPlaceholderText(/card title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/sql query/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add card/i })).toBeInTheDocument();
  });

  it("adds card and shows results", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.queryRaw).mockResolvedValue(mockResponse);

    const { DashboardView } = await import("../DashboardView");
    render(<DashboardView />);

    await user.type(screen.getByPlaceholderText(/card title/i), "Customer Count");
    await user.type(screen.getByPlaceholderText(/sql query/i), "SELECT COUNT(*) AS cnt FROM customer");
    await user.click(screen.getByRole("button", { name: /add card/i }));

    await waitFor(() => {
      expect(apiClient.queryRaw).toHaveBeenCalledWith("SELECT COUNT(*) AS cnt FROM customer");
    });

    await waitFor(() => {
      expect(screen.getByText("Customer Count")).toBeInTheDocument();
    });

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.queryByText("No cards yet.")).not.toBeInTheDocument();
  });
});
