import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { StarterPrompts } from "../StarterPrompts";

// Mock the ApiClient
vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    getPrompts: vi.fn(),
  },
}));

import { apiClient } from "../../services/ApiClient";

describe("StarterPrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders prompts from API", async () => {
    (apiClient.getPrompts as ReturnType<typeof vi.fn>).mockResolvedValue({
      prompts: ["How many active customers?", "Average pool size?"],
    });

    render(<StarterPrompts onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("How many active customers?")).toBeInTheDocument();
      expect(screen.getByText("Average pool size?")).toBeInTheDocument();
    });
  });

  it("calls onSelect when a prompt is clicked", async () => {
    (apiClient.getPrompts as ReturnType<typeof vi.fn>).mockResolvedValue({
      prompts: ["How many active customers?"],
    });

    const onSelect = vi.fn();
    render(<StarterPrompts onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("How many active customers?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("How many active customers?"));
    expect(onSelect).toHaveBeenCalledWith("How many active customers?");
  });

  it("renders nothing on API error", async () => {
    (apiClient.getPrompts as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fail"));

    const { container } = render(<StarterPrompts onSelect={vi.fn()} />);

    // Wait for async operation to complete
    await waitFor(() => {
      expect(apiClient.getPrompts).toHaveBeenCalled();
    });

    // Should render empty or nothing
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
