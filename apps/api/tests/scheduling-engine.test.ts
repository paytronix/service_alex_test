import { describe, expect, it } from "vitest";
import {
  AvailabilityType,
  EmployeeStatus,
  LeaveStatus,
  LeaveType,
  ViolationCode,
  ViolationLevel,
  addDays,
  isoWeekNumber,
  shiftInterval,
  startOfWeek,
  validateAssignment,
  weekDates,
  type AssignmentContextItem,
  type ValidationContext,
} from "@shiftflow/shared";

const candidate = {
  employeeId: "employee",
  date: "2026-09-21",
  startTime: "08:00",
  endTime: "16:00",
  breakMinutes: 0,
  roleId: "barista",
  requiredSkillIds: ["latte"],
};

function context(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    employee: {
      employeeId: "employee",
      status: EmployeeStatus.WORKING,
      roleId: "barista",
      skillIds: ["latte"],
      maxHoursPerWeek: null,
      maxConsecutiveShifts: null,
      minRestHours: null,
    },
    organizationDefaults: { maxWeeklyHours: 40, minRestHours: 8 },
    existingAssignments: [],
    availability: [],
    leaves: [],
    ...overrides,
  };
}

function assignment(
  date: string,
  startTime: string,
  endTime: string,
  id = `${date}-${startTime}`,
): AssignmentContextItem {
  return { id, employeeId: "employee", date, startTime, endTime, breakMinutes: 0 };
}

describe("scheduling date helpers", () => {
  it("normalizes week boundaries and dates", () => {
    expect(startOfWeek("2026-09-23").toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(weekDates("2026-09-23")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(addDays("2026-09-21", 7).toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(isoWeekNumber("2026-01-01")).toBe(1);
  });

  it("builds cross-midnight intervals", () => {
    const interval = shiftInterval("2026-09-21", "22:00", "06:00");
    expect(interval.end.toISOString()).toBe("2026-09-22T06:00:00.000Z");
  });
});

describe("validateAssignment", () => {
  it("has no violations for a clean assignment", () => {
    const result = validateAssignment(candidate, context());
    expect(result).toEqual({ violations: [], hasErrors: false, hasWarnings: false });
  });

  it("reports overlap, including cross-midnight shifts", () => {
    const result = validateAssignment(
      { ...candidate, startTime: "05:00", endTime: "09:00" },
      context({ existingAssignments: [assignment("2026-09-20", "22:00", "06:00")] }),
    );
    expect(result.violations.map((item) => item.code)).toContain(ViolationCode.OVERLAP);
  });

  it("reports insufficient rest", () => {
    const result = validateAssignment(
      candidate,
      context({
        employee: { ...context().employee, minRestHours: 11 },
        existingAssignments: [assignment("2026-09-20", "22:00", "23:00")],
      }),
    );
    expect(result.violations.map((item) => item.code)).toContain(ViolationCode.INSUFFICIENT_REST);
  });

  it("reports overtime as a warning with totals", () => {
    const result = validateAssignment(
      candidate,
      context({
        employee: { ...context().employee, maxHoursPerWeek: 4 },
        existingAssignments: [assignment("2026-09-22", "08:00", "12:00")],
      }),
    );
    const overtime = result.violations.find((item) => item.code === ViolationCode.OVERTIME);
    expect(overtime?.level).toBe(ViolationLevel.WARNING);
    expect(overtime?.meta).toEqual({ totalHours: 12, limit: 4 });
  });

  it("reports leave and inactive status", () => {
    const leave = validateAssignment(
      candidate,
      context({
        leaves: [
          {
            startDate: "2026-09-21",
            endDate: "2026-09-22",
            status: LeaveStatus.APPROVED,
            type: LeaveType.VACATION,
          },
        ],
      }),
    );
    expect(leave.violations.map((item) => item.code)).toContain(ViolationCode.ON_LEAVE);
    const inactive = validateAssignment(
      candidate,
      context({ employee: { ...context().employee, status: EmployeeStatus.DISMISSED } }),
    );
    expect(inactive.violations.map((item) => item.code)).toContain(ViolationCode.EMPLOYEE_INACTIVE);
  });

  it("reports role and skill mismatches", () => {
    const result = validateAssignment(
      { ...candidate, roleId: "cook", requiredSkillIds: ["grill"] },
      context(),
    );
    expect(result.violations.map((item) => item.code)).toEqual(
      expect.arrayContaining([ViolationCode.ROLE_MISMATCH, ViolationCode.SKILL_MISMATCH]),
    );
  });

  it("reports unavailable and available-after conflicts", () => {
    const unavailable = validateAssignment(
      candidate,
      context({ availability: [{ id: "a", employeeId: "employee", dayOfWeek: 1, type: AvailabilityType.UNAVAILABLE, availableFrom: null }] }),
    );
    expect(unavailable.violations.map((item) => item.code)).toContain(ViolationCode.UNAVAILABLE);
    const after = validateAssignment(
      candidate,
      context({ availability: [{ id: "a", employeeId: "employee", dayOfWeek: 1, type: AvailabilityType.AVAILABLE_AFTER, availableFrom: "10:00" }] }),
    );
    expect(after.violations).toEqual([
      expect.objectContaining({ code: ViolationCode.AVAILABLE_AFTER_CONFLICT, level: ViolationLevel.WARNING }),
    ]);
  });

  it("reports consecutive shifts and ignores the assignment being moved", () => {
    const consecutive = validateAssignment(
      candidate,
      context({
        employee: { ...context().employee, maxConsecutiveShifts: 2 },
        existingAssignments: [
          assignment("2026-09-20", "08:00", "16:00"),
          assignment("2026-09-22", "08:00", "16:00"),
        ],
      }),
    );
    expect(consecutive.violations.map((item) => item.code)).toContain(ViolationCode.MAX_CONSECUTIVE_SHIFTS);
    const moved = validateAssignment(
      { ...candidate, id: "same" },
      context({ existingAssignments: [assignment("2026-09-21", "08:00", "16:00", "same")] }),
    );
    expect(moved.violations).toHaveLength(0);
  });
});
