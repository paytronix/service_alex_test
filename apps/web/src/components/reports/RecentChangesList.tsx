import type { DashboardRecentChangeDto } from "@shiftflow/shared";

interface RecentChangesListProps {
  changes: DashboardRecentChangeDto[];
  loading?: boolean;
  error?: string | null;
}

function formatChangedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.floor(elapsed / 60000);
  if (minutes >= 0 && minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (minutes >= 60 && hours < 24) return `${hours}h ago`;
  return date.toLocaleString();
}

export function RecentChangesList({
  changes,
  loading = false,
  error,
}: RecentChangesListProps) {
  if (loading) return <p className="text-sm text-gray-500">Loading recent changes...</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (changes.length === 0) {
    return <p className="text-sm text-gray-500">No recent schedule changes.</p>;
  }

  return (
    <div className="space-y-3">
      {changes.map((change) => (
        <div key={change.id} className="rounded-md border border-gray-100 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
              {change.changeType}
            </span>
            <span className="text-gray-500">{change.date}</span>
            <span className="text-gray-400" title={new Date(change.changedAt).toLocaleString()}>
              {formatChangedAt(change.changedAt)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-800">
            {change.previousEmployeeName ?? "Unassigned"}{" "}
            <span className="text-gray-400">→</span>{" "}
            {change.newEmployeeName ?? "Unassigned"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {change.changedByName ? `Changed by ${change.changedByName}` : "Changed by system"}
          </p>
        </div>
      ))}
    </div>
  );
}
