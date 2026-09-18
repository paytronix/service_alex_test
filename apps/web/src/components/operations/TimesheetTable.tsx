import { useState } from "react";

export interface TimesheetRow {
  employeeId: string;
  employeeName: string;
  date: string;
  shiftAssignmentId: string | null;
  timeEntryId: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  plannedMinutes: number;
  actualStartAt: string | null;
  actualEndAt: string | null;
  actualMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: string | null;
  approved: boolean;
  missing: boolean;
  unplanned: boolean;
}

export interface TimesheetData {
  from: string;
  to: string;
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
  rows: TimesheetRow[];
}

export interface AdjustValues {
  clockInAt: string;
  clockOutAt: string | null;
  note: string;
}

interface TimesheetTableProps {
  timesheet?: TimesheetData | null;
  loading: boolean;
  error?: string | null;
  canReview: boolean;
  onAdjust: (timeEntryId: string, values: AdjustValues) => Promise<void> | void;
  onApprove: (timeEntryId: string) => Promise<void> | void;
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function hours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

export function TimesheetTable({
  timesheet,
  loading,
  error,
  canReview,
  onAdjust,
  onApprove,
}: TimesheetTableProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState<AdjustValues>({ clockInAt: "", clockOutAt: "", note: "" });

  if (loading) return <p className="text-gray-500">Loading timesheet...</p>;
  if (error) return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!timesheet) return null;

  const startEdit = (row: TimesheetRow) => {
    setEditing(row.timeEntryId);
    setValues({
      clockInAt: toLocalInput(row.actualStartAt),
      clockOutAt: toLocalInput(row.actualEndAt),
      note: "",
    });
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Planned hours", timesheet.plannedHours],
          ["Actual hours", timesheet.actualHours],
          ["Overtime hours", timesheet.overtimeHours],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg bg-white p-4 shadow">
            <p className="text-xs uppercase text-gray-500">{label}</p>
            <p className="text-2xl font-semibold text-gray-800">{(value as number).toFixed(2)}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Date</th>
              <th className="p-3">Planned</th>
              <th className="p-3">Actual</th>
              <th className="p-3">Planned h</th>
              <th className="p-3">Actual h</th>
              <th className="p-3">Flags</th>
              {canReview && <th className="p-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {timesheet.rows.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={canReview ? 8 : 7}>
                  No timesheet rows in this period.
                </td>
              </tr>
            )}
            {timesheet.rows.map((row) => (
              <tr key={`${row.employeeId}-${row.date}-${row.timeEntryId ?? row.shiftAssignmentId ?? "x"}`} className="border-b last:border-0">
                <td className="p-3">{row.employeeName}</td>
                <td className="p-3">{row.date}</td>
                <td className="p-3">
                  {formatTime(row.plannedStartAt)} – {formatTime(row.plannedEndAt)}
                </td>
                <td className="p-3">
                  {formatTime(row.actualStartAt)} – {formatTime(row.actualEndAt)}
                </td>
                <td className="p-3">{hours(row.plannedMinutes)}</td>
                <td className="p-3">{hours(row.actualMinutes)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {row.missing && (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">missing</span>
                    )}
                    {row.unplanned && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">unplanned</span>
                    )}
                    {row.lateMinutes > 0 && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        late {row.lateMinutes}m
                      </span>
                    )}
                    {row.earlyLeaveMinutes > 0 && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        early {row.earlyLeaveMinutes}m
                      </span>
                    )}
                    {row.overtimeMinutes > 0 && (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        overtime {row.overtimeMinutes}m
                      </span>
                    )}
                    {row.approved && (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">approved</span>
                    )}
                  </div>
                </td>
                {canReview && (
                  <td className="p-3">
                    {row.timeEntryId ? (
                      editing === row.timeEntryId ? (
                        <div className="space-y-2">
                          <input
                            type="datetime-local"
                            aria-label="Clock in"
                            value={values.clockInAt}
                            onChange={(event) =>
                              setValues((current) => ({ ...current, clockInAt: event.target.value }))
                            }
                            className="block rounded-md border border-gray-300 px-2 py-1 text-xs"
                          />
                          <input
                            type="datetime-local"
                            aria-label="Clock out"
                            value={values.clockOutAt ?? ""}
                            onChange={(event) =>
                              setValues((current) => ({ ...current, clockOutAt: event.target.value }))
                            }
                            className="block rounded-md border border-gray-300 px-2 py-1 text-xs"
                          />
                          <input
                            aria-label="Adjustment note"
                            value={values.note}
                            placeholder="Reason"
                            onChange={(event) =>
                              setValues((current) => ({ ...current, note: event.target.value }))
                            }
                            className="block rounded-md border border-gray-300 px-2 py-1 text-xs"
                          />
                          <div className="flex gap-2 text-xs">
                            <button
                              type="button"
                              className="text-primary-600 hover:underline"
                              onClick={async () => {
                                await onAdjust(row.timeEntryId as string, {
                                  clockInAt: values.clockInAt
                                    ? new Date(values.clockInAt).toISOString()
                                    : "",
                                  clockOutAt: values.clockOutAt
                                    ? new Date(values.clockOutAt).toISOString()
                                    : null,
                                  note: values.note,
                                });
                                setEditing(null);
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="text-gray-500 hover:underline"
                              onClick={() => setEditing(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 text-xs">
                          <button
                            type="button"
                            className="text-primary-600 hover:underline"
                            onClick={() => startEdit(row)}
                          >
                            Adjust
                          </button>
                          {!row.approved && (
                            <button
                              type="button"
                              className="text-green-700 hover:underline"
                              onClick={() => onApprove(row.timeEntryId as string)}
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">no entry</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
