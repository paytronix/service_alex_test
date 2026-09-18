import { useDroppable } from "@dnd-kit/core";
import { ShiftCard } from "./ShiftCard";
import type { SchedulerViewProps } from "./types";

function CalendarCell({
  date,
  templateName,
  startTime,
  endTime,
  shiftTemplateId,
  assignments,
  violationsByAssignment,
  canEdit,
  onRemove,
}: {
  date: string;
  templateName: string;
  startTime: string;
  endTime: string;
  shiftTemplateId: string;
  assignments: SchedulerViewProps["assignments"];
  violationsByAssignment: SchedulerViewProps["violationsByAssignment"];
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
      <p className="text-xs font-semibold text-gray-700">
        {templateName} <span className="font-normal text-gray-500">{startTime}–{endTime}</span>
      </p>
      {assignments.map((assignment) => (
        <ShiftCard
          key={assignment.id}
          assignment={assignment}
          violations={violationsByAssignment[assignment.id] ?? []}
          canEdit={canEdit}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

export function CalendarView({
  assignments,
  shiftTemplates,
  violationsByAssignment,
  weekDates,
  canEdit,
  onRemove,
}: SchedulerViewProps) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {weekDates.map((date) => {
        const dayAssignments = assignments.filter((assignment) => assignment.date.slice(0, 10) === date);
        return (
          <section key={date}>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">{date}</h3>
            <div className="space-y-2">
              {shiftTemplates.map((template) => (
                <CalendarCell
                  key={template.id}
                  date={date}
                  templateName={template.name}
                  startTime={template.startTime}
                  endTime={template.endTime}
                  shiftTemplateId={template.id}
                  assignments={dayAssignments.filter((assignment) => assignment.shiftTemplateId === template.id)}
                  violationsByAssignment={violationsByAssignment}
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
