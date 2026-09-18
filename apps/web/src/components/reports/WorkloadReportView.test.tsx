import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkloadReportView } from "./WorkloadReportView";

describe("WorkloadReportView", () => {
  it("highlights overtime employees", () => {
    render(
      <WorkloadReportView
        loading={false}
        report={{
          from: "2026-01-05",
          to: "2026-01-11",
          rows: [
            {
              employeeId: "employee-1",
              employeeName: "Alex",
              departmentName: null,
              roleName: null,
              totalHours: 48,
              shiftCount: 6,
              weeksInPeriod: 1,
              avgWeeklyHours: 48,
              weeklyLimitHours: 40,
              overtimeHours: 8,
              utilizationPercent: 120,
              isOverloaded: true,
              rank: 1,
            },
          ],
          totalHours: 48,
          averageHours: 48,
        }}
      />,
    );
    expect(screen.getAllByText("Overtime").length).toBeGreaterThan(0);
    expect(screen.getByText("Alex").closest("tr")).toHaveClass("bg-red-50");
  });
});
