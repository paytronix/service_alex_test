import type { AuditLogItem } from "./types";

export interface AuditLogFilters {
  action: string;
  entity: string;
  actorId: string;
  from: string;
  to: string;
}

interface AuditLogTableProps {
  items: AuditLogItem[];
  loading?: boolean;
  error?: string | null;
  filters: AuditLogFilters;
  onFiltersChange: (filters: AuditLogFilters) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

function actorName(item: AuditLogItem): string {
  if (!item.user) return "System";
  return `${item.user.firstName} ${item.user.lastName}`.trim() || item.user.email;
}

export function AuditLogTable({
  items,
  loading,
  error,
  filters,
  onFiltersChange,
  page,
  pageSize,
  total,
  onPageChange,
}: AuditLogTableProps) {
  const update = (patch: Partial<AuditLogFilters>) =>
    onFiltersChange({ ...filters, ...patch });
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <label className="text-sm">
          <span className="block text-gray-600">Action</span>
          <input
            aria-label="Audit action filter"
            value={filters.action}
            onChange={(e) => update({ action: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">Entity</span>
          <input
            aria-label="Audit entity filter"
            value={filters.entity}
            onChange={(e) => update({ entity: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">Actor ID</span>
          <input
            aria-label="Audit actor filter"
            value={filters.actorId}
            onChange={(e) => update({ actorId: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">From</span>
          <input
            type="date"
            aria-label="Audit from date"
            value={filters.from}
            onChange={(e) => update({ from: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">To</span>
          <input
            type="date"
            aria-label="Audit to date"
            value={filters.to}
            onChange={(e) => update({ to: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading audit log...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No audit records</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2">When</th>
              <th className="pb-2">Actor</th>
              <th className="pb-2">Action</th>
              <th className="pb-2">Entity</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="py-2 text-gray-600">
                  {new Date(item.createdAt).toLocaleString()}
                </td>
                <td className="py-2">{actorName(item)}</td>
                <td className="py-2 font-medium">{item.action}</td>
                <td className="py-2 text-gray-600">
                  {item.entity}
                  {item.entityId ? ` · ${item.entityId}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 0}
          className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-gray-500">
          Page {page + 1} of {lastPage + 1}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= lastPage}
          className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
