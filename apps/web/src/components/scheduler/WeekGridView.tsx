import { useDroppable } from "@dnd-kit/core";
import { ShiftCard } from "./ShiftCard";
import type { SchedulerViewProps } from "./types";

function GridCell({
  date,
  templateId,
  assignments,
  coverage,
  canEdit,
  onRemove,
}: {
  date: string;
  templateId: string;
  assignments: SchedulerViewProps["assignments"];
  coverage: SchedulerViewProps["coverage"];
  canEdit: boolean;
  onRemove: SchedulerViewProps["onRemove"];
}) {
  const droppable = useDroppable({
    id: `grid-${date}-${templateId}`,
    data: { type: "cell", date, shiftTemplateId: templateId },
    disabled: !canEdit,
  });
  const relevant = coverage.filter(
    (item) => item.date.slice(0, 10) === date && item.shiftTemplateId === templateId,
  );
  return (
    <div
      ref={droppable.setNodeRef}
      className={`min-h-28 space-y-1 rounded border p-2 ${
        droppable.isOver ? "border-primary-500 bg-primary-50" : "border-gray-200"
      }`}
    >
      {relevant.map((item) => (
        <p
          key={`${item.roleId}-${item.date}`}
          className={`text-xs ${item.assignedCount >= item.requiredCount ? "text-green-700" : "text-amber-700"}`}
        >
          assigned {item.assignedCount} / required {item.requiredCount}
        </p>
      ))}
      {assignments.map((assignment) => (
        <ShiftCard key={assignment.id} assignment={assignment} canEdit={canEdit} onRemove={onRemove} />
      ))}
    </div>
  );
}

export function WeekGridView({
  assignments,
  shiftTemplates,
  weekDates,
  coverage,
  canEdit,
  onRemove,
}: SchedulerViewProps) {
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
          {shiftTemplates.map((template) => (
            <div key={template.id} className="contents">
              <h3 className="rounded bg-gray-100 p-2 text-sm font-semibold">{template.name}</h3>
              {weekDates.map((date) => (
                <GridCell
                  key={`${template.id}-${date}`}
                  date={date}
                  templateId={template.id}
                  assignments={assignments.filter(
                    (assignment) =>
                      assignment.date.slice(0, 10) === date &&
                      assignment.shiftTemplateId === template.id,
                  )}
                  coverage={coverage}
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
