import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmployeeView } from "./EmployeeView";

describe("EmployeeView", () => {
  it("renders employee rows and off days", () => {
    render(
      <DndContext>
        <EmployeeView
          assignments={[]}
          employees={[{ id: "employee-1", firstName: "Ada", lastName: "Lovelace", roleId: null, departmentId: null }]}
          shiftTemplates={[{ id: "template-1", name: "Morning", startTime: "08:00", endTime: "16:00" }]}
          roles={[]}
          weekDates={["2026-09-21"]}
          coverage={[]}
          canEdit
          onRemove={vi.fn()}
        />
      </DndContext>,
    );
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();
  });
});
