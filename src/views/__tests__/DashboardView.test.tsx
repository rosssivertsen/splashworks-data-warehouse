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

vi.mock("echarts-for-react", () => ({
  default: () => <div data-testid="echarts-mock" />,
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

  it("creates sample dashboard on first visit", async () => {
    vi.mocked(apiClient.queryRaw).mockResolvedValue(mockResponse);

    const { DashboardView } = await import("../DashboardView");
    render(<DashboardView />);

    // Should see the "Operations Overview" dashboard in the selector
    await waitFor(() => {
      expect(screen.getByText("Operations Overview")).toBeInTheDocument();
    });
  });

  it("shows dashboard selector and action buttons", async () => {
    vi.mocked(apiClient.queryRaw).mockResolvedValue(mockResponse);

    const { DashboardView } = await import("../DashboardView");
    render(<DashboardView />);

    await waitFor(() => {
      expect(screen.getByText("Operations Overview")).toBeInTheDocument();
    });

    expect(screen.getByText("+ New")).toBeInTheDocument();
    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("+ Add Card")).toBeInTheDocument();
    expect(screen.getByText("Screenshot")).toBeInTheDocument();
  });

  it("shows add card form when clicking + Add Card", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.queryRaw).mockResolvedValue(mockResponse);

    const { DashboardView } = await import("../DashboardView");
    render(<DashboardView />);

    await waitFor(() => {
      expect(screen.getByText("+ Add Card")).toBeInTheDocument();
    });

    await user.click(screen.getByText("+ Add Card"));

    expect(screen.getByPlaceholderText(/card title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/sql query/i)).toBeInTheDocument();
  });

  it("adds card via add form and shows results", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.queryRaw).mockResolvedValue(mockResponse);

    const { DashboardView } = await import("../DashboardView");
    render(<DashboardView />);

    // Wait for sample dashboard to be created and loaded
    await waitFor(() => {
      expect(screen.getByText("+ Add Card")).toBeInTheDocument();
    });

    // Open add form
    await user.click(screen.getByText("+ Add Card"));

    await user.type(screen.getByPlaceholderText(/card title/i), "Customer Count");
    await user.type(screen.getByPlaceholderText(/sql query/i), "SELECT COUNT(*) AS cnt FROM customer");
    await user.click(screen.getByRole("button", { name: /^Add$/ }));

    await waitFor(() => {
      expect(apiClient.queryRaw).toHaveBeenCalledWith("SELECT COUNT(*) AS cnt FROM customer");
    });

    await waitFor(() => {
      expect(screen.getByText("Customer Count")).toBeInTheDocument();
    });
  });
});
