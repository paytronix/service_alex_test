import {
  addDays,
  ReportGranularity,
  startOfWeek,
  toDateOnly,
} from "@shiftflow/shared";
import type { ReportFiltersState, ReportOptions } from "./types";

interface ReportFiltersBarProps extends ReportOptions {
  value: ReportFiltersState;
  onChange: (value: ReportFiltersState) => void;
  showGranularity: boolean;
  showEmployee: boolean;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = toDateOnly(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const to = toDateOnly(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
  return { from, to };
}

export function ReportFiltersBar({
  value,
  onChange,
  showGranularity,
  showEmployee,
  employees,
  departments,
  roles,
}: ReportFiltersBarProps) {
  const updatePreset = (periodMode: ReportFiltersState["periodMode"]) => {
    if (periodMode === "custom") {
      onChange({ ...value, periodMode });
      return;
    }
    if (periodMode === "month") {
      onChange({ ...value, periodMode, ...currentMonthRange() });
      return;
    }
    const from = toDateOnly(startOfWeek(new Date()));
    onChange({ ...value, periodMode, from, to: toDateOnly(addDays(from, 6)) });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
      <label className="text-sm text-gray-700">
        Period
        <select
          value={value.periodMode}
          onChange={(event) =>
            updatePreset(event.target.value as ReportFiltersState["periodMode"])
          }
          className="mt-1 block rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="custom">Custom range</option>
        </select>
      </label>
      <label className="text-sm text-gray-700">
        From
        <input
          type="date"
          value={value.from}
          onChange={(event) => onChange({ ...value, periodMode: "custom", from: event.target.value })}
          className="mt-1 block rounded-md border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="text-sm text-gray-700">
        To
        <input
          type="date"
          value={value.to}
          onChange={(event) => onChange({ ...value, periodMode: "custom", to: event.target.value })}
          className="mt-1 block rounded-md border border-gray-300 px-3 py-2"
        />
      </label>
      {showGranularity && (
        <label className="text-sm text-gray-700">
          Granularity
          <select
            value={value.granularity}
            onChange={(event) =>
              onChange({
                ...value,
                granularity: event.target.value as ReportGranularity,
              })
            }
            className="mt-1 block rounded-md border border-gray-300 px-3 py-2"
          >
            <option value={ReportGranularity.DAY}>Day</option>
            <option value={ReportGranularity.WEEK}>Week</option>
            <option value={ReportGranularity.MONTH}>Month</option>
            <option value={ReportGranularity.TOTAL}>Total</option>
          </select>
        </label>
      )}
      {showEmployee && (
        <label className="text-sm text-gray-700">
          Employee
          <select
            value={value.employeeId}
            onChange={(event) => onChange({ ...value, employeeId: event.target.value })}
            className="mt-1 block min-w-40 rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">All employees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm text-gray-700">
        Department
        <select
          value={value.departmentId}
          onChange={(event) => onChange({ ...value, departmentId: event.target.value })}
          className="mt-1 block rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-gray-700">
        Role
        <select
          value={value.roleId}
          onChange={(event) => onChange({ ...value, roleId: event.target.value })}
          className="mt-1 block rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={value.includeDrafts}
          onChange={(event) => onChange({ ...value, includeDrafts: event.target.checked })}
        />
        Include drafts
      </label>
    </div>
  );
}
