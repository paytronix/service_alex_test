import { useDroppable } from "@dnd-kit/core";
import { ShiftCard } from "./ShiftCard";
import type { SchedulerViewProps } from "./types";

function CalendarCell({
  date,
  shiftTemplateId,
  assignments,
  canEdit,
  onRemove,
}: {
  date: string;
  shiftTemplateId: string;
  assignments: SchedulerViewProps["assignments"];
  canEdit: boolean;
  onRemove: SchedulerViewProps["onRemove"];
}) {
  const droppable = useDroppable({
    id: `calendar-${date}-${shiftTemplateId}`,
    data: { type: "cell", date, shiftTemplateId },
    disabled: !canEdit,
  });
  return (
    <div
      ref={droppable.setNodeRef}
      className={`min-h-28 space-y-2 rounded border bg-gray-50 p-2 ${
        droppable.isOver ? "border-primary-500 bg-primary-50" : "border-gray-200"
      }`}
    >
      {assignments.map((assignment) => (
        <ShiftCard key={assignment.id} assignment={assignment} canEdit={canEdit} onRemove={onRemove} />
      ))}
    </div>
  );
}

export function CalendarView({
  assignments,
  shiftTemplates,
  weekDates,
  canEdit,
  onRemove,
}: SchedulerViewProps) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {weekDates.map((date) => {
        const dayAssignments = assignments.filter((assignment) => assignment.date.slice(0, 10) === date);
        const templateIds = [...new Set(dayAssignments.map((assignment) => assignment.shiftTemplateId))];
        const ids = templateIds.length > 0 ? templateIds : shiftTemplates.slice(0, 1).map((template) => template.id);
        return (
          <section key={date}>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">{date}</h3>
            <div className="space-y-2">
              {ids.map((templateId) => (
                <CalendarCell
                  key={templateId}
                  date={date}
                  shiftTemplateId={templateId}
                  assignments={dayAssignments.filter((assignment) => assignment.shiftTemplateId === templateId)}
                  canEdit={canEdit}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
