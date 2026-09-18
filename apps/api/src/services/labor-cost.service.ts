import { PayPeriodStatus, Prisma } from "@prisma/client";
import {
  DEFAULT_CURRENCY,
  ExportFormat,
  LaborCostGroupBy,
  laborCost,
  minutesBetween,
  paidMinutes,
  round2,
  roundHours,
  toDateOnly,
  type LaborCostReportDto,
  type LaborCostRowDto,
  type PayrollRowDto,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { buildXlsx } from "../utils/xlsx";
import { AuditService } from "./audit.service";

export interface LaborCostFilters {
  from: string;
  to: string;
  employeeId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
  roleId?: string | null;
}

export interface PayrollExportInput {
  payPeriodId?: string | null;
  from?: string | null;
  to?: string | null;
  format: ExportFormat;
}

export interface PayrollExportResult {
  filename: string;
  mimeType: string;
  body: Buffer;
}

const auditService = new AuditService();

interface EmployeeCost {
  employeeId: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  locationId: string | null;
  locationName: string | null;
  roleName: string | null;
  hourlyRate: number;
  plannedMinutes: number;
  actualMinutes: number;
  overtimeMinutes: number;
}

function decimalToNumber(value: Prisma.Decimal | null): number {
  return value === null ? 0 : Number(value);
}

function dayStart(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function dayEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999Z`);
}

function assertRange(from: string, to: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Dates must be in YYYY-MM-DD format");
  }
  if (from > to) throw new Error("`from` must not be after `to`");
}

/**
 * Labor cost and payroll aggregation. The hourly rate is the employee override
 * when present, otherwise the rate of their role.
 */
export class LaborCostService {
  async report(
    organizationId: string,
    filters: LaborCostFilters,
    groupBy: LaborCostGroupBy,
  ): Promise<LaborCostReportDto> {
    const costs = await this.employeeCosts(organizationId, filters);
    const groups = new Map<string, LaborCostRowDto & { rateWeight: number }>();

    for (const cost of costs) {
      const key =
        groupBy === LaborCostGroupBy.EMPLOYEE
          ? cost.employeeId
          : groupBy === LaborCostGroupBy.DEPARTMENT
            ? (cost.departmentId ?? "none")
            : (cost.locationId ?? "none");
      const label =
        groupBy === LaborCostGroupBy.EMPLOYEE
          ? cost.employeeName
          : groupBy === LaborCostGroupBy.DEPARTMENT
            ? (cost.departmentName ?? "No department")
            : (cost.locationName ?? "No location");
      const current =
        groups.get(key) ??
        {
          key,
          label,
          plannedHours: 0,
          actualHours: 0,
          overtimeHours: 0,
          hourlyRate: 0,
          plannedCost: 0,
          actualCost: 0,
          rateWeight: 0,
        };
      current.plannedHours += cost.plannedMinutes / 60;
      current.actualHours += cost.actualMinutes / 60;
      current.overtimeHours += cost.overtimeMinutes / 60;
      current.plannedCost += (cost.plannedMinutes / 60) * cost.hourlyRate;
      current.actualCost += (cost.actualMinutes / 60) * cost.hourlyRate;
      current.rateWeight += cost.hourlyRate;
      groups.set(key, current);
    }

    const rows: LaborCostRowDto[] = [...groups.values()]
      .map((group) => ({
        key: group.key,
        label: group.label,
        plannedHours: round2(group.plannedHours),
        actualHours: round2(group.actualHours),
        overtimeHours: round2(group.overtimeHours),
        hourlyRate: round2(group.rateWeight / Math.max(1, countOf(costs, groupBy, group.key))),
        plannedCost: round2(group.plannedCost),
        actualCost: round2(group.actualCost),
      }))
      .sort((a, b) => b.actualCost - a.actualCost || a.label.localeCompare(b.label));

    return {
      from: filters.from,
      to: filters.to,
      groupBy,
      currency: process.env.BILLING_CURRENCY?.toUpperCase() || DEFAULT_CURRENCY,
      rows,
      plannedHours: round2(rows.reduce((sum, row) => sum + row.plannedHours, 0)),
      actualHours: round2(rows.reduce((sum, row) => sum + row.actualHours, 0)),
      overtimeHours: round2(rows.reduce((sum, row) => sum + row.overtimeHours, 0)),
      plannedCost: round2(rows.reduce((sum, row) => sum + row.plannedCost, 0)),
      actualCost: round2(rows.reduce((sum, row) => sum + row.actualCost, 0)),
    };
  }

  async payrollRows(organizationId: string, filters: LaborCostFilters): Promise<PayrollRowDto[]> {
    const costs = await this.employeeCosts(organizationId, filters);
    return costs
      .map((cost): PayrollRowDto => {
        const actualHours = roundHours(cost.actualMinutes);
        return {
          employeeId: cost.employeeId,
          employeeName: cost.employeeName,
          departmentName: cost.departmentName,
          roleName: cost.roleName,
          locationName: cost.locationName,
          hourlyRate: round2(cost.hourlyRate),
          plannedHours: roundHours(cost.plannedMinutes),
          actualHours,
          overtimeHours: roundHours(cost.overtimeMinutes),
          grossPay: laborCost(actualHours, cost.hourlyRate),
        };
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }

  async payrollExport(
    organizationId: string,
    userId: string,
    input: PayrollExportInput,
  ): Promise<PayrollExportResult> {
    const range = await this.resolveRange(organizationId, input);
    const rows = await this.payrollRows(organizationId, { from: range.from, to: range.to });
    const columns: { key: keyof PayrollRowDto; header: string }[] = [
      { key: "employeeId", header: "Employee ID" },
      { key: "employeeName", header: "Employee" },
      { key: "departmentName", header: "Department" },
      { key: "roleName", header: "Role" },
      { key: "locationName", header: "Location" },
      { key: "hourlyRate", header: "Hourly Rate" },
      { key: "plannedHours", header: "Planned Hours" },
      { key: "actualHours", header: "Actual Hours" },
      { key: "overtimeHours", header: "Overtime Hours" },
      { key: "grossPay", header: "Gross Pay" },
    ];
    const table = rows.map((row) =>
      columns.map((column) => {
        const value = row[column.key];
        return value === null || value === undefined ? "" : value;
      }),
    );
    const isCsv = input.format === ExportFormat.CSV;
    if (!isCsv && input.format !== ExportFormat.EXCEL) {
      throw new Error("Payroll export supports CSV and EXCEL formats");
    }
    const body = isCsv
      ? csvBuffer(columns.map((column) => column.header), table)
      : buildXlsx({
          name: "Payroll",
          header: columns.map((column) => column.header),
          rows: table,
        });

    await auditService.log({
      userId,
      organizationId,
      action: "PAYROLL_EXPORTED",
      entity: "PayPeriod",
      entityId: input.payPeriodId ?? null,
      meta: { from: range.from, to: range.to, format: input.format, rowCount: rows.length },
    });

    return {
      filename: `payroll-${range.from}_${range.to}.${isCsv ? "csv" : "xlsx"}`,
      mimeType: isCsv
        ? "text/csv"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body,
    };
  }

  // ─── Pay periods ───────────────────────────────────────────

  async listPayPeriods(organizationId: string) {
    return prisma.payPeriod.findMany({ where: { organizationId }, orderBy: { from: "desc" } });
  }

  async openPayPeriod(
    organizationId: string,
    userId: string,
    input: { from: string; to: string },
  ) {
    assertRange(input.from, input.to);
    const overlapping = await prisma.payPeriod.findFirst({
      where: {
        organizationId,
        from: { lte: dayStart(input.to) },
        to: { gte: dayStart(input.from) },
      },
    });
    if (overlapping) throw new Error("Pay period overlaps an existing one");
    const period = await prisma.payPeriod.create({
      data: {
        organizationId,
        from: dayStart(input.from),
        to: dayStart(input.to),
        status: PayPeriodStatus.OPEN,
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "PAY_PERIOD_OPENED",
      entity: "PayPeriod",
      entityId: period.id,
      meta: { from: input.from, to: input.to },
    });
    return period;
  }

  async lockPayPeriod(organizationId: string, userId: string, id: string) {
    const period = await prisma.payPeriod.findFirst({ where: { id, organizationId } });
    if (!period) throw new Error("Pay period not found");
    if (period.status === PayPeriodStatus.LOCKED) throw new Error("Pay period is already locked");
    const locked = await prisma.payPeriod.update({
      where: { id },
      data: { status: PayPeriodStatus.LOCKED, lockedAt: new Date(), lockedById: userId },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "PAY_PERIOD_LOCKED",
      entity: "PayPeriod",
      entityId: id,
      meta: { from: toDateOnly(period.from), to: toDateOnly(period.to) },
    });
    return locked;
  }

  private async resolveRange(
    organizationId: string,
    input: PayrollExportInput,
  ): Promise<{ from: string; to: string }> {
    if (input.payPeriodId) {
      const period = await prisma.payPeriod.findFirst({
        where: { id: input.payPeriodId, organizationId },
      });
      if (!period) throw new Error("Pay period not found");
      return { from: toDateOnly(period.from), to: toDateOnly(period.to) };
    }
    if (!input.from || !input.to) {
      throw new Error("Either payPeriodId or from/to must be provided");
    }
    assertRange(input.from, input.to);
    return { from: input.from, to: input.to };
  }

  /** Per-employee planned/actual minutes and the applicable hourly rate. */
  private async employeeCosts(
    organizationId: string,
    filters: LaborCostFilters,
  ): Promise<EmployeeCost[]> {
    assertRange(filters.from, filters.to);
    const from = dayStart(filters.from);
    const to = dayEnd(filters.to);
    const employees = await prisma.employee.findMany({
      where: {
        organizationId,
        ...(filters.employeeId ? { id: filters.employeeId } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.roleId ? { roleId: filters.roleId } : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        role: { select: { name: true, hourlyRate: true } },
      },
    });
    if (employees.length === 0) return [];
    const employeeIds = employees.map((employee) => employee.id);

    const [assignments, entries] = await Promise.all([
      prisma.shiftAssignment.findMany({
        where: {
          organizationId,
          employeeId: { in: employeeIds },
          date: { gte: from, lte: to },
        },
        include: { shiftTemplate: true },
      }),
      prisma.timeEntry.findMany({
        where: {
          organizationId,
          employeeId: { in: employeeIds },
          clockInAt: { gte: from, lte: to },
          clockOutAt: { not: null },
        },
      }),
    ]);

    const plannedByEmployee = new Map<string, number>();
    for (const assignment of assignments) {
      const minutes = paidMinutes(
        assignment.startTime ?? assignment.shiftTemplate.startTime,
        assignment.endTime ?? assignment.shiftTemplate.endTime,
        assignment.breakMinutes,
      );
      plannedByEmployee.set(
        assignment.employeeId,
        (plannedByEmployee.get(assignment.employeeId) ?? 0) + minutes,
      );
    }
    const plannedByAssignment = new Map(
      assignments.map((assignment) => [
        assignment.id,
        paidMinutes(
          assignment.startTime ?? assignment.shiftTemplate.startTime,
          assignment.endTime ?? assignment.shiftTemplate.endTime,
          assignment.breakMinutes,
        ),
      ]),
    );
    const actualByEmployee = new Map<string, number>();
    const overtimeByEmployee = new Map<string, number>();
    for (const entry of entries) {
      const minutes = minutesBetween(entry.clockInAt, entry.clockOutAt as Date);
      actualByEmployee.set(
        entry.employeeId,
        (actualByEmployee.get(entry.employeeId) ?? 0) + minutes,
      );
      const planned = entry.shiftAssignmentId
        ? (plannedByAssignment.get(entry.shiftAssignmentId) ?? 0)
        : 0;
      const overtime = Math.max(0, minutes - planned);
      overtimeByEmployee.set(
        entry.employeeId,
        (overtimeByEmployee.get(entry.employeeId) ?? 0) + overtime,
      );
    }

    return employees.map((employee) => ({
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      departmentId: employee.department?.id ?? null,
      departmentName: employee.department?.name ?? null,
      locationId: employee.location?.id ?? null,
      locationName: employee.location?.name ?? null,
      roleName: employee.role?.name ?? null,
      hourlyRate:
        decimalToNumber(employee.hourlyRate) || decimalToNumber(employee.role?.hourlyRate ?? null),
      plannedMinutes: plannedByEmployee.get(employee.id) ?? 0,
      actualMinutes: actualByEmployee.get(employee.id) ?? 0,
      overtimeMinutes: overtimeByEmployee.get(employee.id) ?? 0,
    }));
  }
}

/** Number of employees behind a group, used to average the displayed rate. */
function countOf(costs: EmployeeCost[], groupBy: LaborCostGroupBy, key: string): number {
  return costs.filter((cost) => {
    if (groupBy === LaborCostGroupBy.EMPLOYEE) return cost.employeeId === key;
    if (groupBy === LaborCostGroupBy.DEPARTMENT) return (cost.departmentId ?? "none") === key;
    return (cost.locationId ?? "none") === key;
  }).length;
}

function csvBuffer(header: string[], rows: (string | number)[][]): Buffer {
  const quote = (value: string | number): string => {
    const text = String(value);
    return /["\r\n,]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [header.map(quote).join(","), ...rows.map((row) => row.map(quote).join(","))];
  return Buffer.from(`\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

export const laborCostService = new LaborCostService();
