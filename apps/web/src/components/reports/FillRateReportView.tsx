import type { FillRateBucketDto, ScheduleFillRateReportDto } from "@shiftflow/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface FillRateReportViewProps {
  report?: ScheduleFillRateReportDto | null;
  loading: boolean;
  error?: string | null;
}

function BreakdownTable({ title, buckets }: { title: string; buckets: FillRateBucketDto[] }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-3">
        {buckets.length === 0 && <p className="text-sm text-gray-500">No data.</p>}
        {buckets.map((bucket) => (
          <div key={bucket.key}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{bucket.label}</span>
              <span>{bucket.fillRatePercent.toFixed(2)}%</span>
            </div>
            <div className="h-2 rounded bg-gray-100">
              <div
                className="h-2 rounded bg-primary-600"
                style={{ width: `${Math.min(100, bucket.fillRatePercent)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {bucket.filledCount} filled / {bucket.requiredCount} required ({bucket.assignedCount} assigned)
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FillRateReportView({ report, loading, error }: FillRateReportViewProps) {
  if (loading) return <p className="text-gray-500">Loading fill-rate report...</p>;
  if (error) return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Fill rate", `${report.fillRatePercent.toFixed(2)}%`],
          ["Required", report.requiredCount],
          ["Assigned", report.assignedCount],
          ["Open", report.openCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white p-5 shadow">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="h-64 rounded-lg bg-white p-4 shadow">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={report.byDate}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="fillRatePercent" fill="#7c3aed" name="Fill rate %" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownTable title="By shift" buckets={report.byShift} />
        <BreakdownTable title="By role" buckets={report.byRole} />
      </div>
    </div>
  );
}
