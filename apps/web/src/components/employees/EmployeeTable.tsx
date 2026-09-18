import { EmployeeStatus } from "@shiftflow/shared";

export interface EmployeeListItem {
  id: string;
  fullName: string;
  email: string;
  photoUrl: string | null;
  status: string;
  role: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
}

export interface EmployeeFilters {
  search: string;
  departmentId: string;
  roleId: string;
  status: string;
}

interface EmployeeTableProps {
  items: EmployeeListItem[];
  departments: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  filters: EmployeeFilters;
  loading: boolean;
  canManage: boolean;
  selectedId: string | null;
  onFiltersChange: (filters: EmployeeFilters) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  [EmployeeStatus.WORKING]: "Working",
  [EmployeeStatus.VACATION]: "Vacation",
  [EmployeeStatus.SICK]: "Sick",
  [EmployeeStatus.DISMISSED]: "Dismissed",
};

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function EmployeeTable({
  items,
  departments,
  roles,
  filters,
  loading,
  canManage,
  selectedId,
  onFiltersChange,
  onSelect,
  onCreate,
}: EmployeeTableProps) {
  const update = (patch: Partial<EmployeeFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Employees</h2>
        {canManage && (
          <button
            type="button"
            onClick={onCreate}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
          >
            New employee
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          aria-label="Search employees"
          placeholder="Search by name or email"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2"
        />
        <select
          aria-label="Filter by department"
          value={filters.departmentId}
          onChange={(e) => update({ departmentId: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by role"
          value={filters.roleId}
          onChange={(e) => update({ roleId: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(e) => update({ status: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading employees...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No employees found.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="pb-2">Employee</th>
              <th className="pb-2">Role</th>
              <th className="pb-2">Department</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((employee) => (
              <tr
                key={employee.id}
                data-testid={`employee-row-${employee.id}`}
                onClick={() => onSelect(employee.id)}
                className={`cursor-pointer border-b last:border-0 hover:bg-gray-50 ${
                  selectedId === employee.id ? "bg-primary-50" : ""
                }`}
              >
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    {employee.photoUrl ? (
                      <img
                        src={employee.photoUrl}
                        alt={employee.fullName}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        data-testid={`employee-initials-${employee.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600"
                      >
                        {initials(employee.fullName)}
                      </span>
                    )}
                    <span>
                      <button
                        type="button"
                        onClick={() => onSelect(employee.id)}
                        className="font-medium text-primary-700 hover:underline"
                      >
                        {employee.fullName}
                      </button>
                      <span className="block text-xs text-gray-500">{employee.email}</span>
                    </span>
                  </div>
                </td>
                <td className="py-2">{employee.role?.name ?? "—"}</td>
                <td className="py-2">{employee.department?.name ?? "—"}</td>
                <td className="py-2">{STATUS_LABELS[employee.status] ?? employee.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
