import {
  ExportFormat,
  ReportGranularity,
  ReportType,
  type DashboardRecentChangeDto,
  type DashboardSummaryDto,
  type EmployeeWorkloadReportDto,
  type EmployeeWorkloadRowDto,
  type FillRateBucketDto,
  type ScheduleFillRateReportDto,
  type WorkHoursReportDto,
  type WorkHoursRowDto,
} from "@shiftflow/shared";
import { builder } from "../builder";
import { ScheduleChangeTypeEnum } from "./schedule-history";

export const ReportTypeEnum = builder.enumType(ReportType, { name: "ReportType" });
export const ExportFormatEnum = builder.enumType(ExportFormat, { name: "ExportFormat" });
export const ReportGranularityEnum = builder.enumType(ReportGranularity, {
  name: "ReportGranularity",
});

export const WorkHoursRowRef = builder.objectRef<WorkHoursRowDto>("WorkHoursRow");
builder.objectType(WorkHoursRowRef, {
  fields: (t) => ({
    employeeId: t.exposeString("employeeId"),
    employeeName: t.exposeString("employeeName"),
    departmentName: t.exposeString("departmentName", { nullable: true }),
    roleName: t.exposeString("roleName", { nullable: true }),
    period: t.exposeString("period"),
    shiftCount: t.exposeInt("shiftCount"),
    totalHours: t.exposeFloat("totalHours"),
  }),
});

export const WorkHoursReportRef = builder.objectRef<WorkHoursReportDto>("WorkHoursReport");
builder.objectType(WorkHoursReportRef, {
  fields: (t) => ({
    from: t.exposeString("from"),
    to: t.exposeString("to"),
    granularity: t.expose("granularity", { type: ReportGranularityEnum }),
    rows: t.field({ type: [WorkHoursRowRef], resolve: (report) => report.rows }),
    totalHours: t.exposeFloat("totalHours"),
    totalShifts: t.exposeInt("totalShifts"),
  }),
});

export const EmployeeWorkloadRowRef = builder.objectRef<EmployeeWorkloadRowDto>("EmployeeWorkloadRow");
builder.objectType(EmployeeWorkloadRowRef, {
  fields: (t) => ({
    employeeId: t.exposeString("employeeId"),
    employeeName: t.exposeString("employeeName"),
    departmentName: t.exposeString("departmentName", { nullable: true }),
    roleName: t.exposeString("roleName", { nullable: true }),
    totalHours: t.exposeFloat("totalHours"),
    shiftCount: t.exposeInt("shiftCount"),
    weeksInPeriod: t.exposeInt("weeksInPeriod"),
    avgWeeklyHours: t.exposeFloat("avgWeeklyHours"),
    weeklyLimitHours: t.exposeFloat("weeklyLimitHours"),
    overtimeHours: t.exposeFloat("overtimeHours"),
    utilizationPercent: t.exposeFloat("utilizationPercent"),
    isOverloaded: t.exposeBoolean("isOverloaded"),
    rank: t.exposeInt("rank"),
  }),
});

export const EmployeeWorkloadReportRef =
  builder.objectRef<EmployeeWorkloadReportDto>("EmployeeWorkloadReport");
builder.objectType(EmployeeWorkloadReportRef, {
  fields: (t) => ({
    from: t.exposeString("from"),
    to: t.exposeString("to"),
    rows: t.field({ type: [EmployeeWorkloadRowRef], resolve: (report) => report.rows }),
    totalHours: t.exposeFloat("totalHours"),
    averageHours: t.exposeFloat("averageHours"),
  }),
});

export const FillRateBucketRef = builder.objectRef<FillRateBucketDto>("FillRateBucket");
builder.objectType(FillRateBucketRef, {
  fields: (t) => ({
    key: t.exposeString("key"),
    label: t.exposeString("label"),
    requiredCount: t.exposeInt("requiredCount"),
    assignedCount: t.exposeInt("assignedCount"),
    filledCount: t.exposeInt("filledCount"),
    fillRatePercent: t.exposeFloat("fillRatePercent"),
  }),
});

export const ScheduleFillRateReportRef =
  builder.objectRef<ScheduleFillRateReportDto>("ScheduleFillRateReport");
builder.objectType(ScheduleFillRateReportRef, {
  fields: (t) => ({
    from: t.exposeString("from"),
    to: t.exposeString("to"),
    requiredCount: t.exposeInt("requiredCount"),
    assignedCount: t.exposeInt("assignedCount"),
    filledCount: t.exposeInt("filledCount"),
    openCount: t.exposeInt("openCount"),
    fillRatePercent: t.exposeFloat("fillRatePercent"),
    byDate: t.field({ type: [FillRateBucketRef], resolve: (report) => report.byDate }),
    byShift: t.field({ type: [FillRateBucketRef], resolve: (report) => report.byShift }),
    byRole: t.field({ type: [FillRateBucketRef], resolve: (report) => report.byRole }),
  }),
});

export const DashboardRecentChangeRef =
  builder.objectRef<DashboardRecentChangeDto>("DashboardRecentChange");
builder.objectType(DashboardRecentChangeRef, {
  fields: (t) => ({
    id: t.exposeString("id"),
    changeType: t.expose("changeType", { type: ScheduleChangeTypeEnum }),
    date: t.exposeString("date"),
    scheduleId: t.exposeString("scheduleId"),
    previousEmployeeName: t.exposeString("previousEmployeeName", { nullable: true }),
    newEmployeeName: t.exposeString("newEmployeeName", { nullable: true }),
    changedByName: t.exposeString("changedByName", { nullable: true }),
    changedAt: t.exposeString("changedAt"),
  }),
});

export const DashboardSummaryRef = builder.objectRef<DashboardSummaryDto>("DashboardSummary");
builder.objectType(DashboardSummaryRef, {
  fields: (t) => ({
    date: t.exposeString("date"),
    workingToday: t.exposeInt("workingToday"),
    absentToday: t.exposeInt("absentToday"),
    openRequests: t.exposeInt("openRequests"),
    openShifts: t.exposeInt("openShifts"),
    fillRatePercentThisWeek: t.exposeFloat("fillRatePercentThisWeek"),
    recentChanges: t.field({
      type: [DashboardRecentChangeRef],
      resolve: (summary) => summary.recentChanges,
    }),
  }),
});

export const ReportExportRef = builder.objectRef<{
  filename: string;
  mimeType: string;
  byteSize: number;
  contentBase64: string;
}>("ReportExport");
builder.objectType(ReportExportRef, {
  fields: (t) => ({
    filename: t.exposeString("filename"),
    mimeType: t.exposeString("mimeType"),
    byteSize: t.exposeInt("byteSize"),
    contentBase64: t.exposeString("contentBase64"),
  }),
});
