import { FormEvent, useState } from "react";
import { DEFAULT_ROLE_COLOR } from "@shiftflow/shared";

export interface RoleItem {
  id: string;
  name: string;
  color: string;
  description: string | null;
  maxLoad: number | null;
  hourlyRate: number | null;
}

export interface RoleFormValues {
  name: string;
  color: string;
  description: string;
  maxLoad: string;
  hourlyRate: string;
}

interface RoleCatalogSectionProps {
  items: RoleItem[];
  loading: boolean;
  canManage: boolean;
  onCreate: (values: RoleFormValues) => Promise<void>;
  onUpdate: (id: string, values: RoleFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const emptyForm: RoleFormValues = {
  name: "",
  color: DEFAULT_ROLE_COLOR,
  description: "",
  maxLoad: "",
  hourlyRate: "",
};

export function RoleCatalogSection({
  items,
  loading,
  canManage,
  onCreate,
  onUpdate,
  onDelete,
}: RoleCatalogSectionProps) {
  const [form, setForm] = useState<RoleFormValues>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const openEditForm = (role: RoleItem) => {
    setEditingId(role.id);
    setForm({
      name: role.name,
      color: role.color,
      description: role.description ?? "",
      maxLoad: role.maxLoad === null ? "" : String(role.maxLoad),
      hourlyRate: role.hourlyRate === null ? "" : String(role.hourlyRate),
    });
    setShowForm(true);
  };

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await run(async () => {
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onCreate(form);
      }
      closeForm();
    });
  };

  const handleDelete = async (role: RoleItem) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    await run(() => onDelete(role.id));
  };

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Roles</h2>
        {canManage && !showForm && (
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
          >
            New role
          </button>
        )}
      </div>

      {canManage && showForm && (
        <form onSubmit={handleSubmit} className="mb-6 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Name
            <input
              aria-label="Role name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Color
            <input
              aria-label="Role color"
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-gray-300 px-1"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Description
            <input
              aria-label="Role description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Max load
            <input
              aria-label="Role max load"
              type="number"
              min={1}
              value={form.maxLoad}
              onChange={(e) => setForm({ ...form, maxLoad: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Hourly rate
            <input
              aria-label="Role hourly rate"
              type="number"
              min={0}
              step="0.01"
              value={form.hourlyRate}
              onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {editingId ? "Save role" : "Create role"}
            </button>
            <button type="button" onClick={closeForm} className="text-gray-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No roles yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="pb-2">Name</th>
              <th className="pb-2">Description</th>
              <th className="pb-2">Max load</th>
              <th className="pb-2">Hourly rate</th>
              {canManage && <th className="pb-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((role) => (
              <tr key={role.id} className="border-b last:border-0">
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <span
                      data-testid={`role-color-${role.id}`}
                      title={role.color}
                      style={{ backgroundColor: role.color }}
                      className="inline-block h-3 w-3 rounded-full"
                    />
                    {role.name}
                  </span>
                </td>
                <td className="py-2 text-gray-600">{role.description ?? "—"}</td>
                <td className="py-2">{role.maxLoad ?? "—"}</td>
                <td className="py-2">{role.hourlyRate ?? "—"}</td>
                {canManage && (
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEditForm(role)}
                      className="mr-3 text-primary-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(role)}
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
