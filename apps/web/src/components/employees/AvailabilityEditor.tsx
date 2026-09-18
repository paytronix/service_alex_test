import { useState } from "react";
import { AvailabilityType, DAY_NAMES } from "@shiftflow/shared";

export interface AvailabilityEntry {
  dayOfWeek: number;
  type: string;
  availableFrom: string | null;
}

interface AvailabilityEditorProps {
  entries: AvailabilityEntry[];
  canEdit: boolean;
  onSave: (entries: AvailabilityEntry[]) => Promise<void>;
}

const TYPE_LABELS: Record<string, string> = {
  [AvailabilityType.UNAVAILABLE]: "Unavailable",
  [AvailabilityType.AVAILABLE]: "Available",
  [AvailabilityType.AVAILABLE_AFTER]: "Available after",
};

function buildWeek(entries: AvailabilityEntry[]): AvailabilityEntry[] {
  return DAY_NAMES.map((_name, dayOfWeek) => {
    const existing = entries.find((entry) => entry.dayOfWeek === dayOfWeek);
    return (
      existing ?? { dayOfWeek, type: AvailabilityType.AVAILABLE as string, availableFrom: null }
    );
  });
}

export function AvailabilityEditor({ entries, canEdit, onSave }: AvailabilityEditorProps) {
  const [week, setWeek] = useState<AvailabilityEntry[]>(() => buildWeek(entries));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (dayOfWeek: number, patch: Partial<AvailabilityEntry>) =>
    setWeek((current) =>
      current.map((entry) => (entry.dayOfWeek === dayOfWeek ? { ...entry, ...patch } : entry)),
    );

  const handleSave = async () => {
    const invalid = week.find(
      (entry) => entry.type === AvailabilityType.AVAILABLE_AFTER && !entry.availableFrom,
    );
    if (invalid) {
      setError(`Set a time for ${DAY_NAMES[invalid.dayOfWeek]}`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(week);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h3 className="mb-4 text-base font-semibold">Availability</h3>

      <div className="space-y-2">
        {week.map((entry) => (
          <div key={entry.dayOfWeek} className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-sm text-gray-700">{DAY_NAMES[entry.dayOfWeek]}</span>
            <select
              aria-label={`${DAY_NAMES[entry.dayOfWeek]} availability`}
              disabled={!canEdit}
              value={entry.type}
              onChange={(e) =>
                update(entry.dayOfWeek, {
                  type: e.target.value,
                  availableFrom:
                    e.target.value === AvailabilityType.AVAILABLE_AFTER
                      ? entry.availableFrom
                      : null,
                })
              }
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:bg-gray-100"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {entry.type === AvailabilityType.AVAILABLE_AFTER && (
              <input
                aria-label={`${DAY_NAMES[entry.dayOfWeek]} available from`}
                type="time"
                disabled={!canEdit}
                value={entry.availableFrom ?? ""}
                onChange={(e) =>
                  update(entry.dayOfWeek, { availableFrom: e.target.value || null })
                }
                className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:bg-gray-100"
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {canEdit && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save availability"}
        </button>
      )}
    </section>
  );
}
