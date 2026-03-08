import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsTable } from "../ResultsTable";

describe("ResultsTable", () => {
  const columns = ["id", "name", "active"];
  const rows: (string | number | boolean | null)[][] = [
    [1, "Alice", true],
    [2, "Bob", false],
    [3, "Charlie", null],
  ];

  it("renders column headers", () => {
    render(<ResultsTable columns={columns} rows={rows} />);
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders row data", () => {
    render(<ResultsTable columns={columns} rows={rows} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows row count in footer", () => {
    render(<ResultsTable columns={columns} rows={rows} />);
    expect(screen.getByText("3 rows")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(<ResultsTable columns={[]} rows={[]} />);
    expect(screen.getByText("No results returned.")).toBeInTheDocument();
  });

  it("paginates when rows exceed pageSize", async () => {
    const user = userEvent.setup();
    const manyRows = Array.from({ length: 5 }, (_, i) => [i, `row-${i}`, true]);
    render(<ResultsTable columns={columns} rows={manyRows} pageSize={2} />);

    // Should show page 1 of 3
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("row-0")).toBeInTheDocument();
    expect(screen.getByText("row-1")).toBeInTheDocument();
    expect(screen.queryByText("row-2")).not.toBeInTheDocument();

    // Click Next
    await user.click(screen.getByText("Next"));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("row-2")).toBeInTheDocument();

    // Click Previous
    await user.click(screen.getByText("Previous"));
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("renders null values as italic text", () => {
    render(<ResultsTable columns={columns} rows={rows} />);
    const nullElements = screen.getAllByText("null");
    expect(nullElements.length).toBeGreaterThan(0);
    expect(nullElements[0]).toHaveClass("italic");
  });
});
