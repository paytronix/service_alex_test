import { ScheduleChangeType } from "./notifications";
import { startOfWeek, toDateOnly } from "./scheduling";

export enum ReportType {
  WORK_HOURS = "WORK_HOURS",
  EMPLOYEE_WORKLOAD = "EMPLOYEE_WORKLOAD",
  SCHEDULE_FILL_RATE = "SCHEDULE_FILL_RATE",
}

export enum ExportFormat {
  CSV = "CSV",
  EXCEL = "EXCEL",
  PDF = "PDF",
}

export enum ReportGranularity {
  DAY = "DAY",
  WEEK = "WEEK",
  MONTH = "MONTH",
  TOTAL = "TOTAL",
}

export interface ReportPeriodDto {
  from: string;
  to: string;
}

export interface WorkHoursRowDto {
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  roleName: string | null;
  period: string;
  shiftCount: number;
  totalHours: number;
}

export interface WorkHoursReportDto extends ReportPeriodDto {
  granularity: ReportGranularity;
  rows: WorkHoursRowDto[];
  totalHours: number;
  totalShifts: number;
}

export interface EmployeeWorkloadRowDto {
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  roleName: string | null;
  totalHours: number;
  shiftCount: number;
  weeksInPeriod: number;
  avgWeeklyHours: number;
  weeklyLimitHours: number;
  overtimeHours: number;
  utilizationPercent: number;
  isOverloaded: boolean;
  rank: number;
}

export interface EmployeeWorkloadReportDto extends ReportPeriodDto {
  rows: EmployeeWorkloadRowDto[];
  totalHours: number;
  averageHours: number;
}

export interface FillRateBucketDto {
  key: string;
  label: string;
  requiredCount: number;
  assignedCount: number;
  filledCount: number;
  fillRatePercent: number;
}

export interface ScheduleFillRateReportDto extends ReportPeriodDto {
  requiredCount: number;
  assignedCount: number;
  filledCount: number;
  openCount: number;
  fillRatePercent: number;
  byDate: FillRateBucketDto[];
  byShift: FillRateBucketDto[];
  byRole: FillRateBucketDto[];
}

export interface DashboardRecentChangeDto {
  id: string;
  changeType: ScheduleChangeType;
  date: string;
  scheduleId: string;
  previousEmployeeName: string | null;
  newEmployeeName: string | null;
  changedByName: string | null;
  changedAt: string;
}

export interface DashboardSummaryDto {
  date: string;
  workingToday: number;
  absentToday: number;
  openRequests: number;
  openShifts: number;
  fillRatePercentThisWeek: number;
  recentChanges: DashboardRecentChangeDto[];
}

export function periodKey(date: string | Date, granularity: ReportGranularity): string {
  if (granularity === ReportGranularity.TOTAL) return "total";
  const dateOnly = toDateOnly(date);
  if (granularity === ReportGranularity.DAY) return dateOnly;
  if (granularity === ReportGranularity.MONTH) return dateOnly.slice(0, 7);
  return toDateOnly(startOfWeek(dateOnly));
}

export function fillRatePercent(required: number, filled: number): number {
  if (required <= 0) return 0;
  return round2((filled / required) * 100);
}

export function roundHours(minutes: number): number {
  return round2(minutes / 60);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
