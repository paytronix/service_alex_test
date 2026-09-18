import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FillRateReportView } from "./FillRateReportView";

describe("FillRateReportView", () => {
  it("renders headline metrics and breakdowns", () => {
    render(
      <FillRateReportView
        loading={false}
        report={{
          from: "2026-01-05",
          to: "2026-01-11",
          requiredCount: 10,
          assignedCount: 8,
          filledCount: 8,
          openCount: 2,
          fillRatePercent: 80,
          byDate: [{ key: "2026-01-05", label: "2026-01-05", requiredCount: 10, assignedCount: 8, filledCount: 8, fillRatePercent: 80 }],
          byShift: [{ key: "shift-1", label: "Morning", requiredCount: 10, assignedCount: 8, filledCount: 8, fillRatePercent: 80 }],
          byRole: [{ key: "role-1", label: "Server", requiredCount: 10, assignedCount: 8, filledCount: 8, fillRatePercent: 80 }],
        }}
      />,
    );
    expect(screen.getAllByText("80.00%").length).toBeGreaterThan(0);
    expect(screen.getByText("By shift")).toBeInTheDocument();
    expect(screen.getByText("Morning")).toBeInTheDocument();
    expect(screen.getByText("By role")).toBeInTheDocument();
  });
});
