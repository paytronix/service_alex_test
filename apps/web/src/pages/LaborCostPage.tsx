import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExportFormat, LaborCostGroupBy } from "@shiftflow/shared";
import {
  LABOR_COST_REPORT_QUERY,
  LOCK_PAY_PERIOD_MUTATION,
  MY_ORGANIZATIONS_QUERY,
  OPEN_PAY_PERIOD_MUTATION,
  PAYROLL_EXPORT_MUTATION,
  PAY_PERIODS_QUERY,
} from "../lib/graphql";
import { canManagePayroll, canViewLaborCost } from "../components/operations/permissions";
import { downloadBase64 } from "../lib/employeeDocuments";

interface LaborCostRow {
  key: string;
  label: string;
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
  hourlyRate: number;
  plannedCost: number;
  actualCost: number;
}

interface LaborCostReport {
  from: string;
  to: string;
  groupBy: LaborCostGroupBy;
  currency: string;
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
  plannedCost: number;
  actualCost: number;
  rows: LaborCostRow[];
}

interface PayPeriod {
  id: string;
  from: string;
  to: string;
  status: string;
  lockedAt: string | null;
}

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function LaborCostPage() {
  const organizations = useQuery(MY_ORGANIZATIONS_QUERY);
  const organization = organizations.data?.myOrganizations?.[0];
  const organizationId: string | undefined = organization?.id;
  const role: string | undefined = organization?.role;
  const canView = canViewLaborCost(role);
  const canPayroll = canManagePayroll(role);

  const [range, setRange] = useState(monthRange);
  const [groupBy, setGroupBy] = useState<LaborCostGroupBy>(LaborCostGroupBy.EMPLOYEE);
  const [error, setError] = useState<string | null>(null);
  const [newPeriod, setNewPeriod] = useState(monthRange);

  const report = useQuery<{ laborCostReport: LaborCostReport }>(LABOR_COST_REPORT_QUERY, {
    variables: { organizationId, from: range.from, to: range.to, groupBy },
    skip: !organizationId,
  });
  const payPeriods = useQuery<{ payPeriods: PayPeriod[] }>(PAY_PERIODS_QUERY, {
    variables: { organizationId },
    skip: !organizationId || !canView,
  });

  const payPeriodRefetch = [{ query: PAY_PERIODS_QUERY, variables: { organizationId } }];
  const [exportPayroll] = useMutation(PAYROLL_EXPORT_MUTATION);
  const [openPayPeriod] = useMutation(OPEN_PAY_PERIOD_MUTATION, {
    refetchQueries: payPeriodRefetch,
  });
  const [lockPayPeriod] = useMutation(LOCK_PAY_PERIOD_MUTATION, {
    refetchQueries: payPeriodRefetch,
  });

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  };

  const download = (format: ExportFormat, payPeriodId?: string) =>
    run(async () => {
      const result = await exportPayroll({
        variables: {
          organizationId,
          format,
          ...(payPeriodId ? { payPeriodId } : { from: range.from, to: range.to }),
        },
      });
      const payload = result.data?.payrollExport;
      if (payload) downloadBase64(payload.filename, payload.mimeType, payload.content);
    });

  const data = report.data?.laborCostReport;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">Labor cost & payroll</h1>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {organizations.loading ? (
          <p className="text-gray-500">Loading organizations...</p>
        ) : !canView ? (
          <p className="rounded-lg bg-white p-6 text-sm text-gray-600 shadow">
            You do not have access to labor cost reports.
          </p>
        ) : (
          <>
            {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <section className="flex flex-wrap items-end gap-4 rounded-lg bg-white p-4 shadow">
              <label className="text-sm text-gray-600">
                From
                <input
                  type="date"
                  value={range.from}
                  onChange={(event) =>
                    setRange((current) => ({ ...current, from: event.target.value }))
                  }
                  className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-600">
                To
                <input
                  type="date"
                  value={range.to}
                  onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
                  className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-600">
                Group by
                <select
                  value={groupBy}
                  onChange={(event) => setGroupBy(event.target.value as LaborCostGroupBy)}
                  className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value={LaborCostGroupBy.EMPLOYEE}>Employee</option>
                  <option value={LaborCostGroupBy.DEPARTMENT}>Department</option>
                  <option value={LaborCostGroupBy.LOCATION}>Location</option>
                </select>
              </label>
              {canPayroll && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => download(ExportFormat.CSV)}
                    className="rounded-md border border-primary-600 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50"
                  >
                    Payroll CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => download(ExportFormat.EXCEL)}
                    className="rounded-md border border-primary-600 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50"
                  >
                    Payroll Excel
                  </button>
                </div>
              )}
            </section>

            {report.loading ? (
              <p className="text-gray-500">Loading labor cost report...</p>
            ) : report.error ? (
              <p className="rounded bg-red-50 p-3 text-sm text-red-700">{report.error.message}</p>
            ) : data ? (
              <>
                <div className="grid gap-4 sm:grid-cols-4">
                  {[
                    ["Planned hours", data.plannedHours.toFixed(2)],
                    ["Actual hours", data.actualHours.toFixed(2)],
                    ["Planned cost", `${data.plannedCost.toFixed(2)} ${data.currency}`],
                    ["Actual cost", `${data.actualCost.toFixed(2)} ${data.currency}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-white p-4 shadow">
                      <p className="text-xs uppercase text-gray-500">{label}</p>
                      <p className="text-xl font-semibold text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="h-72 rounded-lg bg-white p-4 shadow">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.rows}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="plannedCost" fill="#93c5fd" name="Planned cost" />
                      <Bar dataKey="actualCost" fill="#2563eb" name="Actual cost" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto rounded-lg bg-white shadow">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-gray-500">
                      <tr>
                        <th className="p-3">Group</th>
                        <th className="p-3">Rate</th>
                        <th className="p-3">Planned h</th>
                        <th className="p-3">Actual h</th>
                        <th className="p-3">Overtime h</th>
                        <th className="p-3">Planned cost</th>
                        <th className="p-3">Actual cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={row.key} className="border-b last:border-0">
                          <td className="p-3">{row.label}</td>
                          <td className="p-3">{row.hourlyRate.toFixed(2)}</td>
                          <td className="p-3">{row.plannedHours.toFixed(2)}</td>
                          <td className="p-3">{row.actualHours.toFixed(2)}</td>
                          <td className="p-3">{row.overtimeHours.toFixed(2)}</td>
                          <td className="p-3">{row.plannedCost.toFixed(2)}</td>
                          <td className="p-3">{row.actualCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            <section className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-base font-semibold">Pay periods</h2>
              {canPayroll && (
                <div className="mb-4 flex flex-wrap items-end gap-3">
                  <label className="text-sm text-gray-600">
                    From
                    <input
                      type="date"
                      value={newPeriod.from}
                      onChange={(event) =>
                        setNewPeriod((current) => ({ ...current, from: event.target.value }))
                      }
                      className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm text-gray-600">
                    To
                    <input
                      type="date"
                      value={newPeriod.to}
                      onChange={(event) =>
                        setNewPeriod((current) => ({ ...current, to: event.target.value }))
                      }
                      className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      run(() =>
                        openPayPeriod({
                          variables: { organizationId, from: newPeriod.from, to: newPeriod.to },
                        }),
                      )
                    }
                    className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
                  >
                    Open pay period
                  </button>
                </div>
              )}
              <table className="w-full text-left text-sm">
                <thead className="border-b text-gray-500">
                  <tr>
                    <th className="p-3">Period</th>
                    <th className="p-3">Status</th>
                    {canPayroll && <th className="p-3">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(payPeriods.data?.payPeriods ?? []).length === 0 && (
                    <tr>
                      <td className="p-3 text-gray-500" colSpan={canPayroll ? 3 : 2}>
                        No pay periods yet.
                      </td>
                    </tr>
                  )}
                  {(payPeriods.data?.payPeriods ?? []).map((period) => (
                    <tr key={period.id} className="border-b last:border-0">
                      <td className="p-3">
                        {period.from.slice(0, 10)} – {period.to.slice(0, 10)}
                      </td>
                      <td className="p-3">{period.status}</td>
                      {canPayroll && (
                        <td className="flex gap-3 p-3 text-xs">
                          {period.status === "OPEN" && (
                            <button
                              type="button"
                              className="text-amber-700 hover:underline"
                              onClick={() =>
                                run(() => lockPayPeriod({ variables: { organizationId, id: period.id } }))
                              }
                            >
                              Lock
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-primary-600 hover:underline"
                            onClick={() => download(ExportFormat.CSV, period.id)}
                          >
                            Export CSV
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
