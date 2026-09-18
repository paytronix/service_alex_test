import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { graphql } from "graphql";
import {
  EmployeeStatus,
  LeaveStatus,
  MembershipRole,
  ScheduleChangeType,
  ScheduleStatus,
} from "@prisma/client";
import { ExportFormat, ReportGranularity, ReportType } from "@shiftflow/shared";
import { schema } from "../src/schema";
import { analyticsService } from "../src/services/analytics.service";
import { reportExportService } from "../src/services/report-export.service";
import { prisma } from "../src/utils/prisma";
import { createLoaders } from "../src/utils/loaders";
import type { GraphQLContext } from "../src/middleware/auth";

const suffix = `reports-${Date.now()}`;
let organizationId = "";
let ownerId = "";
let supervisorId = "";
let employeeUserId = "";
let employeeId = "";
let otherEmployeeId = "";
let templateId = "";
let roleId = "";
let scheduleId = "";
let assignmentId = "";
let reportDate = "";

function context(userId: string): GraphQLContext {
  return {
    user: { userId, email: `${userId}@example.test` },
    prisma,
    loaders: createLoaders(),
    getMembership: async (organization) =>
      prisma.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId: organization } },
        select: { role: true },
      }),
  };
}

async function run(source: string, userId: string, variables: Record<string, unknown>) {
  return graphql({ schema, source, variableValues: variables, contextValue: context(userId) });
}

beforeAll(async () => {
  const today = new Date();
  reportDate = today.toISOString().slice(0, 10);
  const organization = await prisma.organization.create({
    data: { name: `Reports ${suffix}`, slug: `reports-${suffix}`, timezone: "UTC" },
  });
  organizationId = organization.id;
  const owner = await prisma.user.create({
    data: { email: `reports-owner-${suffix}@example.test`, passwordHash: "hash", firstName: "Report", lastName: "Owner" },
  });
  ownerId = owner.id;
  const supervisor = await prisma.user.create({
    data: { email: `reports-supervisor-${suffix}@example.test`, passwordHash: "hash", firstName: "Report", lastName: "Supervisor" },
  });
  supervisorId = supervisor.id;
  const employeeUser = await prisma.user.create({
    data: { email: `reports-employee-${suffix}@example.test`, passwordHash: "hash", firstName: "Report", lastName: "Employee" },
  });
  employeeUserId = employeeUser.id;
  await prisma.membership.createMany({
    data: [
      { organizationId, userId: ownerId, role: MembershipRole.OWNER },
      { organizationId, userId: supervisorId, role: MembershipRole.SUPERVISOR },
      { organizationId, userId: employeeUserId, role: MembershipRole.EMPLOYEE },
    ],
  });
  const department = await prisma.department.create({ data: { organizationId, name: `Reports Dept ${suffix}` } });
  const role = await prisma.role.create({ data: { organizationId, name: `Reports Role ${suffix}` } });
  roleId = role.id;
  const template = await prisma.shiftTemplate.create({
    data: { organizationId, name: `Reports Shift ${suffix}`, startTime: "22:00", endTime: "06:00", breakMinutes: 30 },
  });
  templateId = template.id;
  const employee = await prisma.employee.create({
    data: {
      organizationId,
      userId: employeeUserId,
      firstName: "Alice",
      lastName: "Worker",
      email: employeeUser.email,
      departmentId: department.id,
      roleId,
      maxHoursPerWeek: 4,
      status: EmployeeStatus.WORKING,
    },
  });
  employeeId = employee.id;
  const otherEmployee = await prisma.employee.create({
    data: {
      organizationId,
      firstName: "Bob",
      lastName: "Idle",
      email: `reports-idle-${suffix}@example.test`,
      departmentId: department.id,
      roleId,
      status: EmployeeStatus.WORKING,
    },
  });
  otherEmployeeId = otherEmployee.id;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  scheduleId = (
    await prisma.schedule.create({
      data: { organizationId, weekStartDate: new Date(`${monday.toISOString().slice(0, 10)}T00:00:00.000Z`), status: ScheduleStatus.PUBLISHED },
    })
  ).id;
  assignmentId = (
    await prisma.shiftAssignment.create({
      data: {
        organizationId,
        scheduleId,
        employeeId,
        shiftTemplateId: templateId,
        roleId,
        date: new Date(`${reportDate}T00:00:00.000Z`),
        breakMinutes: 30,
      },
    })
  ).id;
  await prisma.shiftRequirement.create({
    data: {
      organizationId,
      scheduleId,
      date: new Date(`${reportDate}T00:00:00.000Z`),
      shiftTemplateId: templateId,
      roleId,
      requiredCount: 2,
    },
  });
  await prisma.leaveRequest.create({
    data: {
      organizationId,
      employeeId: otherEmployeeId,
      type: "VACATION",
      status: LeaveStatus.PENDING,
      startDate: new Date(`${reportDate}T00:00:00.000Z`),
      endDate: new Date(`${reportDate}T00:00:00.000Z`),
    },
  });
  await prisma.leaveRequest.create({
    data: {
      organizationId,
      employeeId,
      type: "VACATION",
      status: LeaveStatus.APPROVED,
      startDate: new Date(`${reportDate}T00:00:00.000Z`),
      endDate: new Date(`${reportDate}T00:00:00.000Z`),
    },
  });
  await prisma.shiftAssignmentHistory.create({
    data: {
      organizationId,
      scheduleId,
      assignmentId,
      changeType: ScheduleChangeType.CREATED,
      date: new Date(`${reportDate}T00:00:00.000Z`),
      newEmployeeId: employeeId,
      changedById: ownerId,
    },
  });
});

afterAll(async () => {
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
});

describe("analytics reports", () => {
  const filters = () => ({ from: reportDate, to: reportDate });

  it("aggregates paid hours across midnight and fill rate", async () => {
    const hours = await analyticsService.workHours(organizationId, filters(), ReportGranularity.TOTAL);
    expect(hours.rows).toHaveLength(1);
    expect(hours.rows[0].totalHours).toBe(7.5);
    expect(hours.totalShifts).toBe(1);
    const fill = await analyticsService.scheduleFillRate(organizationId, filters());
    expect(fill.requiredCount).toBe(2);
    expect(fill.filledCount).toBe(1);
    expect(fill.openCount).toBe(1);
    expect(fill.fillRatePercent).toBe(50);
  });

  it("includes zero-work employees and ranks workload", async () => {
    const workload = await analyticsService.employeeWorkload(organizationId, filters());
    expect(workload.rows.map((row) => row.employeeId)).toEqual([employeeId, otherEmployeeId]);
    expect(workload.rows[0].overtimeHours).toBeGreaterThan(0);
    expect(workload.rows[1].totalHours).toBe(0);
  });

  it("returns dashboard data and exports all formats", async () => {
    const dashboard = await analyticsService.dashboardSummary(organizationId, MembershipRole.OWNER);
    expect(dashboard.workingToday).toBe(1);
    expect(dashboard.absentToday).toBe(1);
    expect(dashboard.openRequests).toBe(1);
    expect(dashboard.openShifts).toBe(1);
    expect(dashboard.recentChanges).toHaveLength(1);
    for (const format of [ExportFormat.CSV, ExportFormat.EXCEL, ExportFormat.PDF]) {
      const result = await reportExportService.export({
        organizationId,
        type: ReportType.WORK_HOURS,
        format,
        filters: filters(),
        granularity: ReportGranularity.WEEK,
      });
      expect(result.body.byteLength).toBeGreaterThan(4);
      if (format === ExportFormat.CSV) expect(result.body.toString("utf8")).toContain("\uFEFFEmployee");
      if (format === ExportFormat.EXCEL) expect(result.body.subarray(0, 2).toString()).toBe("PK");
      if (format === ExportFormat.PDF) expect(result.body.subarray(0, 4).toString()).toBe("%PDF");
    }
  });
});

describe("report GraphQL RBAC", () => {
  it("allows supervisors to read and rejects exports", async () => {
    const result = await run(
      `query ($organizationId: String!, $from: String!, $to: String!) {
        workHoursReport(organizationId: $organizationId, from: $from, to: $to) { totalHours }
      }`,
      supervisorId,
      { organizationId, from: reportDate, to: reportDate },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.workHoursReport.totalHours).toBe(7.5);
    const exportResult = await run(
      `query ($organizationId: String!, $from: String!, $to: String!) {
        exportReport(organizationId: $organizationId, type: WORK_HOURS, format: CSV, from: $from, to: $to) { filename }
      }`,
      supervisorId,
      { organizationId, from: reportDate, to: reportDate },
    );
    expect(exportResult.errors?.some((error) => error.message.includes("Insufficient permissions"))).toBe(true);
  });

  it("restricts employees to their own hours", async () => {
    const own = await run(
      `query ($organizationId: String!, $from: String!, $to: String!) {
        workHoursReport(organizationId: $organizationId, from: $from, to: $to) { totalHours }
      }`,
      employeeUserId,
      { organizationId, from: reportDate, to: reportDate },
    );
    expect(own.errors).toBeUndefined();
    expect(own.data?.workHoursReport.totalHours).toBe(7.5);
    const other = await run(
      `query ($organizationId: String!, $from: String!, $to: String!, $employeeId: String) {
        workHoursReport(organizationId: $organizationId, from: $from, to: $to, employeeId: $employeeId) { totalHours }
      }`,
      employeeUserId,
      { organizationId, from: reportDate, to: reportDate, employeeId: otherEmployeeId },
    );
    expect(other.errors?.[0]?.message).toBe("Employees may only view their own work hours");
  });
});
