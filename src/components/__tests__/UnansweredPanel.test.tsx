import { render, screen } from "@testing-library/react";
import { UnansweredPanel } from "../UnansweredPanel";

describe("UnansweredPanel", () => {
  it("renders the unanswerable reason", () => {
    render(
      <UnansweredPanel
        reason="No clock-in/clock-out data in Skimmer."
        hint={null}
      />
    );
    expect(screen.getByText(/clock-in\/clock-out/)).toBeInTheDocument();
  });

  it("renders the partial answer hint when provided", () => {
    render(
      <UnansweredPanel
        reason="No GPS data."
        hint="I can show service addresses grouped by city/zip."
      />
    );
    expect(screen.getByText(/What I can tell you/)).toBeInTheDocument();
    expect(screen.getByText(/service addresses/)).toBeInTheDocument();
  });

  it("does not render hint section when hint is null", () => {
    render(<UnansweredPanel reason="No survey data." hint={null} />);
    expect(screen.queryByText(/What I can tell you/)).not.toBeInTheDocument();
  });
});
