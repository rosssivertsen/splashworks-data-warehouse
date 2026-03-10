import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceBadge } from "../ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("renders green Verified badge for high confidence", () => {
    render(<ConfidenceBadge confidence="high" />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("renders yellow Best effort badge for medium confidence", () => {
    render(<ConfidenceBadge confidence="medium" />);
    expect(screen.getByText("Best effort")).toBeInTheDocument();
  });

  it("renders yellow Best effort badge for low confidence", () => {
    render(<ConfidenceBadge confidence="low" />);
    expect(screen.getByText("Best effort")).toBeInTheDocument();
  });

  it("renders nothing for null confidence", () => {
    const { container } = render(<ConfidenceBadge confidence={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for unanswerable (handled separately)", () => {
    const { container } = render(<ConfidenceBadge confidence="unanswerable" />);
    expect(container.firstChild).toBeNull();
  });
});
