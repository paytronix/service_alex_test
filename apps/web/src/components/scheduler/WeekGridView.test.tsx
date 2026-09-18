import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WeekGridView } from "./WeekGridView";

const employee = { id: "employee-1", firstName: "Ada", lastName: "Lovelace", roleId: "role-1", departmentId: null };
const template = { id: "template-1", name: "Morning", startTime: "08:00", endTime: "16:00" };
const assignment = {
  id: "assignment-1",
  employeeId: employee.id,
  shiftTemplateId: template.id,
  roleId: "role-1",
  date: "2026-09-21",
  effectiveStartTime: "08:00",
  effectiveEndTime: "16:00",
  crossesMidnight: false,
  durationHours: 8,
  breakMinutes: 30,
  notes: null,
  employee,
  shiftTemplate: template,
  role: { id: "role-1", name: "Barista", color: null },
};

describe("WeekGridView", () => {
  it("renders assigned employees and under-covered indicators", () => {
    render(
      <DndContext>
        <WeekGridView
          assignments={[assignment]}
          employees={[employee]}
          shiftTemplates={[template]}
          roles={[{ id: "role-1", name: "Barista", color: null }]}
          weekDates={["2026-09-21"]}
          coverage={[{ date: "2026-09-21", shiftTemplateId: template.id, roleId: "role-1", assignedCount: 1, requiredCount: 2 }]}
          violationsByAssignment={{}}
          canEdit
          onRemove={vi.fn()}
        />
      </DndContext>,
    );
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("assigned 1 / required 2")).toHaveClass("text-amber-700");
  });
});
