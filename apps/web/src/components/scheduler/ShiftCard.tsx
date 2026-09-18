import { useDraggable } from "@dnd-kit/core";
import { useShiftInteraction } from "./ShiftInteractionContext";
import type { SchedulerAssignment, SchedulerViolation } from "./types";

interface ShiftCardProps {
  assignment: SchedulerAssignment;
  violations: SchedulerViolation[];
  canEdit: boolean;
  onRemove: (assignment: SchedulerAssignment) => void;
}

function violationClass(violations: SchedulerViolation[]): string {
  if (violations.some((violation) => violation.level === "ERROR")) {
    return "ring-2 ring-red-500";
  }
  if (violations.some((violation) => violation.level === "WARNING")) {
    return "ring-2 ring-amber-400";
  }
  return "";
}

function roleAccentClass(color: string | null): string {
  const accents: Record<string, string> = {
    "#3B82F6": "border-l-blue-500",
    "#8B5CF6": "border-l-violet-500",
    "#F97316": "border-l-orange-500",
    "#10B981": "border-l-emerald-500",
    "#EF4444": "border-l-red-500",
  };
  return accents[color ?? ""] ?? "border-l-slate-500";
}

export function ShiftCard({ assignment, violations, canEdit, onRemove }: ShiftCardProps) {
  const draggable = useDraggable({
    id: `assignment-${assignment.id}`,
    disabled: !canEdit,
    data: { type: "assignment", assignment },
  });
  const messages = violations.map((violation) => violation.message).join(" | ");
  const interaction = useShiftInteraction();
  const selected = interaction.selectedIds.includes(assignment.id);
  return (
    <article
      ref={draggable.setNodeRef}
      title={messages || `${assignment.effectiveStartTime}–${assignment.effectiveEndTime}`}
      className={`relative rounded border border-l-4 bg-white p-2 text-left shadow-sm ${
        draggable.isDragging ? "opacity-50" : ""
      } ${selected ? "outline outline-2 outline-primary-500" : ""} ${roleAccentClass(
        assignment.role?.color ?? null,
      )} ${violationClass(violations)}`}
      {...draggable.attributes}
      {...draggable.listeners}
    >
      <div className="flex items-center gap-2">
        {canEdit && (
          <input
            type="checkbox"
            aria-label={`Select shift for ${assignment.employee.firstName} ${assignment.employee.lastName}`}
            checked={selected}
            onChange={() => interaction.toggleSelected(assignment.id)}
            onPointerDown={(event) => event.stopPropagation()}
          />
        )}
        <button
          type="button"
          className="text-xs text-primary-700 underline"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => interaction.openDetails(assignment)}
        >
          Details
        </button>
      </div>
      <p className="truncate text-xs font-semibold">
        {assignment.employee.firstName} {assignment.employee.lastName}
      </p>
      <p className="truncate text-xs text-gray-600">{assignment.shiftTemplate.name}</p>
      <p className="text-xs text-gray-500">
        {assignment.effectiveStartTime}–{assignment.effectiveEndTime}
        {assignment.crossesMidnight ? " (+1)" : ""}
      </p>
      {canEdit && (
        <button
          type="button"
          aria-label={`Remove ${assignment.employee.firstName} ${assignment.employee.lastName} shift`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(assignment);
          }}
          className="absolute right-1 top-1 text-xs text-gray-400 hover:text-red-600"
        >
          ×
        </button>
      )}
    </article>
  );
}
