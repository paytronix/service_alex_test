import { useDroppable } from "@dnd-kit/core";
import { ShiftCard } from "./ShiftCard";
import type { SchedulerViewProps } from "./types";

function EmployeeCell({
  employeeId,
  date,
  templateId,
  assignments,
  canEdit,
  onRemove,
}: {
  employeeId: string;
  date: string;
  templateId: string;
  assignments: SchedulerViewProps["assignments"];
  canEdit: boolean;
  onRemove: SchedulerViewProps["onRemove"];
}) {
  const droppable = useDroppable({
    id: `employee-${employeeId}-${date}`,
    data: { type: "cell", date, shiftTemplateId: templateId, employeeId },
    disabled: !canEdit,
  });
  return (
    <div
      ref={droppable.setNodeRef}
      className={`min-h-24 rounded border p-1 ${
        droppable.isOver ? "border-primary-500 bg-primary-50" : "border-gray-200"
      }`}
    >
      {assignments.length === 0 ? (
        <span className="text-xs text-gray-400">Off</span>
      ) : (
        assignments.map((assignment) => (
          <ShiftCard key={assignment.id} assignment={assignment} canEdit={canEdit} onRemove={onRemove} />
        ))
      )}
    </div>
  );
}

export function EmployeeView({
  assignments,
  employees,
  shiftTemplates,
  weekDates,
  canEdit,
  onRemove,
}: SchedulerViewProps) {
  const fallbackTemplate = shiftTemplates[0]?.id ?? "";
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] gap-2">
          <div />
          {weekDates.map((date) => (
            <h3 key={date} className="text-center text-sm font-semibold text-gray-700">
              {date}
            </h3>
          ))}
          {employees.map((employee) => (
            <div key={employee.id} className="contents">
              <h3 className="rounded bg-gray-100 p-2 text-sm font-semibold">
                {employee.firstName} {employee.lastName}
              </h3>
              {weekDates.map((date) => (
                <EmployeeCell
                  key={`${employee.id}-${date}`}
                  employeeId={employee.id}
                  date={date}
                  templateId={
                    assignments.find(
                      (assignment) =>
                        assignment.employeeId === employee.id &&
                        assignment.date.slice(0, 10) === date,
                    )?.shiftTemplateId ?? fallbackTemplate
                  }
                  assignments={assignments.filter(
                    (assignment) =>
                      assignment.employeeId === employee.id &&
                      assignment.date.slice(0, 10) === date,
                  )}
                  canEdit={canEdit}
                  onRemove={onRemove}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
