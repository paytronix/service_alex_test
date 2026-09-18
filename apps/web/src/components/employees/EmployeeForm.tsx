import { FormEvent, useState } from "react";
import { EmployeeStatus } from "@shiftflow/shared";

export interface EmployeeFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photoUrl: string;
  roleId: string;
  departmentId: string;
  hireDate: string;
  status: string;
  maxHoursPerWeek: string;
  maxConsecutiveShifts: string;
  minRestHours: string;
}

export const emptyEmployeeForm: EmployeeFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  photoUrl: "",
  roleId: "",
  departmentId: "",
  hireDate: "",
  status: EmployeeStatus.WORKING,
  maxHoursPerWeek: "",
  maxConsecutiveShifts: "",
  minRestHours: "",
};

interface EmployeeFormProps {
  title: string;
  initialValues?: EmployeeFormValues;
  roles: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  onSubmit: (values: EmployeeFormValues) => Promise<void>;
  onCancel: () => void;
}

export function EmployeeForm({
  title,
  initialValues = emptyEmployeeForm,
  roles,
  departments,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const [values, setValues] = useState<EmployeeFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<EmployeeFormValues>) => setValues({ ...values, ...patch });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>

      <fieldset className="mb-4 grid gap-3 md:grid-cols-2">
        <legend className="mb-2 text-sm font-medium text-gray-700">Basics</legend>
        <label className="text-sm text-gray-600">
          First name
          <input
            aria-label="First name"
            required
            value={values.firstName}
            onChange={(e) => set({ firstName: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="text-sm text-gray-600">
          Last name
          <input
            aria-label="Last name"
            required
            value={values.lastName}
            onChange={(e) => set({ lastName: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="text-sm text-gray-600">
          Email
          <input
            aria-label="Email"
            type="email"
            required
            value={values.email}
            onChange={(e) => set({ email: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="text-sm text-gray-600">
          Phone
          <input
            aria-label="Phone"
            value={values.phone}
            onChange={(e) => set({ phone: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="text-sm text-gray-600 md:col-span-2">
          Photo URL
          <input
            aria-label="Photo URL"
            value={values.photoUrl}
            onChange={(e) => set({ photoUrl: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
      </fieldset>

      <fieldset className="mb-4 grid gap-3 md:grid-cols-2">
        <legend className="mb-2 text-sm font-medium text-gray-700">Work</legend>
        <label className="text-sm text-gray-600">
          Role
          <select
            aria-label="Role"
            value={values.roleId}
            onChange={(e) => set({ roleId: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">No role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Department
          <select
            aria-label="Department"
            value={values.departmentId}
            onChange={(e) => set({ departmentId: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">No department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Hire date
          <input
            aria-label="Hire date"
            type="date"
            value={values.hireDate}
            onChange={(e) => set({ hireDate: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="text-sm text-gray-600">
          Status
          <select
            aria-label="Status"
            value={values.status}
            onChange={(e) => set({ status: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          >
            {Object.values(EmployeeStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="mb-4 grid gap-3 md:grid-cols-3">
        <legend className="mb-2 text-sm font-medium text-gray-700">Limits</legend>
        <label className="text-sm text-gray-600">
          Max hours per week
          <input
            aria-label="Max hours per week"
            type="number"
            min={1}
            value={values.maxHoursPerWeek}
            onChange={(e) => set({ maxHoursPerWeek: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="text-sm text-gray-600">
          Max consecutive shifts
          <input
            aria-label="Max consecutive shifts"
            type="number"
            min={1}
            value={values.maxConsecutiveShifts}
            onChange={(e) => set({ maxConsecutiveShifts: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="text-sm text-gray-600">
          Min rest hours
          <input
            aria-label="Min rest hours"
            type="number"
            min={1}
            value={values.minRestHours}
            onChange={(e) => set({ minRestHours: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
      </fieldset>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save employee"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-500">
          Cancel
        </button>
      </div>
    </form>
  );
}
