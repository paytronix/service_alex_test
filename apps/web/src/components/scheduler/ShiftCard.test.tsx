import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShiftCard } from "./ShiftCard";
import type { SchedulerAssignment } from "./types";

const base: SchedulerAssignment = {
  id: "assignment-1",
  employeeId: "employee-1",
  shiftTemplateId: "template-1",
  roleId: "role-1",
  date: "2026-09-21",
  effectiveStartTime: "08:00",
  effectiveEndTime: "16:00",
  crossesMidnight: false,
  durationHours: 8,
  breakMinutes: 30,
  notes: null,
  employee: { id: "employee-1", firstName: "Ada", lastName: "Lovelace", roleId: "role-1", departmentId: null },
  shiftTemplate: { id: "template-1", name: "Morning", startTime: "08:00", endTime: "16:00" },
  role: { id: "role-1", name: "Barista", color: null },
};

function renderCard(violations: SchedulerAssignment["violations"]) {
  return render(
    <DndContext>
      <ShiftCard assignment={{ ...base, violations }} canEdit onRemove={vi.fn()} />
    </DndContext>,
  );
}

describe("ShiftCard", () => {
  it("shows error styling and violation text", () => {
    renderCard([{ code: "OVERLAP", level: "ERROR", message: "Overlaps a shift" }]);
    expect(screen.getByTitle("Overlaps a shift")).toHaveClass("ring-red-500");
  });

  it("shows warning styling", () => {
    const { container } = renderCard([{ code: "OVERTIME", level: "WARNING", message: "Overtime" }]);
    expect(container.querySelector(".ring-amber-400")).toBeInTheDocument();
  });
});
