import { FormEvent, useState } from "react";
import { crossesMidnight, isTimeString } from "@shiftflow/shared";

export interface ShiftTemplateItem {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  breakMinutes: number;
  minEmployees: number;
  maxEmployees: number;
  roleId: string | null;
}

export interface ShiftTemplateFormValues {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  minEmployees: string;
  maxEmployees: string;
  roleId: string;
}

interface ShiftTemplateCatalogSectionProps {
  items: ShiftTemplateItem[];
  roles: { id: string; name: string }[];
  loading: boolean;
  canManage: boolean;
  onCreate: (values: ShiftTemplateFormValues) => Promise<void>;
  onUpdate: (id: string, values: ShiftTemplateFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const emptyForm: ShiftTemplateFormValues = {
  name: "",
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: "0",
  minEmployees: "1",
  maxEmployees: "1",
  roleId: "",
};

export function ShiftTemplateCatalogSection({
  items,
  roles,
  loading,
  canManage,
  onCreate,
  onUpdate,
  onDelete,
}: ShiftTemplateCatalogSectionProps) {
  const [form, setForm] = useState<ShiftTemplateFormValues>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nightShift =
    isTimeString(form.startTime) && isTimeString(form.endTime)
      ? crossesMidnight(form.startTime, form.endTime)
      : false;

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (template: ShiftTemplateItem) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      startTime: template.startTime,
      endTime: template.endTime,
      breakMinutes: String(template.breakMinutes),
      minEmployees: String(template.minEmployees),
      maxEmployees: String(template.maxEmployees),
      roleId: template.roleId ?? "",
    });
    setShowForm(true);
  };

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save shift template");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isTimeString(form.startTime) || !isTimeString(form.endTime)) {
      setError("Start and end time must use the HH:MM 24-hour format");
      return;
    }
    await run(async () => {
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onCreate(form);
      }
      closeForm();
    });
  };

  const handleDelete = async (template: ShiftTemplateItem) => {
    if (!window.confirm(`Delete shift template "${template.name}"?`)) return;
    await run(() => onDelete(template.id));
  };

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Shift Templates</h2>
        {canManage && !showForm && (
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
          >
            New shift template
          </button>
        )}
      </div>

      {canManage && showForm && (
        <form onSubmit={handleSubmit} className="mb-6 grid gap-3 sm:grid-cols-3">
          <label className="text-sm sm:col-span-3">
            Name
            <input
              aria-label="Shift template name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Start time
            <input
              aria-label="Shift start time"
              type="time"
              required
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            End time
            <input
              aria-label="Shift end time"
              type="time"
              required
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Break (minutes)
            <input
              aria-label="Shift break minutes"
              type="number"
              min={0}
              value={form.breakMinutes}
              onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Min employees
            <input
              aria-label="Shift min employees"
              type="number"
              min={1}
              value={form.minEmployees}
              onChange={(e) => setForm({ ...form, minEmployees: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Max employees
            <input
              aria-label="Shift max employees"
              type="number"
              min={1}
              value={form.maxEmployees}
              onChange={(e) => setForm({ ...form, maxEmployees: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Role
            <select
              aria-label="Shift role"
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">Any role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3 sm:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {editingId ? "Save template" : "Create template"}
            </button>
            <button type="button" onClick={closeForm} className="text-gray-500">
              Cancel
            </button>
            {nightShift && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                Crosses midnight
              </span>
            )}
          </div>
        </form>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No shift templates yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="pb-2">Name</th>
              <th className="pb-2">Time</th>
              <th className="pb-2">Break</th>
              <th className="pb-2">Employees</th>
              {canManage && <th className="pb-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((template) => (
              <tr key={template.id} className="border-b last:border-0">
                <td className="py-2">{template.name}</td>
                <td className="py-2">
                  {template.startTime}–{template.endTime}
                  {template.crossesMidnight && (
                    <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                      Night
                    </span>
                  )}
                </td>
                <td className="py-2">{template.breakMinutes} min</td>
                <td className="py-2">
                  {template.minEmployees}–{template.maxEmployees}
                </td>
                {canManage && (
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEditForm(template)}
                      className="mr-3 text-primary-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(template)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
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
