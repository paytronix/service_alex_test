import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  CANCEL_OPEN_SHIFT_MUTATION,
  GENERATE_OPEN_SHIFTS_MUTATION,
  OPEN_SHIFTS_QUERY,
  PUBLISH_OPEN_SHIFT_MUTATION,
} from "../../lib/graphql";

interface OpenShift {
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

interface OpenShiftPanelProps {
  organizationId: string;
  scheduleId: string;
  locationId: string | null;
  weekDates: string[];
  shiftTemplates: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  canManage: boolean;
}

/** Planner-side indicator of unfilled demand published to the open-shift board. */
export function OpenShiftPanel({
  organizationId,
  scheduleId,
  locationId,
  weekDates,
  shiftTemplates,
  roles,
  canManage,
}: OpenShiftPanelProps) {
  const [form, setForm] = useState({
    date: weekDates[0] ?? "",
    shiftTemplateId: shiftTemplates[0]?.id ?? "",
    roleId: roles[0]?.id ?? "",
    requiredCount: "1",
    note: "",
  });
  const [error, setError] = useState<string | null>(null);

  const variables = { organizationId, scheduleId };
  const openShifts = useQuery<{ openShifts: OpenShift[] }>(OPEN_SHIFTS_QUERY, { variables });
  const refetchQueries = [{ query: OPEN_SHIFTS_QUERY, variables }];
  const [publishOpenShift] = useMutation(PUBLISH_OPEN_SHIFT_MUTATION, { refetchQueries });
  const [generateOpenShifts] = useMutation(GENERATE_OPEN_SHIFTS_MUTATION, { refetchQueries });
  const [cancelOpenShift] = useMutation(CANCEL_OPEN_SHIFT_MUTATION, { refetchQueries });

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  };

  const templateName = (id: string) => shiftTemplates.find((item) => item.id === id)?.name ?? id;
  const roleName = (id: string) => roles.find((item) => item.id === id)?.name ?? id;

  return (
    <section className="mt-6 rounded-lg bg-white p-4 shadow">
      <h2 className="mb-3 text-base font-semibold">Open shifts</h2>
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {openShifts.loading ? (
        <p className="text-sm text-gray-500">Loading open shifts...</p>
      ) : (openShifts.data?.openShifts ?? []).length === 0 ? (
        <p className="text-sm text-gray-500">No open shifts published for this schedule.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {(openShifts.data?.openShifts ?? []).map((shift) => (
            <li key={shift.id} className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                {shift.status}
              </span>
              <span>{shift.date.slice(0, 10)}</span>
              <span className="text-gray-600">{templateName(shift.shiftTemplateId)}</span>
              <span className="text-gray-500">{roleName(shift.roleId)}</span>
              <span className="text-xs text-gray-500">
                {shift.filledCount}/{shift.requiredCount} filled ·{" "}
                {shift.claims.filter((claim) => claim.status === "PENDING").length} pending
              </span>
              {canManage && shift.status === "OPEN" && (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => run(() => cancelOpenShift({ variables: { organizationId, id: shift.id } }))}
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <select
            aria-label="Open shift date"
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            {weekDates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
          <select
            aria-label="Open shift template"
            value={form.shiftTemplateId}
            onChange={(event) =>
              setForm((current) => ({ ...current, shiftTemplateId: event.target.value }))
            }
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            {shiftTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Open shift role"
            value={form.roleId}
            onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Required count"
            type="number"
            min={1}
            value={form.requiredCount}
            onChange={(event) =>
              setForm((current) => ({ ...current, requiredCount: event.target.value }))
            }
            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-xs"
          />
          <input
            aria-label="Open shift note"
            value={form.note}
            placeholder="Note"
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              run(() =>
                publishOpenShift({
                  variables: {
                    organizationId,
                    scheduleId,
                    date: new Date(`${form.date}T00:00:00.000Z`).toISOString(),
                    shiftTemplateId: form.shiftTemplateId,
                    roleId: form.roleId,
                    requiredCount: Number.parseInt(form.requiredCount, 10) || 1,
                    locationId,
                    note: form.note || null,
                  },
                }),
              )
            }
            className="rounded-md bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-700"
          >
            Publish open shift
          </button>
          <button
            type="button"
            onClick={() => run(() => generateOpenShifts({ variables: { organizationId, scheduleId } }))}
            className="rounded-md border border-primary-600 px-3 py-1 text-xs text-primary-700 hover:bg-primary-50"
          >
            Generate from understaffed requirements
          </button>
        </div>
      )}
    </section>
  );
}
