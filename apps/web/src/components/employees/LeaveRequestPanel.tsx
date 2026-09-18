import { FormEvent, useState } from "react";
import { LeaveStatus, LeaveType } from "@shiftflow/shared";

export interface LeaveRequestItem {
  id: string;
  employeeId: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface LeaveRequestFormValues {
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
}

interface LeaveRequestPanelProps {
  title?: string;
  items: LeaveRequestItem[];
  loading: boolean;
  canReview: boolean;
  canCreate: boolean;
  employeeNames?: Record<string, string>;
  onCreate: (values: LeaveRequestFormValues) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

const emptyForm: LeaveRequestFormValues = {
  type: LeaveType.VACATION,
  startDate: "",
  endDate: "",
  reason: "",
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

export function LeaveRequestPanel({
  title = "Leave requests",
  items,
  loading,
  canReview,
  canCreate,
  employeeNames,
  onCreate,
  onApprove,
  onReject,
}: LeaveRequestPanelProps) {
  const [form, setForm] = useState<LeaveRequestFormValues>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update leave request");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError("End date must not be earlier than start date");
      return;
    }
    await run(async () => {
      await onCreate(form);
      setForm(emptyForm);
    });
  };

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h3 className="mb-4 text-base font-semibold">{title}</h3>

      {canCreate && (
        <form onSubmit={handleCreate} className="mb-4 grid gap-3 md:grid-cols-4">
          <label className="text-sm text-gray-600">
            Type
            <select
              aria-label="Leave type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            >
              {Object.values(LeaveType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-600">
            Start date
            <input
              aria-label="Leave start date"
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-600">
            End date
            <input
              aria-label="Leave end date"
              type="date"
              required
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-600">
            Reason
            <input
              aria-label="Leave reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50 md:col-span-4 md:justify-self-start"
          >
            Request leave
          </button>
        </form>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading leave requests...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No leave requests.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              {employeeNames && <th className="pb-2">Employee</th>}
              <th className="pb-2">Type</th>
              <th className="pb-2">Period</th>
              <th className="pb-2">Status</th>
              {canReview && <th className="pb-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                {employeeNames && (
                  <td className="py-2">{employeeNames[item.employeeId] ?? "—"}</td>
                )}
                <td className="py-2">{item.type}</td>
                <td className="py-2">
                  {formatDate(item.startDate)} → {formatDate(item.endDate)}
                </td>
                <td className="py-2">{item.status}</td>
                {canReview && (
                  <td className="py-2 text-right">
                    {item.status === LeaveStatus.PENDING ? (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => run(() => onApprove(item.id))}
                          className="mr-3 text-primary-600 hover:underline"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => run(() => onReject(item.id))}
                          className="text-red-600 hover:underline"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-400">Reviewed</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
