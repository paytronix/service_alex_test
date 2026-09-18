import { useState } from "react";
import { TimeEntrySource } from "@shiftflow/shared";

export interface OpenTimeEntry {
  id: string;
  clockInAt: string;
  source: string;
  note: string | null;
  minutesWorked: number;
}

interface ClockPanelProps {
  entry: OpenTimeEntry | null;
  loading: boolean;
  onClockIn: (source: TimeEntrySource) => Promise<void> | void;
  onClockOut: (note: string) => Promise<void> | void;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Employee-facing clock in/out card; the QR flow reuses the same mutation with source=QR. */
export function ClockPanel({ entry, loading, onClockIn, onClockOut }: ClockPanelProps) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await action();
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-base font-semibold">My shift</h2>
      {loading ? (
        <p className="text-sm text-gray-500">Loading current status...</p>
      ) : entry ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Clocked in at {new Date(entry.clockInAt).toLocaleString()} ·{" "}
            {formatMinutes(entry.minutesWorked)} so far
          </p>
          <label className="block text-sm text-gray-600">
            Note (optional)
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Anything the manager should know"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => onClockOut(note))}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Clock out
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => onClockIn(TimeEntrySource.WEB))}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Clock in
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => onClockIn(TimeEntrySource.QR))}
            className="rounded-md border border-primary-600 px-4 py-2 text-sm text-primary-700 hover:bg-primary-50 disabled:opacity-50"
          >
            Clock in with QR terminal
          </button>
        </div>
      )}
    </section>
  );
}
