import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChartCard } from "../ChartCard";
import type { DashboardCard } from "../../types/api";

// Mock echarts-for-react since it renders a canvas element
vi.mock("echarts-for-react", () => ({
  default: () => <div data-testid="echart" />,
}));

const mockCard: DashboardCard = {
  id: "1",
  title: "Test Card",
  sql: "SELECT _company_name, COUNT(*) AS cnt FROM dim_customer GROUP BY _company_name",
  results: {
    columns: ["_company_name", "cnt"],
    rows: [
      ["AQPS", 859],
      ["JOMO", 2402],
    ],
  },
  chartType: "table",
  xColumn: null,
  yColumn: null,
};

describe("ChartCard", () => {
  it("renders card title", () => {
    render(
      <ChartCard card={mockCard} onUpdate={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByText("Test Card")).toBeInTheDocument();
  });

  it("renders results table", () => {
    render(
      <ChartCard card={mockCard} onUpdate={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByText("AQPS")).toBeInTheDocument();
    expect(screen.getByText("2,402.00")).toBeInTheDocument();
  });

  it("renders chart type buttons", () => {
    render(
      <ChartCard card={mockCard} onUpdate={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /bar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /line/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pie/i })).toBeInTheDocument();
  });

  it("calls onUpdate when chart type changes", () => {
    const onUpdate = vi.fn();
    render(
      <ChartCard card={mockCard} onUpdate={onUpdate} onRemove={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /bar/i }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ chartType: "bar" }));
  });

  it("calls onRemove when remove is clicked", () => {
    const onRemove = vi.fn();
    render(
      <ChartCard card={mockCard} onUpdate={vi.fn()} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});
