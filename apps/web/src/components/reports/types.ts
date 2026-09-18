import type {
  EmployeeWorkloadReportDto,
  ReportGranularity,
  ScheduleFillRateReportDto,
  WorkHoursReportDto,
} from "@shiftflow/shared";

export type ReportPeriodMode = "week" | "month" | "custom";

export interface ReportFiltersState {
  periodMode: ReportPeriodMode;
  from: string;
  to: string;
  granularity: ReportGranularity;
  employeeId: string;
  departmentId: string;
  roleId: string;
  includeDrafts: boolean;
}

export interface ReportOptions {
  employees: { id: string; fullName: string }[];
  departments: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}

export type ReportData =
  | WorkHoursReportDto
  | EmployeeWorkloadReportDto
  | ScheduleFillRateReportDto;
