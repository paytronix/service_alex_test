import { describe, expect, it } from "vitest";
import { canAssignShifts, canManageSchedule } from "./permissions";

describe("scheduler permissions", () => {
  it("allows schedule management to owners and managers", () => {
    expect(canManageSchedule("OWNER")).toBe(true);
    expect(canManageSchedule("MANAGER")).toBe(true);
    expect(canManageSchedule("SUPERVISOR")).toBe(false);
    expect(canManageSchedule("EMPLOYEE")).toBe(false);
  });

  it("allows shift assignment to supervisors as well as managers", () => {
    expect(canAssignShifts("OWNER")).toBe(true);
    expect(canAssignShifts("MANAGER")).toBe(true);
    expect(canAssignShifts("SUPERVISOR")).toBe(true);
    expect(canAssignShifts("EMPLOYEE")).toBe(false);
  });
});
