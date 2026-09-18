import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import {
  ExportFormat,
  ReportGranularity,
  ReportType,
  type EmployeeWorkloadReportDto,
  type ScheduleFillRateReportDto,
  type WorkHoursReportDto,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { analyticsService, type ReportFilters } from "./analytics.service";

export interface ReportTable {
  title: string;
  columns: { key: string; header: string }[];
  rows: Record<string, string | number>[];
  subtitle: string;
}

export interface ReportExportInput {
  organizationId: string;
  type: ReportType;
  format: ExportFormat;
  filters: ReportFilters;
  granularity?: ReportGranularity;
  timezone?: string;
}

export interface ReportExportResult {
  filename: string;
  mimeType: string;
  body: Buffer;
}

export function toWorkHoursTable(
  report: WorkHoursReportDto,
  timezone = "UTC",
): ReportTable {
  return {
    title: "Work Hours Report",
    subtitle: `${formatDate(report.from, timezone)} – ${formatDate(report.to, timezone)}`,
    columns: [
      { key: "employeeName", header: "Employee" },
      { key: "departmentName", header: "Department" },
      { key: "roleName", header: "Role" },
      { key: "period", header: "Period" },
      { key: "shiftCount", header: "Shifts" },
      { key: "totalHours", header: "Hours" },
    ],
    rows: report.rows.map((row) => ({
      ...row,
      departmentName: row.departmentName ?? "",
      roleName: row.roleName ?? "",
    })),
  };
}

export function toEmployeeWorkloadTable(
  report: EmployeeWorkloadReportDto,
  timezone = "UTC",
): ReportTable {
  return {
    title: "Employee Workload Report",
    subtitle: `${formatDate(report.from, timezone)} – ${formatDate(report.to, timezone)}`,
    columns: [
      { key: "rank", header: "Rank" },
      { key: "employeeName", header: "Employee" },
      { key: "departmentName", header: "Department" },
      { key: "roleName", header: "Role" },
      { key: "totalHours", header: "Hours" },
      { key: "shiftCount", header: "Shifts" },
      { key: "avgWeeklyHours", header: "Avg Weekly Hours" },
      { key: "weeklyLimitHours", header: "Weekly Limit" },
      { key: "overtimeHours", header: "Overtime Hours" },
      { key: "utilizationPercent", header: "Utilization %" },
      { key: "isOverloaded", header: "Overloaded" },
    ],
    rows: report.rows.map((row) => ({
      ...row,
      departmentName: row.departmentName ?? "",
      roleName: row.roleName ?? "",
      isOverloaded: row.isOverloaded ? "Yes" : "No",
    })),
  };
}

export function toScheduleFillRateTable(
  report: ScheduleFillRateReportDto,
  timezone = "UTC",
): ReportTable {
  return {
    title: "Schedule Fill Rate Report",
    subtitle: `${formatDate(report.from, timezone)} – ${formatDate(report.to, timezone)}`,
    columns: [
      { key: "bucket", header: "Bucket" },
      { key: "category", header: "Category" },
      { key: "requiredCount", header: "Required" },
      { key: "assignedCount", header: "Assigned" },
      { key: "filledCount", header: "Filled" },
      { key: "fillRatePercent", header: "Fill Rate %" },
    ],
    rows: [
      ...report.byDate.map((bucket) => bucketRow(bucket, "Date")),
      ...report.byShift.map((bucket) => bucketRow(bucket, "Shift")),
      ...report.byRole.map((bucket) => bucketRow(bucket, "Role")),
    ],
  };
}

export function toTable(
  type: ReportType,
  report: WorkHoursReportDto | EmployeeWorkloadReportDto | ScheduleFillRateReportDto,
  timezone = "UTC",
): ReportTable {
  if (type === ReportType.WORK_HOURS) {
    return toWorkHoursTable(report as WorkHoursReportDto, timezone);
  }
  if (type === ReportType.EMPLOYEE_WORKLOAD) {
    return toEmployeeWorkloadTable(report as EmployeeWorkloadReportDto, timezone);
  }
  return toScheduleFillRateTable(report as ScheduleFillRateReportDto, timezone);
}

export class ReportExportService {
  async export(input: ReportExportInput): Promise<ReportExportResult> {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      select: { timezone: true },
    });
    const timezone = input.timezone ?? organization.timezone;
    const granularity = input.granularity ?? ReportGranularity.WEEK;
    let report: WorkHoursReportDto | EmployeeWorkloadReportDto | ScheduleFillRateReportDto;
    if (input.type === ReportType.WORK_HOURS) {
      report = await analyticsService.workHours(input.organizationId, input.filters, granularity);
    } else if (input.type === ReportType.EMPLOYEE_WORKLOAD) {
      report = await analyticsService.employeeWorkload(input.organizationId, input.filters);
    } else {
      report = await analyticsService.scheduleFillRate(input.organizationId, input.filters);
    }
    const table = toTable(input.type, report, timezone);
    const extension = input.format === ExportFormat.CSV ? "csv" : input.format === ExportFormat.EXCEL ? "xlsx" : "pdf";
    const body =
      input.format === ExportFormat.CSV
        ? csvBuffer(table)
        : input.format === ExportFormat.EXCEL
          ? await excelBuffer(table)
          : await pdfBuffer(table, timezone);
    return {
      filename: `${input.type.toLowerCase()}-${input.filters.from}_${input.filters.to}.${extension}`,
      mimeType:
        input.format === ExportFormat.CSV
          ? "text/csv"
          : input.format === ExportFormat.EXCEL
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
      body,
    };
  }
}

function bucketRow(
  bucket: ScheduleFillRateReportDto["byDate"][number],
  category: string,
): Record<string, string | number> {
  return {
    bucket: bucket.label,
    category,
    requiredCount: bucket.requiredCount,
    assignedCount: bucket.assignedCount,
    filledCount: bucket.filledCount,
    fillRatePercent: bucket.fillRatePercent,
  };
}

function csvBuffer(table: ReportTable): Buffer {
  const quote = (value: string | number): string => {
    const text = String(value);
    return /["\r\n,]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [
    table.columns.map((column) => quote(column.header)).join(","),
    ...table.rows.map((row) => table.columns.map((column) => quote(row[column.key] ?? "")).join(",")),
  ];
  return Buffer.from(`\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

async function excelBuffer(table: ReportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(table.title);
  worksheet.columns = table.columns.map((column) => ({ key: column.key, header: column.header }));
  for (const row of table.rows) worksheet.addRow(row);
  const header = worksheet.getRow(1);
  header.font = { bold: true };
  const result = await workbook.xlsx.writeBuffer();
  return Buffer.from(result);
}

function pdfBuffer(table: ReportTable, timezone: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.fontSize(18).text(table.title);
    document.fontSize(10).text(table.subtitle);
    document.text(`Generated ${formatDateTime(new Date(), timezone)}`);
    document.moveDown();
    document.fontSize(8).text(table.columns.map((column) => column.header).join(" | "));
    document.moveDown(0.25);
    for (const row of table.rows) {
      document.text(table.columns.map((column) => String(row[column.key] ?? "")).join(" | "));
    }
    document.end();
  });
}

function formatDate(value: string, timezone: string): string {
  return formatDateTime(new Date(`${value}T00:00:00.000Z`), timezone, { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(
  value: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, ...options }).format(value);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...options }).format(value);
  }
}

export const reportExportService = new ReportExportService();
