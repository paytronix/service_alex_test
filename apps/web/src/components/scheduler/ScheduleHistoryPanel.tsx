import type {
  ScheduleChangeItem,
  ScheduleVersionItem,
} from "../notifications/types";

export interface ScheduleDiffEntry {
  assignmentId: string;
  changeType: string;
  date: string;
  previousEmployeeId: string | null;
  newEmployeeId: string | null;
}

interface ScheduleHistoryPanelProps {
  changes: ScheduleChangeItem[];
  versions: ScheduleVersionItem[];
  employeeNames: Record<string, string>;
  loading?: boolean;
  error?: string | null;
  diff?: ScheduleDiffEntry[] | null;
  onCompareVersions?: (versionA: number, versionB: number) => void;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function weekday(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : WEEKDAYS[parsed.getUTCDay()];
}

function time(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function describeChange(
  change: ScheduleChangeItem,
  employeeNames: Record<string, string>,
): string {
  const name = (id: string | null) =>
    id ? employeeNames[id] ?? id : "—";
  const actor = change.changedBy
    ? `${change.changedBy.firstName} ${change.changedBy.lastName}`.trim() ||
      change.changedBy.email
    : "System";

  const transition =
    change.changeType === "REPLACED"
      ? `${name(change.previousEmployeeId)} → ${name(change.newEmployeeId)}`
      : change.changeType === "REMOVED"
        ? `${name(change.previousEmployeeId)} removed`
        : change.changeType === "MOVED"
          ? `${name(change.newEmployeeId)} moved`
          : `${name(change.newEmployeeId)} assigned`;

  return `${weekday(change.date)}: ${transition}, changed by ${actor}, ${time(change.changedAt)}`;
}

export function ScheduleHistoryPanel({
  changes,
  versions,
  employeeNames,
  loading,
  error,
  diff,
  onCompareVersions,
}: ScheduleHistoryPanelProps) {
  return (
    <section className="rounded-lg bg-white p-4 shadow" aria-label="Schedule history">
      <h3 className="mb-3 text-lg font-semibold">Change history</h3>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading history...</p>
      ) : changes.length === 0 ? (
        <p className="text-sm text-gray-500">No changes recorded</p>
      ) : (
        <ul className="space-y-1 text-sm text-gray-700">
          {changes.map((change) => (
            <li key={change.id}>{describeChange(change, employeeNames)}</li>
          ))}
        </ul>
      )}

      <h4 className="mb-2 mt-5 font-semibold">Versions</h4>
      {versions.length === 0 ? (
        <p className="text-sm text-gray-500">Not published yet</p>
      ) : (
        <ul className="space-y-1 text-sm text-gray-700">
          {versions.map((version) => {
            const publisher = version.publishedBy
              ? `${version.publishedBy.firstName} ${version.publishedBy.lastName}`.trim() ||
                version.publishedBy.email
              : "System";
            return (
              <li key={version.id} className="flex items-center gap-2">
                <span className="font-medium">v{version.version}</span>
                <span className="text-gray-500">
                  {new Date(version.publishedAt).toLocaleString()} · {publisher}
                </span>
                {onCompareVersions && version.version > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onCompareVersions(version.version - 1, version.version)
                    }
                    className="text-xs text-primary-600 hover:underline"
                    aria-label={`Compare version ${version.version - 1} with ${version.version}`}
                  >
                    Compare with v{version.version - 1}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {diff && diff.length > 0 && (
        <>
          <h4 className="mb-2 mt-5 font-semibold">Diff</h4>
          <ul className="space-y-1 text-sm text-gray-700" aria-label="Version diff">
            {diff.map((entry) => (
              <li key={`${entry.assignmentId}-${entry.changeType}`}>
                {weekday(entry.date)}: {entry.changeType}{" "}
                {entry.previousEmployeeId
                  ? employeeNames[entry.previousEmployeeId] ?? entry.previousEmployeeId
                  : "—"}{" "}
                →{" "}
                {entry.newEmployeeId
                  ? employeeNames[entry.newEmployeeId] ?? entry.newEmployeeId
                  : "—"}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
