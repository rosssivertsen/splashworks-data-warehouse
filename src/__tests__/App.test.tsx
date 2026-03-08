import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../views/QueryView", () => ({
  QueryView: () => <div data-testid="query-view">QueryView</div>,
}));

vi.mock("../views/ExplorerView", () => ({
  ExplorerView: () => <div data-testid="explorer-view">ExplorerView</div>,
}));

vi.mock("../views/DataView", () => ({
  DataView: () => <div data-testid="data-view">DataView</div>,
}));

vi.mock("../views/DashboardView", () => ({
  DashboardView: () => <div data-testid="dashboard-view">DashboardView</div>,
}));

vi.mock("../components/StatusBar", () => ({
  StatusBar: () => <div data-testid="status-bar">StatusBar</div>,
}));

vi.mock("../hooks/useDashboards", () => ({
  useDashboards: () => ({
    dashboards: [],
    activeDashboard: null,
    activeId: null,
    createDashboard: vi.fn(),
    renameDashboard: vi.fn(),
    deleteDashboard: vi.fn(),
    setActiveDashboard: vi.fn(),
    addCard: vi.fn(),
    updateCard: vi.fn(),
    removeCard: vi.fn(),
  }),
}));

import App from "../App";

describe("App", () => {
  it("renders header and navigation tabs", () => {
    render(<App />);

    expect(screen.getByText("Splashworks Warehouse")).toBeInTheDocument();
    expect(screen.getByText("AI Query")).toBeInTheDocument();
    expect(screen.getByText("Database Explorer")).toBeInTheDocument();
    expect(screen.getByText("Data Explorer")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows QueryView by default", () => {
    render(<App />);

    expect(screen.getByTestId("query-view")).toBeInTheDocument();
    expect(screen.queryByTestId("explorer-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("data-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-view")).not.toBeInTheDocument();
  });

  it("switches to Database Explorer on click", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText("Database Explorer"));

    expect(screen.getByTestId("explorer-view")).toBeInTheDocument();
    expect(screen.queryByTestId("query-view")).not.toBeInTheDocument();
  });

  it("renders StatusBar", () => {
    render(<App />);

    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
  });
});
