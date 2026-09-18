import {
  EmployeeStatus,
  LeaveStatus,
  MembershipRole,
  Prisma,
  ScheduleStatus,
} from "@prisma/client";
import {
  addDays,
  fillRatePercent,
  ReportGranularity,
  roundHours,
  startOfWeek,
  toDateOnly,
  type DashboardSummaryDto,
  type EmployeeWorkloadReportDto,
  type EmployeeWorkloadRowDto,
  type FillRateBucketDto,
  type ScheduleFillRateReportDto,
  type WorkHoursReportDto,
  type WorkHoursRowDto,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";

export interface ReportFilters {
  from: string;
  to: string;
  employeeId?: string | null;
  departmentId?: string | null;
  roleId?: string | null;
  includeDrafts?: boolean;
}

interface WorkAggregateRow {
  employeeId: string;
  period: string;
  shiftCount: number;
  paidMinutes: number;
}

interface FillAggregateRow {
  date: string;
  shiftTemplateId: string;
  roleId: string;
  requiredCount: number;
  assignedCount: number;
}

const PERIOD_EXPR: Record<ReportGranularity, string> = {
  [ReportGranularity.DAY]: `to_char(p.date, 'YYYY-MM-DD')`,
  [ReportGranularity.WEEK]: `to_char(date_trunc('week', p.date), 'YYYY-MM-DD')`,
  [ReportGranularity.MONTH]: `to_char(p.date, 'YYYY-MM')`,
  [ReportGranularity.TOTAL]: "'total'::text",
};

export class AnalyticsService {
  async workHours(
    organizationId: string,
    filters: ReportFilters,
    granularity: ReportGranularity,
  ): Promise<WorkHoursReportDto> {
    validateFilters(filters);
    const aggregates = await this.aggregateWorkHours(organizationId, filters, granularity);
    const employeeIds = [...new Set(aggregates.map((row) => row.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { organizationId, id: { in: employeeIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
        role: { select: { name: true } },
      },
    });
    const byId = new Map(employees.map((employee) => [employee.id, employee]));
    const rows = aggregates
      .map((aggregate): WorkHoursRowDto => {
        const employee = byId.get(aggregate.employeeId);
        return {
          employeeId: aggregate.employeeId,
          employeeName: employee ? employeeName(employee) : aggregate.employeeId,
          departmentName: employee?.department?.name ?? null,
          roleName: employee?.role?.name ?? null,
          period: aggregate.period,
          shiftCount: aggregate.shiftCount,
          totalHours: roundHours(aggregate.paidMinutes),
        };
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.period.localeCompare(b.period));

    return {
      from: filters.from,
      to: filters.to,
      granularity,
      rows,
      totalHours: roundHours(aggregates.reduce((sum, row) => sum + row.paidMinutes, 0)),
      totalShifts: aggregates.reduce((sum, row) => sum + row.shiftCount, 0),
    };
  }

  async employeeWorkload(
    organizationId: string,
    filters: ReportFilters,
  ): Promise<EmployeeWorkloadReportDto> {
    validateFilters(filters);
    const [aggregates, organization, employees] = await Promise.all([
      this.aggregateWorkHours(organizationId, filters, ReportGranularity.WEEK),
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { maxWeeklyHours: true },
      }),
      prisma.employee.findMany({
        where: {
          organizationId,
          status: { not: EmployeeStatus.DISMISSED },
          ...(filters.employeeId ? { id: filters.employeeId } : {}),
          ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
          ...(filters.roleId ? { roleId: filters.roleId } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          maxHoursPerWeek: true,
          department: { select: { name: true } },
          role: { select: { name: true } },
        },
      }),
    ]);
    const byEmployee = new Map<string, WorkAggregateRow[]>();
    for (const aggregate of aggregates) {
      const rows = byEmployee.get(aggregate.employeeId) ?? [];
      rows.push(aggregate);
      byEmployee.set(aggregate.employeeId, rows);
    }
    const weeksInPeriod = countWeeks(filters.from, filters.to);
    const rows = employees.map((employee): EmployeeWorkloadRowDto => {
      const employeeRows = byEmployee.get(employee.id) ?? [];
      const totalMinutes = employeeRows.reduce((sum, row) => sum + row.paidMinutes, 0);
      const weeklyLimitHours = employee.maxHoursPerWeek ?? organization.maxWeeklyHours;
      const overtimeMinutes = employeeRows.reduce(
        (sum, row) => sum + Math.max(0, row.paidMinutes - weeklyLimitHours * 60),
        0,
      );
      const totalHours = roundHours(totalMinutes);
      const denominator = weeklyLimitHours * weeksInPeriod;
      return {
        employeeId: employee.id,
        employeeName: employeeName(employee),
        departmentName: employee.department?.name ?? null,
        roleName: employee.role?.name ?? null,
        totalHours,
        shiftCount: employeeRows.reduce((sum, row) => sum + row.shiftCount, 0),
        weeksInPeriod,
        avgWeeklyHours: round2(totalHours / weeksInPeriod),
        weeklyLimitHours,
        overtimeHours: roundHours(overtimeMinutes),
        utilizationPercent: denominator > 0 ? round2((totalHours / denominator) * 100) : 0,
        isOverloaded: overtimeMinutes > 0,
        rank: 0,
      };
    });
    rows.sort((a, b) => b.totalHours - a.totalHours || a.employeeName.localeCompare(b.employeeName));
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });
    const totalHours = round2(rows.reduce((sum, row) => sum + row.totalHours, 0));
    return {
      from: filters.from,
      to: filters.to,
      rows,
      totalHours,
      averageHours: rows.length > 0 ? round2(totalHours / rows.length) : 0,
    };
  }

  async scheduleFillRate(
    organizationId: string,
    filters: ReportFilters,
  ): Promise<ScheduleFillRateReportDto> {
    validateFilters(filters);
    const fromDate = dateAtUtc(filters.from);
    const toExclusive = addDays(filters.to, 1);
    const includeDrafts = filters.includeDrafts ?? false;
    const rows = await prisma.$queryRaw<FillAggregateRow[]>(Prisma.sql`
      WITH req AS (
        SELECT r."date"::date AS date, r."shiftTemplateId" AS shift_template_id, r."roleId" AS role_id,
               SUM(r."requiredCount")::int AS required_count
        FROM shift_requirements r
        JOIN schedules s ON s.id = r."scheduleId"
        WHERE r."organizationId" = ${organizationId}
          AND r."date" >= ${fromDate} AND r."date" < ${toExclusive}
          AND (${includeDrafts} OR s.status = 'PUBLISHED')
        GROUP BY 1, 2, 3
      ), asg AS (
        SELECT a."date"::date AS date, a."shiftTemplateId" AS shift_template_id, a."roleId" AS role_id,
               COUNT(*)::int AS assigned_count
        FROM shift_assignments a
        JOIN schedules s ON s.id = a."scheduleId"
        WHERE a."organizationId" = ${organizationId}
          AND a."date" >= ${fromDate} AND a."date" < ${toExclusive}
          AND (${includeDrafts} OR s.status = 'PUBLISHED')
        GROUP BY 1, 2, 3
      )
      SELECT to_char(req.date, 'YYYY-MM-DD') AS "date", req.shift_template_id AS "shiftTemplateId",
             req.role_id AS "roleId", req.required_count AS "requiredCount",
             COALESCE(asg.assigned_count, 0) AS "assignedCount"
      FROM req LEFT JOIN asg
        ON asg.date = req.date AND asg.shift_template_id = req.shift_template_id AND asg.role_id = req.role_id
      ORDER BY req.date, req.shift_template_id, req.role_id
    `);
    const [templates, roles] = await Promise.all([
      prisma.shiftTemplate.findMany({
        where: { organizationId, id: { in: [...new Set(rows.map((row) => row.shiftTemplateId))] } },
        select: { id: true, name: true },
      }),
      prisma.role.findMany({
        where: { organizationId, id: { in: [...new Set(rows.map((row) => row.roleId))] } },
        select: { id: true, name: true },
      }),
    ]);
    const templateNames = new Map(templates.map((template) => [template.id, template.name]));
    const roleNames = new Map(roles.map((role) => [role.id, role.name]));
    const normalized = rows.map((row) => ({
      ...row,
      filledCount: Math.min(row.requiredCount, row.assignedCount),
    }));
    const requiredCount = normalized.reduce((sum, row) => sum + row.requiredCount, 0);
    const assignedCount = normalized.reduce((sum, row) => sum + row.assignedCount, 0);
    const filledCount = normalized.reduce((sum, row) => sum + row.filledCount, 0);
    const openCount = normalized.reduce(
      (sum, row) => sum + Math.max(0, row.requiredCount - row.assignedCount),
      0,
    );
    return {
      from: filters.from,
      to: filters.to,
      requiredCount,
      assignedCount,
      filledCount,
      openCount,
      fillRatePercent: fillRatePercent(requiredCount, filledCount),
      byDate: bucketRows(normalized, (row) => row.date, (row) => row.date),
      byShift: bucketRows(
        normalized,
        (row) => row.shiftTemplateId,
        (row) => templateNames.get(row.shiftTemplateId) ?? row.shiftTemplateId,
      ),
      byRole: bucketRows(
        normalized,
        (row) => row.roleId,
        (row) => roleNames.get(row.roleId) ?? row.roleId,
      ),
    };
  }

  async dashboardSummary(
    organizationId: string,
    _role: MembershipRole,
  ): Promise<DashboardSummaryDto> {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const today = organizationDate(organization.timezone);
    const todayDate = dateAtUtc(today);
    const tomorrow = addDays(todayDate, 1);
    const weekStart = toDateOnly(startOfWeek(today));
    const weekEnd = toDateOnly(addDays(weekStart, 6));
    const [working, absent, openRequests, fillRate, recentChanges] = await Promise.all([
      prisma.shiftAssignment.findMany({
        where: {
          organizationId,
          date: { gte: todayDate, lt: tomorrow },
          schedule: { status: ScheduleStatus.PUBLISHED },
        },
        distinct: ["employeeId"],
        select: { employeeId: true },
      }),
      prisma.employee.count({
        where: {
          organizationId,
          OR: [
            { status: { in: [EmployeeStatus.VACATION, EmployeeStatus.SICK] } },
            {
              leaveRequests: {
                some: {
                  organizationId,
                  status: LeaveStatus.APPROVED,
                  startDate: { lte: todayDate },
                  endDate: { gte: todayDate },
                },
              },
            },
          ],
        },
      }),
      prisma.leaveRequest.count({ where: { organizationId, status: LeaveStatus.PENDING } }),
      this.scheduleFillRate(organizationId, {
        from: weekStart,
        to: weekEnd,
      }),
      prisma.shiftAssignmentHistory.findMany({
        where: { organizationId },
        orderBy: { changedAt: "desc" },
        take: 10,
        include: {
          changedBy: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);
    const historyEmployeeIds = [
      ...new Set(
        recentChanges.flatMap((change) =>
          [change.previousEmployeeId, change.newEmployeeId].filter(
            (id): id is string => id !== null,
          ),
        ),
      ),
    ];
    const historyEmployees = await prisma.employee.findMany({
      where: { organizationId, id: { in: historyEmployeeIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const historyNames = new Map(historyEmployees.map((employee) => [employee.id, employeeName(employee)]));
    return {
      date: today,
      workingToday: working.length,
      absentToday: absent,
      openRequests,
      openShifts: fillRate.openCount,
      fillRatePercentThisWeek: fillRate.fillRatePercent,
      recentChanges: recentChanges.map((change) => ({
        id: change.id,
        changeType: change.changeType as DashboardSummaryDto["recentChanges"][number]["changeType"],
        date: toDateOnly(change.date),
        scheduleId: change.scheduleId,
        previousEmployeeName: change.previousEmployeeId
          ? historyNames.get(change.previousEmployeeId) ?? null
          : null,
        newEmployeeName: change.newEmployeeId ? historyNames.get(change.newEmployeeId) ?? null : null,
        changedByName: change.changedBy ? employeeName(change.changedBy) : null,
        changedAt: change.changedAt.toISOString(),
      })),
    };
  }

  private async aggregateWorkHours(
    organizationId: string,
    filters: ReportFilters,
    granularity: ReportGranularity,
  ): Promise<WorkAggregateRow[]> {
    const fromDate = dateAtUtc(filters.from);
    const toExclusive = addDays(filters.to, 1);
    const employeeId = filters.employeeId ?? null;
    const departmentId = filters.departmentId ?? null;
    const roleId = filters.roleId ?? null;
    const includeDrafts = filters.includeDrafts ?? false;
    const periodExpression = Prisma.raw(PERIOD_EXPR[granularity]);
    return prisma.$queryRaw<WorkAggregateRow[]>(Prisma.sql`
      WITH base AS (
        SELECT a."employeeId" AS employee_id,
               a."date"::date AS date,
               (split_part(COALESCE(a."startTime", t."startTime"), ':', 1)::int * 60
                + split_part(COALESCE(a."startTime", t."startTime"), ':', 2)::int) AS start_minutes,
               (split_part(COALESCE(a."endTime", t."endTime"), ':', 1)::int * 60
                + split_part(COALESCE(a."endTime", t."endTime"), ':', 2)::int) AS end_minutes,
               a."breakMinutes" AS break_minutes
        FROM shift_assignments a
        JOIN shift_templates t ON t.id = a."shiftTemplateId"
        JOIN schedules s ON s.id = a."scheduleId"
        JOIN employees e ON e.id = a."employeeId"
        WHERE a."organizationId" = ${organizationId}
          AND a."date" >= ${fromDate} AND a."date" < ${toExclusive}
          AND (${includeDrafts} OR s.status = 'PUBLISHED')
          AND (${employeeId}::text IS NULL OR a."employeeId" = ${employeeId})
          AND (${departmentId}::text IS NULL OR e."departmentId" = ${departmentId})
          AND (${roleId}::text IS NULL OR e."roleId" = ${roleId})
      ), p AS (
        SELECT employee_id, date,
               GREATEST(
                 (CASE WHEN end_minutes > start_minutes THEN end_minutes - start_minutes
                       ELSE 1440 - start_minutes + end_minutes END) - break_minutes, 0) AS paid_minutes
        FROM base
      )
      SELECT p.employee_id AS "employeeId", ${periodExpression} AS period,
             COUNT(*)::int AS "shiftCount", COALESCE(SUM(p.paid_minutes), 0)::int AS "paidMinutes"
      FROM p GROUP BY 1, 2 ORDER BY 1, 2
    `);
  }
}

function validateFilters(filters: ReportFilters): void {
  if (filters.from > filters.to || !isDateOnly(filters.from) || !isDateOnly(filters.to)) {
    throw new Error("Invalid date range");
  }
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dateAtUtc(value).getTime());
}

function dateAtUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function countWeeks(from: string, to: string): number {
  const end = dateAtUtc(to);
  let cursor = startOfWeek(from);
  let count = 0;
  while (cursor <= end) {
    count += 1;
    cursor = addDays(cursor, 7);
  }
  return count;
}

function employeeName(employee: { firstName: string; lastName: string }): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function organizationDate(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  }
}

function bucketRows(
  rows: Array<FillAggregateRow & { filledCount: number }>,
  keyOf: (row: FillAggregateRow) => string,
  labelOf: (row: FillAggregateRow) => string,
): FillRateBucketDto[] {
  const buckets = new Map<string, FillRateBucketDto>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = buckets.get(key) ?? {
      key,
      label: labelOf(row),
      requiredCount: 0,
      assignedCount: 0,
      filledCount: 0,
      fillRatePercent: 0,
    };
    bucket.requiredCount += row.requiredCount;
    bucket.assignedCount += row.assignedCount;
    bucket.filledCount += row.filledCount;
    bucket.fillRatePercent = fillRatePercent(bucket.requiredCount, bucket.filledCount);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const analyticsService = new AnalyticsService();
