import { useDroppable } from "@dnd-kit/core";
import { ShiftCard } from "./ShiftCard";
import type { SchedulerViewProps } from "./types";

function RoleDayCell({
  roleId,
  date,
  assignments,
  violationsByAssignment,
  canEdit,
  onRemove,
}: {
  roleId: string;
  date: string;
  assignments: SchedulerViewProps["assignments"];
  violationsByAssignment: SchedulerViewProps["violationsByAssignment"];
  canEdit: boolean;
  onRemove: SchedulerViewProps["onRemove"];
}) {
  const droppable = useDroppable({
    id: `role-${roleId}-${date}`,
    data: { type: "cell", date, shiftTemplateId: null },
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

function RoleSection({
  role,
  assignments,
  violationsByAssignment,
  weekDates,
  canEdit,
  onRemove,
}: {
  role: SchedulerViewProps["roles"][number];
  assignments: SchedulerViewProps["assignments"];
  violationsByAssignment: SchedulerViewProps["violationsByAssignment"];
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
              violationsByAssignment={violationsByAssignment}
              canEdit={canEdit}
              onRemove={onRemove}
            />
          );
        })}
      </div>
    </section>
  );
}

function UnassignedRoleSection({
  assignments,
  violationsByAssignment,
  weekDates,
  canEdit,
  onRemove,
}: {
  assignments: SchedulerViewProps["assignments"];
  violationsByAssignment: SchedulerViewProps["violationsByAssignment"];
  weekDates: string[];
  canEdit: boolean;
  onRemove: SchedulerViewProps["onRemove"];
}) {
  return (
    <section>
      <h3 className="mb-2 border-b-2 border-slate-500 pb-1 text-lg font-semibold">No role</h3>
      <div className="grid gap-2 md:grid-cols-7">
        {weekDates.map((date) => (
          <RoleDayCell
            key={date}
            roleId="unassigned"
            date={date}
            assignments={assignments.filter((assignment) => assignment.date.slice(0, 10) === date)}
            violationsByAssignment={violationsByAssignment}
            canEdit={canEdit}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}

export function RoleView({
  assignments,
  roles,
  weekDates,
  violationsByAssignment,
  canEdit,
  onRemove,
}: SchedulerViewProps) {
  const unassigned = assignments.filter((assignment) => assignment.roleId === null);
  return (
    <div className="space-y-6">
      {roles.map((role) => (
        <RoleSection
          key={role.id}
          role={role}
          assignments={assignments}
          violationsByAssignment={violationsByAssignment}
          weekDates={weekDates}
          canEdit={canEdit}
          onRemove={onRemove}
        />
      ))}
      {unassigned.length > 0 && (
        <UnassignedRoleSection
          assignments={unassigned}
          violationsByAssignment={violationsByAssignment}
          weekDates={weekDates}
          canEdit={canEdit}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}
