import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RoleView } from "./RoleView";

describe("RoleView", () => {
  it("renders role groups and assigned employees", () => {
    render(
      <DndContext>
        <RoleView
          assignments={[
            {
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
            },
          ]}
          employees={[]}
          shiftTemplates={[]}
          roles={[{ id: "role-1", name: "Barista", color: null }]}
          weekDates={["2026-09-21"]}
          coverage={[]}
          violationsByAssignment={{}}
          canEdit
          onRemove={vi.fn()}
        />
      </DndContext>,
    );
    expect(screen.getByText("Barista")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("shows assignments without a role in the No role group", () => {
    render(
      <DndContext>
        <RoleView
          assignments={[
            {
              id: "assignment-unassigned",
              employeeId: "employee-1",
              shiftTemplateId: "template-1",
              roleId: null,
              date: "2026-09-21",
              effectiveStartTime: "08:00",
              effectiveEndTime: "16:00",
              crossesMidnight: false,
              durationHours: 8,
              breakMinutes: 30,
              notes: null,
              employee: { id: "employee-1", firstName: "Ada", lastName: "Lovelace", roleId: null, departmentId: null },
              shiftTemplate: { id: "template-1", name: "Morning", startTime: "08:00", endTime: "16:00" },
              role: null,
            },
          ]}
          employees={[]}
          shiftTemplates={[]}
          roles={[]}
          weekDates={["2026-09-21"]}
          coverage={[]}
          violationsByAssignment={{}}
          canEdit
          onRemove={vi.fn()}
        />
      </DndContext>,
    );
    expect(screen.getByText("No role")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });
});
