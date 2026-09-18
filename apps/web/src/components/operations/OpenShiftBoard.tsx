import { useState } from "react";

export interface OpenShiftItem {
  id: string;
  scheduleId: string;
  locationId: string | null;
  date: string;
  shiftTemplateId: string;
  roleId: string;
  requiredCount: number;
  filledCount: number;
  status: string;
  note: string | null;
  claims: { id: string; employeeId: string; status: string }[];
}

interface OpenShiftBoardProps {
  shifts: OpenShiftItem[];
  loading: boolean;
  error?: string | null;
  canManage: boolean;
  roleNames: Record<string, string>;
  templateNames: Record<string, string>;
  onClaim: (openShiftId: string, message: string) => Promise<void> | void;
  onCancel: (id: string) => Promise<void> | void;
}

export function OpenShiftBoard({
  shifts,
  loading,
  error,
  canManage,
  roleNames,
  templateNames,
  onClaim,
  onCancel,
}: OpenShiftBoardProps) {
  const [messages, setMessages] = useState<Record<string, string>>({});

  if (loading) return <p className="text-gray-500">Loading open shifts...</p>;
  if (error) return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Shift board</h2>
      {shifts.length === 0 ? (
        <p className="rounded-lg bg-white p-6 text-sm text-gray-500 shadow">
          No open shifts available for you right now.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shifts.map((shift) => (
            <article key={shift.id} className="space-y-3 rounded-lg bg-white p-4 shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-800">{shift.date.slice(0, 10)}</p>
                  <p className="text-sm text-gray-600">
                    {templateNames[shift.shiftTemplateId] ?? shift.shiftTemplateId}
                  </p>
                  <p className="text-sm text-gray-500">{roleNames[shift.roleId] ?? shift.roleId}</p>
                </div>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {shift.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {shift.filledCount} of {shift.requiredCount} filled ·{" "}
                {shift.claims.filter((claim) => claim.status === "PENDING").length} pending claims
              </p>
              {shift.note && <p className="text-sm text-gray-600">{shift.note}</p>}
              {shift.status === "OPEN" && (
                <div className="space-y-2">
                  <input
                    aria-label={`Message for shift on ${shift.date.slice(0, 10)}`}
                    value={messages[shift.id] ?? ""}
                    placeholder="Message (optional)"
                    onChange={(event) =>
                      setMessages((current) => ({ ...current, [shift.id]: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => onClaim(shift.id, messages[shift.id] ?? "")}
                      className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700"
                    >
                      Take shift
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => onCancel(shift.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
