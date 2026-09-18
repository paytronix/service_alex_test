import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleHistoryPanel, describeChange } from "./ScheduleHistoryPanel";
import type {
  ScheduleChangeItem,
  ScheduleVersionItem,
} from "../notifications/types";

const manager = {
  id: "u1",
  firstName: "Mary",
  lastName: "Manager",
  email: "mary@example.test",
};

const changes: ScheduleChangeItem[] = [
  {
    id: "h1",
    assignmentId: "a1",
    changeType: "REPLACED",
    date: "2026-03-02T00:00:00.000Z",
    previousEmployeeId: "e1",
    newEmployeeId: "e2",
    changedAt: "2026-03-02T14:32:00.000Z",
    changedBy: manager,
  },
  {
    id: "h2",
    assignmentId: "a2",
    changeType: "REMOVED",
    date: "2026-03-03T00:00:00.000Z",
    previousEmployeeId: "e2",
    newEmployeeId: null,
    changedAt: "2026-03-03T09:00:00.000Z",
    changedBy: null,
  },
];

const versions: ScheduleVersionItem[] = [
  {
    id: "v2",
    version: 2,
    publishedAt: "2026-03-02T14:32:00.000Z",
    publishedBy: manager,
  },
  {
    id: "v1",
    version: 1,
    publishedAt: "2026-03-01T10:00:00.000Z",
    publishedBy: manager,
  },
];

const employeeNames = { e1: "John Doe", e2: "Mike Smith" };

describe("describeChange", () => {
  it("formats a replacement as weekday, transition, actor and time", () => {
    expect(describeChange(changes[0], employeeNames)).toBe(
      `Monday: John Doe → Mike Smith, changed by Mary Manager, ${new Date(
        "2026-03-02T14:32:00.000Z",
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    );
  });

  it("falls back to System when there is no actor", () => {
    expect(describeChange(changes[1], employeeNames)).toContain("changed by System");
  });
});

describe("ScheduleHistoryPanel", () => {
  it("lists changes and versions", () => {
    render(
      <ScheduleHistoryPanel
        changes={changes}
        versions={versions}
        employeeNames={employeeNames}
      />,
    );
    expect(screen.getByText(/Monday: John Doe → Mike Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Tuesday: Mike Smith removed/)).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });

  it("requests a diff between adjacent versions", async () => {
    const onCompareVersions = vi.fn();
    render(
      <ScheduleHistoryPanel
        changes={changes}
        versions={versions}
        employeeNames={employeeNames}
        onCompareVersions={onCompareVersions}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Compare version 1 with 2" }),
    );
    expect(onCompareVersions).toHaveBeenCalledWith(1, 2);
  });

  it("renders the diff when provided", () => {
    render(
      <ScheduleHistoryPanel
        changes={[]}
        versions={versions}
        employeeNames={employeeNames}
        diff={[
          {
            assignmentId: "a1",
            changeType: "REPLACED",
            date: "2026-03-02T00:00:00.000Z",
            previousEmployeeId: "e1",
            newEmployeeId: "e2",
          },
        ]}
      />,
    );
    expect(screen.getByLabelText("Version diff")).toBeInTheDocument();
    expect(screen.getByText(/REPLACED John Doe → Mike Smith/)).toBeInTheDocument();
    expect(screen.getByText("No changes recorded")).toBeInTheDocument();
  });

  it("shows loading and error states", () => {
    const { unmount } = render(
      <ScheduleHistoryPanel
        changes={[]}
        versions={[]}
        employeeNames={{}}
        loading
      />,
    );
    expect(screen.getByText("Loading history...")).toBeInTheDocument();
    unmount();

    render(
      <ScheduleHistoryPanel
        changes={[]}
        versions={[]}
        employeeNames={{}}
        error="boom"
      />,
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
