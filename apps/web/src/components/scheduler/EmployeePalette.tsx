import { useDraggable } from "@dnd-kit/core";
import type { SchedulerEmployee } from "./types";

interface EmployeePaletteProps {
  employees: SchedulerEmployee[];
  canEdit: boolean;
}

function PaletteEmployee({ employee, canEdit }: { employee: SchedulerEmployee; canEdit: boolean }) {
  const draggable = useDraggable({
    id: `employee-${employee.id}`,
    disabled: !canEdit,
    data: { type: "employee", employee },
  });
  return (
    <li
      ref={draggable.setNodeRef}
      {...draggable.attributes}
      {...draggable.listeners}
      className={`rounded border bg-white px-3 py-2 text-sm shadow-sm ${
        canEdit ? "cursor-grab hover:border-primary-400" : ""
      }`}
    >
      {employee.firstName} {employee.lastName}
    </li>
  );
}

export function EmployeePalette({ employees, canEdit }: EmployeePaletteProps) {
  return (
    <aside className="rounded-lg bg-gray-100 p-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Employees</h3>
      <ul className="space-y-2">
        {employees.map((employee) => (
          <PaletteEmployee key={employee.id} employee={employee} canEdit={canEdit} />
        ))}
      </ul>
    </aside>
  );
}
