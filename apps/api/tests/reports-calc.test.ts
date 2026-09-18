import { describe, expect, it } from "vitest";
import {
  fillRatePercent,
  paidMinutes,
  periodKey,
  ReportGranularity,
  roundHours,
} from "@shiftflow/shared";
import {
  toEmployeeWorkloadTable,
  toScheduleFillRateTable,
  toWorkHoursTable,
} from "../src/services/report-export.service";

describe("report calculation helpers", () => {
  it("builds period keys for every granularity", () => {
    const date = "2026-03-04";
    expect(periodKey(date, ReportGranularity.DAY)).toBe("2026-03-04");
    expect(periodKey(date, ReportGranularity.WEEK)).toBe("2026-03-02");
    expect(periodKey(date, ReportGranularity.MONTH)).toBe("2026-03");
    expect(periodKey(date, ReportGranularity.TOTAL)).toBe("total");
  });

  it("calculates fill rates and rounded hours at edge cases", () => {
    expect(fillRatePercent(0, 0)).toBe(0);
    expect(fillRatePercent(3, 2)).toBe(66.67);
    expect(roundHours(450)).toBe(7.5);
    expect(paidMinutes("22:00", "06:00", 30)).toBe(450);
    expect(paidMinutes("09:00", "17:00", 30)).toBe(450);
  });

  it("converts each report type into a flat export table", () => {
    const workHours = toWorkHoursTable({
      from: "2026-03-02",
      to: "2026-03-08",
      granularity: ReportGranularity.WEEK,
      rows: [
        {
          employeeId: "e1",
          employeeName: "Ada Lovelace",
          departmentName: "Engineering",
          roleName: "Developer",
          period: "2026-03-02",
          shiftCount: 1,
          totalHours: 7.5,
        },
      ],
      totalHours: 7.5,
      totalShifts: 1,
    });
    expect(workHours.columns.map((column) => column.header)).toContain("Employee");
    expect(workHours.rows[0].employeeName).toBe("Ada Lovelace");

    const workload = toEmployeeWorkloadTable({
      from: "2026-03-02",
      to: "2026-03-08",
      rows: [
        {
          employeeId: "e1",
          employeeName: "Ada Lovelace",
          departmentName: null,
          roleName: null,
          totalHours: 7.5,
          shiftCount: 1,
          weeksInPeriod: 1,
          avgWeeklyHours: 7.5,
          weeklyLimitHours: 40,
          overtimeHours: 0,
          utilizationPercent: 18.75,
          isOverloaded: false,
          rank: 1,
        },
      ],
      totalHours: 7.5,
      averageHours: 7.5,
    });
    expect(workload.columns.map((column) => column.header)).toContain("Overtime Hours");
    expect(workload.rows[0].employeeName).toBe("Ada Lovelace");

    const fillRate = toScheduleFillRateTable({
      from: "2026-03-02",
      to: "2026-03-08",
      requiredCount: 1,
      assignedCount: 1,
      filledCount: 1,
      openCount: 0,
      fillRatePercent: 100,
      byDate: [
        {
          key: "2026-03-02",
          label: "2026-03-02",
          requiredCount: 1,
          assignedCount: 1,
          filledCount: 1,
          fillRatePercent: 100,
        },
      ],
      byShift: [],
      byRole: [],
    });
    expect(fillRate.columns.map((column) => column.header)).toContain("Fill Rate %");
    expect(fillRate.rows[0].bucket).toBe("2026-03-02");
  });
});
