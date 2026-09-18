import { render, screen } from "@testing-library/react";
import { ReportGranularity } from "@shiftflow/shared";
import { describe, expect, it } from "vitest";
import { WorkHoursReportView } from "./WorkHoursReportView";

describe("WorkHoursReportView", () => {
  it("renders rows and totals", () => {
    render(
      <WorkHoursReportView
        loading={false}
        report={{
          from: "2026-01-05",
          to: "2026-01-11",
          granularity: ReportGranularity.DAY,
          rows: [
            {
              employeeId: "employee-1",
              employeeName: "Alex",
              departmentName: "Front",
              roleName: "Server",
              period: "2026-01-05",
              shiftCount: 2,
              totalHours: 7.5,
            },
          ],
          totalHours: 7.5,
          totalShifts: 2,
        }}
      />,
    );
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getAllByText("7.50").length).toBeGreaterThan(0);
    expect(screen.getByText("Totals")).toBeInTheDocument();
  });
});
