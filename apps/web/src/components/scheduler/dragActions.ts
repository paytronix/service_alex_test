import type { ActiveDrag, DropTarget } from "./types";

export type DragAction =
  | { kind: "assign"; employeeId: string; date: string; shiftTemplateId: string }
  | { kind: "move" | "copy"; assignmentId: string; date: string; shiftTemplateId: string; employeeId?: string }
  | { kind: "needs-shift" }
  | { kind: "noop" };

export function resolveDragAction({
  active,
  over,
  copy,
}: {
  active: ActiveDrag;
  over: DropTarget | null;
  copy: boolean;
}): DragAction {
  if (!over) return { kind: "noop" };
  if (active.type === "employee") {
    if (!over.shiftTemplateId) return { kind: "needs-shift" };
    return {
      kind: "assign",
      employeeId: active.employee.id,
      date: over.date,
      shiftTemplateId: over.shiftTemplateId,
    };
  }
  const shiftTemplateId = over.shiftTemplateId ?? active.assignment.shiftTemplateId;
  const sameCell =
    active.assignment.date.slice(0, 10) === over.date &&
    active.assignment.shiftTemplateId === shiftTemplateId &&
    (!over.employeeId || active.assignment.employeeId === over.employeeId);
  if (sameCell) return { kind: "noop" };
  return {
    kind: copy ? "copy" : "move",
    assignmentId: active.assignment.id,
    date: over.date,
    shiftTemplateId,
    ...(over.employeeId ? { employeeId: over.employeeId } : {}),
  };
}
