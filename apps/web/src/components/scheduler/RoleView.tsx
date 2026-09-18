import { useDroppable } from "@dnd-kit/core";
import { ShiftCard } from "./ShiftCard";
import type { SchedulerViewProps } from "./types";

function RoleDayCell({
  roleId,
  date,
  assignments,
  canEdit,
  onRemove,
}: {
  roleId: string;
  date: string;
  assignments: SchedulerViewProps["assignments"];
  canEdit: boolean;
  onRemove: SchedulerViewProps["onRemove"];
}) {
  const droppable = useDroppable({
    id: `role-${roleId}-${date}`,
    data: { type: "cell", date, shiftTemplateId: assignments[0]?.shiftTemplateId ?? "" },
    disabled: !canEdit,
  });
  return (
    <div
      ref={droppable.setNodeRef}
      className={`min-h-24 rounded border p-1 ${
        droppable.isOver ? "border-primary-500 bg-primary-50" : "border-gray-200"
      }`}
    >
      <p className="mb-1 text-xs text-gray-500">{date}</p>
      {assignments.map((assignment) => (
        <ShiftCard key={assignment.id} assignment={assignment} canEdit={canEdit} onRemove={onRemove} />
      ))}
    </div>
  );
}

function RoleSection({
  role,
  assignments,
  weekDates,
  canEdit,
  onRemove,
}: {
  role: SchedulerViewProps["roles"][number];
  assignments: SchedulerViewProps["assignments"];
  weekDates: string[];
  canEdit: boolean;
  onRemove: SchedulerViewProps["onRemove"];
}) {
  const roleAssignments = assignments.filter((assignment) => assignment.roleId === role.id);
  return (
    <section>
      <h3 className="mb-2 border-b-2 border-slate-500 pb-1 text-lg font-semibold">{role.name}</h3>
      <div className="grid gap-2 md:grid-cols-7">
        {weekDates.map((date) => {
          const cellAssignments = roleAssignments.filter(
            (assignment) => assignment.date.slice(0, 10) === date,
          );
          return (
            <RoleDayCell
              key={date}
              roleId={role.id}
              date={date}
              assignments={cellAssignments}
              canEdit={canEdit}
              onRemove={onRemove}
            />
          );
        })}
      </div>
    </section>
  );
}

export function RoleView({
  assignments,
  roles,
  weekDates,
  canEdit,
  onRemove,
}: SchedulerViewProps) {
  return (
    <div className="space-y-6">
      {roles.map((role) => (
        <RoleSection
          key={role.id}
          role={role}
          assignments={assignments}
          weekDates={weekDates}
          canEdit={canEdit}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
