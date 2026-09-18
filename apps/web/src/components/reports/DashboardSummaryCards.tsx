import type { DashboardSummaryDto } from "@shiftflow/shared";

interface DashboardSummaryCardsProps {
  summary?: DashboardSummaryDto | null;
  loading: boolean;
  error?: string | null;
}

export function DashboardSummaryCards({
  summary,
  loading,
  error,
}: DashboardSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Loading dashboard summary">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  }

  if (!summary) return null;

  const cards = [
    ["Working today", summary.workingToday],
    ["Absent today", summary.absentToday],
    ["Open requests", summary.openRequests],
    ["Open shifts", summary.openShifts],
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
        </div>
      ))}
      <div className="rounded-lg bg-white p-5 shadow">
        <p className="text-sm text-gray-500">Weekly fill rate</p>
        <p className="mt-2 text-3xl font-semibold text-primary-700">
          {summary.fillRatePercentThisWeek.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}
