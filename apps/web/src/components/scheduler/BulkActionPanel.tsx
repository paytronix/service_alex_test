import { useMutation } from "@apollo/client";
import { useState } from "react";
import {
  BULK_COPY_SHIFTS_MUTATION,
  BULK_MOVE_SHIFTS_MUTATION,
  BULK_REMOVE_SHIFTS_MUTATION,
} from "../../lib/graphql";
import type { SchedulerAssignment, SchedulerEmployee, SchedulerViolation } from "./types";

interface BulkItemResult {
  index: number;
  success: boolean;
  assignmentId: string | null;
  message: string | null;
  errors: SchedulerViolation[];
}

interface BulkResult {
  operation: string;
  successCount: number;
  failureCount: number;
  results: BulkItemResult[];
}

interface BulkActionPanelProps {
  organizationId: string;
  selected: SchedulerAssignment[];
  employees: SchedulerEmployee[];
  weekDates: string[];
  onClearSelection: () => void;
  onChanged: () => void;
}

function dateTime(date: string): string {
  return `${date}T00:00:00.000Z`;
}

export function BulkActionPanel({
  organizationId,
  selected,
  employees,
  weekDates,
  onClearSelection,
  onChanged,
}: BulkActionPanelProps) {
  const [targetDate, setTargetDate] = useState(weekDates[0] ?? "");
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bulkRemove] = useMutation<{ bulkRemoveShifts: BulkResult }>(BULK_REMOVE_SHIFTS_MUTATION);
  const [bulkCopy] = useMutation<{ bulkCopyShifts: BulkResult }>(BULK_COPY_SHIFTS_MUTATION);
  const [bulkMove] = useMutation<{ bulkMoveShifts: BulkResult }>(BULK_MOVE_SHIFTS_MUTATION);

  if (selected.length === 0) return null;

  const run = async (action: () => Promise<BulkResult | null | undefined>): Promise<void> => {
    setError(null);
    try {
      const payload = await action();
      setResult(payload ?? null);
      onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The bulk action failed");
    }
  };

  const assignmentIds = selected.map((assignment) => assignment.id);

  return (
    <section className="space-y-3 rounded border border-primary-300 bg-primary-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{selected.length} shifts selected</h2>
        <button type="button" className="text-xs underline" onClick={onClearSelection}>
          Clear selection
        </button>
      </div>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm">
          <span className="text-gray-600">Target date</span>
          <select
            className="rounded border px-2 py-1"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          >
            {weekDates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-gray-600">Target employee</span>
          <select
            className="rounded border px-2 py-1"
            value={targetEmployeeId}
            onChange={(event) => setTargetEmployeeId(event.target.value)}
          >
            <option value="">Keep current</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded border bg-white px-3 py-2 text-sm"
          onClick={() =>
            void run(async () => {
              const response = await bulkCopy({
                variables: {
                  organizationId,
                  items: assignmentIds.map((id) => ({
                    assignmentId: id,
                    date: dateTime(targetDate),
                    employeeId: targetEmployeeId || null,
                  })),
                },
              });
              return response.data?.bulkCopyShifts;
            })
          }
        >
          Copy
        </button>
        <button
          type="button"
          className="rounded border bg-white px-3 py-2 text-sm"
          onClick={() =>
            void run(async () => {
              const response = await bulkMove({
                variables: {
                  organizationId,
                  items: assignmentIds.map((id) => ({
                    assignmentId: id,
                    date: dateTime(targetDate),
                    employeeId: targetEmployeeId || null,
                  })),
                },
              });
              return response.data?.bulkMoveShifts;
            })
          }
        >
          Move
        </button>
        <button
          type="button"
          className="rounded bg-red-600 px-3 py-2 text-sm text-white"
          onClick={() =>
            void run(async () => {
              const response = await bulkRemove({
                variables: { organizationId, assignmentIds },
              });
              onClearSelection();
              return response.data?.bulkRemoveShifts;
            })
          }
        >
          Remove
        </button>
      </div>
      {result && (
        <div className="rounded bg-white p-3 text-sm">
          <p className="font-semibold">
            {result.operation}: {result.successCount} succeeded, {result.failureCount} failed
          </p>
          <ul className="mt-1 space-y-1">
            {result.results.map((item) => (
              <li key={item.index} className={item.success ? "text-green-700" : "text-red-700"}>
                #{item.index + 1} {item.success ? "OK" : "failed"}
                {item.message ? ` — ${item.message}` : ""}
                {item.errors.length > 0
                  ? ` — ${item.errors.map((violation) => violation.message).join("; ")}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
