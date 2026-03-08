import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StatusBar } from "../StatusBar";
import { apiClient } from "../../services/ApiClient";
import type { HealthResponse } from "../../types/api";

vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    health: vi.fn(),
  },
}));

const mockHealth = apiClient.health as ReturnType<typeof vi.fn>;

describe("StatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Connected when health check succeeds", async () => {
    const response: HealthResponse = {
      status: "healthy",
      postgres: "connected",
      last_etl_date: null,
      last_etl_rows: null,
      schemas: {},
    };
    mockHealth.mockResolvedValue(response);

    render(<StatusBar />);

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
  });

  it("shows Disconnected when health check fails", async () => {
    mockHealth.mockRejectedValue(new Error("Network error"));

    render(<StatusBar />);

    await waitFor(() => {
      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });
  });

  it("shows ETL date when available", async () => {
    const response: HealthResponse = {
      status: "healthy",
      postgres: "connected",
      last_etl_date: "2026-03-08",
      last_etl_rows: 712000,
      schemas: {},
    };
    mockHealth.mockResolvedValue(response);

    render(<StatusBar />);

    await waitFor(() => {
      expect(screen.getByText("Last ETL: 2026-03-08")).toBeInTheDocument();
      expect(screen.getByText("712,000 rows")).toBeInTheDocument();
    });
  });
});
