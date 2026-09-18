import { FormEvent, useState } from "react";

export interface NameCatalogItem {
  id: string;
  name: string;
}

interface NameCatalogSectionProps {
  title: string;
  entityLabel: string;
  items: NameCatalogItem[];
  loading: boolean;
  canManage: boolean;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function NameCatalogSection({
  title,
  entityLabel,
  items,
  loading,
  canManage,
  onCreate,
  onUpdate,
  onDelete,
}: NameCatalogSectionProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save ${entityLabel}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await run(async () => {
      await onCreate(name.trim());
      setName("");
    });
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    await run(async () => {
      await onUpdate(editingId, editingName.trim());
      setEditingId(null);
      setEditingName("");
    });
  };

  const handleDelete = async (item: NameCatalogItem) => {
    if (!window.confirm(`Delete ${entityLabel} "${item.name}"?`)) return;
    await run(() => onDelete(item.id));
  };

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>

      {canManage && (
        <form onSubmit={handleCreate} className="mb-4 flex gap-3">
          <input
            aria-label={`New ${entityLabel} name`}
            placeholder={`New ${entityLabel} name`}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No {entityLabel}s yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="pb-2">Name</th>
              {canManage && <th className="pb-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="py-2">
                  {editingId === item.id ? (
                    <form onSubmit={handleUpdate} className="flex gap-2">
                      <input
                        aria-label={`Edit ${entityLabel} name`}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 rounded-md border border-gray-300 px-2 py-1"
                      />
                      <button type="submit" disabled={saving} className="text-primary-600">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-gray-500"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    item.name
                  )}
                </td>
                {canManage && (
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingName(item.name);
                      }}
                      className="mr-3 text-primary-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
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
