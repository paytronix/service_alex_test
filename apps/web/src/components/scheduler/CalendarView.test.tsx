import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarView } from "./CalendarView";

describe("CalendarView", () => {
  it("renders every shift template cell for each day", () => {
    render(
      <DndContext>
        <CalendarView
          assignments={[]}
          employees={[]}
          shiftTemplates={[
            { id: "template-1", name: "Morning", startTime: "08:00", endTime: "16:00" },
            { id: "template-2", name: "Night", startTime: "22:00", endTime: "06:00" },
          ]}
          roles={[]}
          weekDates={["2026-09-21", "2026-09-22"]}
          coverage={[]}
          violationsByAssignment={{}}
          canEdit
          onRemove={vi.fn()}
        />
      </DndContext>,
    );
    expect(screen.getAllByText("Morning")).toHaveLength(2);
    expect(screen.getAllByText("Night")).toHaveLength(2);
    expect(screen.getAllByText("08:00–16:00")).toHaveLength(2);
  });
});
