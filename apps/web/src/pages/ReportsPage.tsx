import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import {
  DEPARTMENTS_QUERY,
  EMPLOYEE_WORKLOAD_REPORT_QUERY,
  EMPLOYEES_QUERY,
  MY_ORGANIZATIONS_QUERY,
  ROLES_QUERY,
  SCHEDULE_FILL_RATE_REPORT_QUERY,
  WORK_HOURS_REPORT_QUERY,
} from "../lib/graphql";
import {
  ReportGranularity,
  ReportType,
  type EmployeeWorkloadReportDto,
  type ScheduleFillRateReportDto,
  type WorkHoursReportDto,
} from "@shiftflow/shared";
import { ExportButtons } from "../components/reports/ExportButtons";
import { FillRateReportView } from "../components/reports/FillRateReportView";
import { ReportFiltersBar } from "../components/reports/ReportFiltersBar";
import { WorkHoursReportView } from "../components/reports/WorkHoursReportView";
import { WorkloadReportView } from "../components/reports/WorkloadReportView";
import { canViewOwnWorkHours, canViewReports } from "../components/reports/permissions";
import type { ReportFiltersState } from "../components/reports/types";

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface ReportsData {
  myOrganizations: Organization[];
}

function initialFilters(): ReportFiltersState {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  const toDate = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate() + 6));
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return {
    periodMode: "week",
    from: format(fromDate),
    to: format(toDate),
    granularity: ReportGranularity.WEEK,
    employeeId: "",
    departmentId: "",
    roleId: "",
    includeDrafts: false,
  };
}

type ReportTab = "work-hours" | "workload" | "fill-rate";

export function ReportsPage() {
  const organizations = useQuery<ReportsData>(MY_ORGANIZATIONS_QUERY);
  const organization = organizations.data?.myOrganizations[0];
  const organizationId = organization?.id;
  const role = organization?.role;
  const [tab, setTab] = useState<ReportTab>("work-hours");
  const [filters, setFilters] = useState<ReportFiltersState>(initialFilters);
  const canReadReports = canViewReports(role);
  const canReadOwnHours = canViewOwnWorkHours(role);
  const allowed = canReadReports || (role === "EMPLOYEE" && canReadOwnHours);

  const { data: employeeData } = useQuery(EMPLOYEES_QUERY, {
    variables: { organizationId },
    skip: !organizationId,
  });
  const { data: departmentData } = useQuery(DEPARTMENTS_QUERY, {
    variables: { organizationId },
    skip: !organizationId,
  });
  const { data: roleData } = useQuery(ROLES_QUERY, {
    variables: { organizationId },
    skip: !organizationId,
  });

  const options = useMemo(
    () => ({
      employees: (employeeData?.employees ?? []).map((employee: { id: string; fullName: string }) => ({
        id: employee.id,
        fullName: employee.fullName,
      })),
      departments: (departmentData?.departments ?? []) as { id: string; name: string }[],
      roles: (roleData?.roles ?? []) as { id: string; name: string }[],
    }),
    [departmentData, employeeData, roleData],
  );

  const workVariables = {
    organizationId,
    from: filters.from,
    to: filters.to,
    granularity: filters.granularity,
    ...(role === "EMPLOYEE" || !filters.employeeId ? {} : { employeeId: filters.employeeId }),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.roleId ? { roleId: filters.roleId } : {}),
    includeDrafts: filters.includeDrafts,
  };
  const commonVariables = {
    organizationId,
    from: filters.from,
    to: filters.to,
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.roleId ? { roleId: filters.roleId } : {}),
    includeDrafts: filters.includeDrafts,
  };

  const workHours = useQuery<{ workHoursReport: WorkHoursReportDto }>(
    WORK_HOURS_REPORT_QUERY,
    { variables: workVariables, skip: !organizationId || !canReadOwnHours },
  );
  const workload = useQuery<{ employeeWorkloadReport: EmployeeWorkloadReportDto }>(
    EMPLOYEE_WORKLOAD_REPORT_QUERY,
    { variables: commonVariables, skip: !organizationId || !canReadReports || tab !== "workload" },
  );
  const fillRate = useQuery<{ scheduleFillRateReport: ScheduleFillRateReportDto }>(
    SCHEDULE_FILL_RATE_REPORT_QUERY,
    { variables: commonVariables, skip: !organizationId || !canReadReports || tab !== "fill-rate" },
  );

  const changeTab = (next: ReportTab) => {
    if (role === "EMPLOYEE" && next !== "work-hours") return;
    setTab(next);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-700">Reports</h1>
          <Link to="/dashboard" className="text-sm text-primary-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {organizations.loading ? (
          <p className="text-gray-500">Loading organizations...</p>
        ) : !allowed ? (
          <p className="rounded-lg bg-white p-6 text-sm text-gray-600 shadow">
            You do not have access to reports.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-gray-200">
              {[
                ["work-hours", "Work hours"],
                ...(canReadReports
                  ? ([
                      ["workload", "Workload"],
                      ["fill-rate", "Fill rate"],
                    ] as const)
                  : []),
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeTab(value as ReportTab)}
                  className={`border-b-2 px-4 py-2 text-sm font-medium ${
                    tab === value
                      ? "border-primary-600 text-primary-700"
                      : "border-transparent text-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ReportFiltersBar
              value={filters}
              onChange={setFilters}
              showGranularity={tab === "work-hours"}
              showEmployee={role !== "EMPLOYEE"}
              {...options}
            />
            <div className="flex justify-end">
              <ExportButtons
                role={role}
                organizationId={organizationId ?? ""}
                type={
                  tab === "work-hours"
                    ? ReportType.WORK_HOURS
                    : tab === "workload"
                      ? ReportType.EMPLOYEE_WORKLOAD
                      : ReportType.SCHEDULE_FILL_RATE
                }
                filters={filters}
              />
            </div>
            {tab === "work-hours" && (
              <WorkHoursReportView
                report={workHours.data?.workHoursReport}
                loading={workHours.loading}
                error={workHours.error?.message}
              />
            )}
            {tab === "workload" && (
              <WorkloadReportView
                report={workload.data?.employeeWorkloadReport}
                loading={workload.loading}
                error={workload.error?.message}
              />
            )}
            {tab === "fill-rate" && (
              <FillRateReportView
                report={fillRate.data?.scheduleFillRateReport}
                loading={fillRate.loading}
                error={fillRate.error?.message}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
