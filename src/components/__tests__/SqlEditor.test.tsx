import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SqlEditor } from "../SqlEditor";

describe("SqlEditor", () => {
  it("renders with initial value", () => {
    render(<SqlEditor value="SELECT 1" onChange={() => {}} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("SELECT 1");
  });

  it("calls onChange on type", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SqlEditor value="" onChange={onChange} />);
    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.type(textarea, "S");
    expect(onChange).toHaveBeenCalled();
  });

  it("Ctrl+Enter triggers onRun", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<SqlEditor value="SELECT 1" onChange={() => {}} onRun={onRun} />);
    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("shows readOnly textarea", () => {
    render(<SqlEditor value="SELECT 1" onChange={() => {}} readOnly />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("readonly");
  });

  it("renders placeholder text", () => {
    render(
      <SqlEditor value="" onChange={() => {}} placeholder="Enter SQL..." />
    );
    expect(screen.getByPlaceholderText("Enter SQL...")).toBeInTheDocument();
  });
});
