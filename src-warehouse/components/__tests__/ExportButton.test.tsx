import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExportButton, generateCsv } from "../ExportButton";

describe("generateCsv", () => {
  it("generates correct CSV output", () => {
    const csv = generateCsv(["id", "name"], [[1, "Alice"], [2, "Bob"]]);
    expect(csv).toBe("id,name\n1,Alice\n2,Bob");
  });

  it("escapes commas in values", () => {
    const csv = generateCsv(["note"], [["hello, world"]]);
    expect(csv).toBe('note\n"hello, world"');
  });

  it("escapes double quotes in values", () => {
    const csv = generateCsv(["note"], [['say "hello"']]);
    expect(csv).toBe('note\n"say ""hello"""');
  });

  it("handles null values as empty strings", () => {
    const csv = generateCsv(["id", "name"], [[1, null]]);
    expect(csv).toBe("id,name\n1,");
  });

  it("returns empty string for empty columns", () => {
    const csv = generateCsv([], []);
    expect(csv).toBe("");
  });
});

describe("ExportButton", () => {
  it("renders the export button", () => {
    render(<ExportButton columns={["id"]} rows={[[1]]} />);
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("is disabled when no data", () => {
    render(<ExportButton columns={[]} rows={[]} />);
    const button = screen.getByText("Export");
    expect(button).toBeDisabled();
  });
});
