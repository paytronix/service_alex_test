import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardSummaryCards } from "./DashboardSummaryCards";

const summary = {
  date: "2026-01-05",
  workingToday: 4,
  absentToday: 1,
  openRequests: 2,
  openShifts: 3,
  fillRatePercentThisWeek: 87.5,
  recentChanges: [],
};

describe("DashboardSummaryCards", () => {
  it("renders the dashboard metrics", () => {
    render(<DashboardSummaryCards summary={summary} loading={false} />);
    expect(screen.getByText("Working today")).toBeInTheDocument();
    expect(screen.getByText("87.50%")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders loading and error states", () => {
    const { rerender } = render(<DashboardSummaryCards loading summary={null} />);
    expect(screen.getByLabelText("Loading dashboard summary")).toBeInTheDocument();
    rerender(<DashboardSummaryCards loading={false} summary={null} error="Unable to load" />);
    expect(screen.getByText("Unable to load")).toBeInTheDocument();
  });
});
