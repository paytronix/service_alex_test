import { useState } from "react";
import { AvailabilityEditor, AvailabilityEntry } from "./AvailabilityEditor";

export interface EmployeeDetail {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  status: string;
  hireDate: string | null;
  maxHoursPerWeek: number | null;
  maxConsecutiveShifts: number | null;
  minRestHours: number | null;
  role: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  skills: { id: string; skillId: string; level: number; skill: { id: string; name: string } | null }[];
  availability: AvailabilityEntry[];
}

interface EmployeeCardProps {
  employee: EmployeeDetail;
  skills: { id: string; name: string }[];
  canManage: boolean;
  canEditAvailability: boolean;
  onEdit: () => void;
  onDismiss: () => Promise<void>;
  onDelete: () => Promise<void>;
  onSaveSkills: (skillIds: string[]) => Promise<void>;
  onSaveAvailability: (entries: AvailabilityEntry[]) => Promise<void>;
  children?: React.ReactNode;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

export function EmployeeCard({
  employee,
  skills,
  canManage,
  canEditAvailability,
  onEdit,
  onDismiss,
  onDelete,
  onSaveSkills,
  onSaveAvailability,
  children,
}: EmployeeCardProps) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    employee.skills.map((item) => item.skillId),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update employee");
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = (skillId: string) =>
    setSelectedSkills((current) =>
      current.includes(skillId)
        ? current.filter((id) => id !== skillId)
        : [...current, skillId],
    );

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-4">
            {employee.photoUrl && (
              <img
                src={employee.photoUrl}
                alt={employee.fullName}
                className="h-14 w-14 rounded-full object-cover"
              />
            )}
            <div>
              <h2 className="text-lg font-semibold">{employee.fullName}</h2>
              <p className="text-sm text-gray-500">{employee.email}</p>
            </div>
          </div>
          {canManage && (
            <div className="flex gap-3 text-sm">
              <button type="button" onClick={onEdit} className="text-primary-600 hover:underline">
                Edit
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => run(onDismiss)}
                className="text-amber-600 hover:underline"
              >
                Dismiss
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => run(onDelete)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">Basics</h3>
            <dl className="space-y-1 text-sm text-gray-600">
              <div>
                <dt className="inline text-gray-500">Phone: </dt>
                <dd className="inline">{employee.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline text-gray-500">Status: </dt>
                <dd className="inline">{employee.status}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">Work</h3>
            <dl className="space-y-1 text-sm text-gray-600">
              <div>
                <dt className="inline text-gray-500">Role: </dt>
                <dd className="inline">{employee.role?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline text-gray-500">Department: </dt>
                <dd className="inline">{employee.department?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline text-gray-500">Hired: </dt>
                <dd className="inline">{formatDate(employee.hireDate)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">Limits</h3>
            <dl className="space-y-1 text-sm text-gray-600">
              <div>
                <dt className="inline text-gray-500">Max hours / week: </dt>
                <dd className="inline">{employee.maxHoursPerWeek ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline text-gray-500">Max consecutive shifts: </dt>
                <dd className="inline">{employee.maxConsecutiveShifts ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline text-gray-500">Min rest hours: </dt>
                <dd className="inline">{employee.minRestHours ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-base font-semibold">Skills</h3>
        {skills.length === 0 ? (
          <p className="text-sm text-gray-500">No skills in the catalog yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {skills.map((skill) => (
              <label key={skill.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  aria-label={skill.name}
                  disabled={!canManage}
                  checked={selectedSkills.includes(skill.id)}
                  onChange={() => toggleSkill(skill.id)}
                />
                {skill.name}
              </label>
            ))}
          </div>
        )}
        {canManage && skills.length > 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => run(() => onSaveSkills(selectedSkills))}
            className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Save skills
          </button>
        )}
      </section>

      <AvailabilityEditor
        entries={employee.availability}
        canEdit={canEditAvailability}
        onSave={onSaveAvailability}
      />

      {children}
    </div>
  );
}
