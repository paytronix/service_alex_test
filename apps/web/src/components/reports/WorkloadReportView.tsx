import type { EmployeeWorkloadReportDto } from "@shiftflow/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WorkloadReportViewProps {
  report?: EmployeeWorkloadReportDto | null;
  loading: boolean;
  error?: string | null;
}

export function WorkloadReportView({ report, loading, error }: WorkloadReportViewProps) {
  if (loading) return <p className="text-gray-500">Loading workload report...</p>;
  if (error) return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="h-72 rounded-lg bg-white p-4 shadow">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={report.rows} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="employeeName" width={120} />
            <Tooltip />
            <Bar dataKey="totalHours" fill="#0f766e" name="Hours" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="p-3">Rank</th>
              <th className="p-3">Employee</th>
              <th className="p-3">Hours</th>
              <th className="p-3">Shifts</th>
              <th className="p-3">Avg weekly</th>
              <th className="p-3">Limit</th>
              <th className="p-3">Utilization</th>
              <th className="p-3">Overtime</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr
                key={row.employeeId}
                className={`border-b last:border-0 ${row.isOverloaded ? "bg-red-50 text-red-800" : ""}`}
              >
                <td className="p-3">{row.rank}</td>
                <td className="p-3 font-medium">
                  {row.employeeName}
                  {row.isOverloaded && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs">Overtime</span>
                  )}
                </td>
                <td className="p-3">{row.totalHours.toFixed(2)}</td>
                <td className="p-3">{row.shiftCount}</td>
                <td className="p-3">{row.avgWeeklyHours.toFixed(2)}</td>
                <td className="p-3">{row.weeklyLimitHours.toFixed(2)}</td>
                <td className="p-3">{row.utilizationPercent.toFixed(2)}%</td>
                <td className="p-3">{row.overtimeHours.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
