import type { WorkHoursReportDto } from "@shiftflow/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WorkHoursReportViewProps {
  report?: WorkHoursReportDto | null;
  loading: boolean;
  error?: string | null;
}

export function WorkHoursReportView({ report, loading, error }: WorkHoursReportViewProps) {
  if (loading) return <p className="text-gray-500">Loading work-hours report...</p>;
  if (error) return <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!report) return null;

  const chartData = Object.values(
    report.rows.reduce<Record<string, { period: string; hours: number }>>((result, row) => {
      result[row.period] ??= { period: row.period, hours: 0 };
      result[row.period].hours += row.totalHours;
      return result;
    }, {}),
  );

  return (
    <div className="space-y-6">
      <div className="h-64 rounded-lg bg-white p-4 shadow">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="hours" fill="#2563eb" name="Hours" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Department</th>
              <th className="p-3">Role</th>
              <th className="p-3">Period</th>
              <th className="p-3">Shifts</th>
              <th className="p-3">Hours</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={`${row.employeeId}-${row.period}`} className="border-b last:border-0">
                <td className="p-3">{row.employeeName}</td>
                <td className="p-3">{row.departmentName ?? "—"}</td>
                <td className="p-3">{row.roleName ?? "—"}</td>
                <td className="p-3">{row.period}</td>
                <td className="p-3">{row.shiftCount}</td>
                <td className="p-3">{row.totalHours.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t font-semibold">
            <tr>
              <td className="p-3" colSpan={4}>Totals</td>
              <td className="p-3">{report.totalShifts}</td>
              <td className="p-3">{report.totalHours.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
