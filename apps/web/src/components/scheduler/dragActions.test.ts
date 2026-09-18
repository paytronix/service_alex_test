import { describe, expect, it } from "vitest";
import { resolveDragAction } from "./dragActions";
import type { ActiveDrag, DropTarget } from "./types";

const employee = { id: "employee-1", firstName: "Ada", lastName: "Lovelace", roleId: "role-1", departmentId: null };
const assignment = {
  id: "assignment-1",
  employeeId: employee.id,
  shiftTemplateId: "template-1",
  roleId: "role-1",
  date: "2026-09-21",
  effectiveStartTime: "08:00",
  effectiveEndTime: "16:00",
  crossesMidnight: false,
  durationHours: 8,
  breakMinutes: 30,
  notes: null,
  employee,
  shiftTemplate: { id: "template-1", name: "Morning", startTime: "08:00", endTime: "16:00" },
  role: { id: "role-1", name: "Barista", color: null },
} as const;
const cell: DropTarget = { type: "cell", date: "2026-09-22", shiftTemplateId: "template-1" };

describe("resolveDragAction", () => {
  it("assigns a palette employee to a cell", () => {
    const active: ActiveDrag = { type: "employee", employee };
    expect(resolveDragAction({ active, over: cell, copy: false })).toEqual({
      kind: "assign",
      employeeId: employee.id,
      date: cell.date,
      shiftTemplateId: cell.shiftTemplateId,
    });
  });

  it("moves a card to a cell", () => {
    const active: ActiveDrag = { type: "assignment", assignment };
    expect(resolveDragAction({ active, over: cell, copy: false })).toMatchObject({
      kind: "move",
      assignmentId: assignment.id,
    });
  });

  it("copies a card when the modifier is held", () => {
    const active: ActiveDrag = { type: "assignment", assignment };
    expect(resolveDragAction({ active, over: cell, copy: true })).toMatchObject({
      kind: "copy",
      assignmentId: assignment.id,
    });
  });

  it("does nothing when dropped in the same cell", () => {
    const active: ActiveDrag = { type: "assignment", assignment };
    expect(
      resolveDragAction({
        active,
        over: { type: "cell", date: assignment.date, shiftTemplateId: assignment.shiftTemplateId },
        copy: false,
      }),
    ).toEqual({ kind: "noop" });
  });

  it("keeps a card's template when dropped on an employee row", () => {
    const active: ActiveDrag = { type: "assignment", assignment };
    expect(
      resolveDragAction({
        active,
        over: { type: "cell", date: "2026-09-22", shiftTemplateId: null, employeeId: "employee-2" },
        copy: false,
      }),
    ).toEqual({
      kind: "move",
      assignmentId: assignment.id,
      date: "2026-09-22",
      shiftTemplateId: assignment.shiftTemplateId,
      employeeId: "employee-2",
    });
  });

  it("requires a shift when a palette employee is dropped on a template-less cell", () => {
    const active: ActiveDrag = { type: "employee", employee };
    expect(
      resolveDragAction({
        active,
        over: { type: "cell", date: "2026-09-22", shiftTemplateId: null },
        copy: false,
      }),
    ).toEqual({ kind: "needs-shift" });
  });
});
