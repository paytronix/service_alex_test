import { render, screen } from "@testing-library/react";
import { ScheduleChangeType } from "@shiftflow/shared";
import { describe, expect, it } from "vitest";
import { RecentChangesList } from "./RecentChangesList";

describe("RecentChangesList", () => {
  it("renders change details and an empty state", () => {
    render(
      <RecentChangesList
        changes={[
          {
            id: "change-1",
            changeType: ScheduleChangeType.CREATED,
            date: "2026-01-05",
            scheduleId: "schedule-1",
            previousEmployeeName: "Alex",
            newEmployeeName: "Jordan",
            changedByName: "Manager",
            changedAt: new Date().toISOString(),
          },
        ]}
      />,
    );
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
    expect(screen.getByText(/Jordan/)).toBeInTheDocument();
    expect(screen.getByText("Changed by Manager")).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(<RecentChangesList changes={[]} />);
    expect(screen.getByText("No recent schedule changes.")).toBeInTheDocument();
  });
});
