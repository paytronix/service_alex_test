import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { graphql, type ExecutionResult } from "graphql";
import { MembershipRole } from "@prisma/client";
import { schema } from "../src/schema";
import { prisma } from "../src/utils/prisma";
import { createLoaders } from "../src/utils/loaders";
import type { GraphQLContext } from "../src/middleware/auth";

const suffix = `schedule-${Date.now()}`;
let organizationId = "";
let ownerId = "";
let employeeUserId = "";
let supervisorUserId = "";
let otherUserId = "";
let employeeId = "";
let otherEmployeeId = "";
let roleId = "";
let templateId = "";
let scheduleId = "";
let departmentId = "";
let otherDepartmentId = "";

function context(userId: string): GraphQLContext {
  return {
    user: { userId, email: "owner@example.test" },
    prisma,
    loaders: createLoaders(),
    getMembership: async (organization) =>
      prisma.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId: organization } },
        select: { role: true },
      }),
  };
}

async function run<T>(
  source: string,
  variableValues: Record<string, unknown>,
  userId = ownerId,
): Promise<ExecutionResult<T>> {
  return (await graphql({
    schema,
    source,
    variableValues,
    contextValue: context(userId),
  })) as ExecutionResult<T>;
}

function firstError(result: ExecutionResult): string {
  return result.errors?.[0]?.message ?? "";
}

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: { name: `Schedule ${suffix}`, slug: `schedule-${suffix}` },
  });
  organizationId = organization.id;
  const owner = await prisma.user.create({
    data: {
      email: `owner-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: "Owner",
      lastName: "Test",
    },
  });
  ownerId = owner.id;
  await prisma.membership.create({
    data: { userId: ownerId, organizationId, role: MembershipRole.OWNER },
  });
  const employeeUser = await prisma.user.create({
    data: {
      email: `employee-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: "Employee",
      lastName: "User",
    },
  });
  employeeUserId = employeeUser.id;
  await prisma.membership.create({
    data: { userId: employeeUserId, organizationId, role: MembershipRole.EMPLOYEE },
  });
  const supervisorUser = await prisma.user.create({
    data: {
      email: `supervisor-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: "Supervisor",
      lastName: "User",
    },
  });
  supervisorUserId = supervisorUser.id;
  await prisma.membership.create({
    data: { userId: supervisorUserId, organizationId, role: MembershipRole.SUPERVISOR },
  });
  const otherUser = await prisma.user.create({
    data: {
      email: `other-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: "Other",
      lastName: "User",
    },
  });
  otherUserId = otherUser.id;
  const role = await prisma.role.create({ data: { name: `Barista ${suffix}`, organizationId } });
  roleId = role.id;
  const department = await prisma.department.create({
    data: { name: `Front ${suffix}`, organizationId },
  });
  departmentId = department.id;
  const otherDepartment = await prisma.department.create({
    data: { name: `Kitchen ${suffix}`, organizationId },
  });
  otherDepartmentId = otherDepartment.id;
  const template = await prisma.shiftTemplate.create({
    data: {
      name: `Morning ${suffix}`,
      organizationId,
      roleId,
      startTime: "08:00",
      endTime: "16:00",
      breakMinutes: 30,
    },
  });
  templateId = template.id;
  const employee = await prisma.employee.create({
    data: {
      organizationId,
      userId: employeeUserId,
      firstName: "Employee",
      lastName: "Test",
      email: `employee-${suffix}@example.test`,
      roleId,
      departmentId,
      maxHoursPerWeek: 40,
    },
  });
  employeeId = employee.id;
  const supervisorEmployee = await prisma.employee.create({
    data: {
      organizationId,
      userId: supervisorUserId,
      firstName: "Supervisor",
      lastName: "Test",
      email: `supervisor-${suffix}@example.test`,
      roleId,
      departmentId,
    },
  });
  const otherEmployee = await prisma.employee.create({
    data: {
      organizationId,
      userId: otherUserId,
      firstName: "Other",
      lastName: "Test",
      email: `other-${suffix}@example.test`,
      roleId,
      departmentId: otherDepartmentId,
    },
  });
  otherEmployeeId = otherEmployee.id;
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } });
  await prisma.user.deleteMany({
    where: { id: { in: [ownerId, employeeUserId, supervisorUserId, otherUserId] } },
  });
  await prisma.$disconnect();
});

describe("schedule GraphQL API", () => {
  it("creates a draft idempotently and assigns a shift", async () => {
    const create = await run<{ createDraftSchedule: { id: string; status: string } }>(
      `mutation ($organizationId: String!, $weekStartDate: DateTime!) {
        createDraftSchedule(organizationId: $organizationId, weekStartDate: $weekStartDate) { id status }
      }`,
      { organizationId, weekStartDate: "2026-09-23T00:00:00.000Z" },
    );
    expect(create.errors).toBeUndefined();
    scheduleId = create.data!.createDraftSchedule.id;
    expect(create.data!.createDraftSchedule.status).toBe("DRAFT");

    const again = await run<{ createDraftSchedule: { id: string } }>(
      `mutation ($organizationId: String!, $weekStartDate: DateTime!) {
        createDraftSchedule(organizationId: $organizationId, weekStartDate: $weekStartDate) { id }
      }`,
      { organizationId, weekStartDate: "2026-09-21T00:00:00.000Z" },
    );
    expect(again.data!.createDraftSchedule.id).toBe(scheduleId);

    const assigned = await run<{ assignShift: { assignment: { id: string }; violations: Array<{ code: string }> } }>(
      `mutation ($organizationId: String!, $scheduleId: String!, $employeeId: String!, $shiftTemplateId: String!, $date: DateTime!) {
        assignShift(organizationId: $organizationId, scheduleId: $scheduleId, employeeId: $employeeId, shiftTemplateId: $shiftTemplateId, date: $date) {
          assignment { id effectiveStartTime effectiveEndTime durationHours }
          violations { code level }
        }
      }`,
      { organizationId, scheduleId, employeeId, shiftTemplateId: templateId, date: "2026-09-21T00:00:00.000Z" },
    );
    expect(assigned.errors).toBeUndefined();
    expect(assigned.data!.assignShift.assignment.effectiveStartTime).toBe("08:00");

    const otherAssignment = await run(
      `mutation ($organizationId: String!, $scheduleId: String!, $employeeId: String!, $shiftTemplateId: String!, $date: DateTime!) {
        assignShift(organizationId: $organizationId, scheduleId: $scheduleId, employeeId: $employeeId, shiftTemplateId: $shiftTemplateId, date: $date) {
          assignment { id }
        }
      }`,
      {
        organizationId,
        scheduleId,
        employeeId: otherEmployeeId,
        shiftTemplateId: templateId,
        date: "2026-09-22T00:00:00.000Z",
      },
    );
    expect(otherAssignment.errors).toBeUndefined();
  });

  it("blocks errors and returns warnings while saving", async () => {
    const overlap = await run(
      `mutation ($organizationId: String!, $scheduleId: String!, $employeeId: String!, $shiftTemplateId: String!, $date: DateTime!) {
        assignShift(organizationId: $organizationId, scheduleId: $scheduleId, employeeId: $employeeId, shiftTemplateId: $shiftTemplateId, date: $date, startTime: "10:00", endTime: "12:00") { assignment { id } }
      }`,
      { organizationId, scheduleId, employeeId, shiftTemplateId: templateId, date: "2026-09-21T00:00:00.000Z" },
    );
    expect(firstError(overlap)).toMatch(/Assignment blocked/i);

    await prisma.employee.update({ where: { id: employeeId }, data: { maxHoursPerWeek: 4 } });
    const warning = await run<{ assignShift: { assignment: { id: string }; violations: Array<{ code: string; level: string }> } }>(
      `mutation ($organizationId: String!, $scheduleId: String!, $employeeId: String!, $shiftTemplateId: String!, $date: DateTime!) {
        assignShift(organizationId: $organizationId, scheduleId: $scheduleId, employeeId: $employeeId, shiftTemplateId: $shiftTemplateId, date: $date) {
          assignment { id }
          violations { code level }
        }
      }`,
      { organizationId, scheduleId, employeeId, shiftTemplateId: templateId, date: "2026-09-23T00:00:00.000Z" },
    );
    expect(warning.errors).toBeUndefined();
    expect(warning.data!.assignShift.violations).toEqual([
      expect.objectContaining({ code: "OVERTIME", level: "WARNING" }),
    ]);
  });

  it("enforces employee and supervisor scheduling permissions", async () => {
    const employeeAssign = await run(
      `mutation ($organizationId: String!, $scheduleId: String!, $employeeId: String!, $shiftTemplateId: String!, $date: DateTime!) {
        assignShift(organizationId: $organizationId, scheduleId: $scheduleId, employeeId: $employeeId, shiftTemplateId: $shiftTemplateId, date: $date) { assignment { id } }
      }`,
      {
        organizationId,
        scheduleId,
        employeeId,
        shiftTemplateId: templateId,
        date: "2026-09-25T00:00:00.000Z",
      },
      employeeUserId,
    );
    expect(firstError(employeeAssign)).toMatch(/Only Owners, Managers/i);

    const employeePublish = await run(
      `mutation ($organizationId: String!, $id: String!) {
        publishSchedule(organizationId: $organizationId, id: $id) { id }
      }`,
      { organizationId, id: scheduleId },
      employeeUserId,
    );
    expect(firstError(employeePublish)).toMatch(/Insufficient permissions/i);

    const supervisorAssign = await run(
      `mutation ($organizationId: String!, $scheduleId: String!, $employeeId: String!, $shiftTemplateId: String!, $date: DateTime!) {
        assignShift(organizationId: $organizationId, scheduleId: $scheduleId, employeeId: $employeeId, shiftTemplateId: $shiftTemplateId, date: $date) { assignment { id } }
      }`,
      {
        organizationId,
        scheduleId,
        employeeId,
        shiftTemplateId: templateId,
        date: "2026-09-26T00:00:00.000Z",
      },
      supervisorUserId,
    );
    expect(supervisorAssign.errors).toBeUndefined();

    const crossDepartment = await run(
      `mutation ($organizationId: String!, $scheduleId: String!, $employeeId: String!, $shiftTemplateId: String!, $date: DateTime!) {
        assignShift(organizationId: $organizationId, scheduleId: $scheduleId, employeeId: $employeeId, shiftTemplateId: $shiftTemplateId, date: $date) { assignment { id } }
      }`,
      {
        organizationId,
        scheduleId,
        employeeId: otherEmployeeId,
        shiftTemplateId: templateId,
        date: "2026-09-27T00:00:00.000Z",
      },
      supervisorUserId,
    );
    expect(firstError(crossDepartment)).toMatch(/own department/i);
  });

  it("reports coverage, validates without writing, and publishes a version", async () => {
    const requirement = await run(
      `mutation ($organizationId: String!, $scheduleId: String!, $date: DateTime!, $shiftTemplateId: String!, $roleId: String!) {
        setShiftRequirement(organizationId: $organizationId, scheduleId: $scheduleId, date: $date, shiftTemplateId: $shiftTemplateId, roleId: $roleId, requiredCount: 2) { id requiredCount }
      }`,
      { organizationId, scheduleId, date: "2026-09-21T00:00:00.000Z", shiftTemplateId: templateId, roleId },
    );
    expect(requirement.errors).toBeUndefined();
    const coverage = await run<{ scheduleCoverage: Array<{ requiredCount: number; assignedCount: number }> }>(
      `query ($organizationId: String!, $scheduleId: String!) {
        scheduleCoverage(organizationId: $organizationId, scheduleId: $scheduleId) { requiredCount assignedCount }
      }`,
      { organizationId, scheduleId },
    );
    expect(coverage.data!.scheduleCoverage).toEqual([{ requiredCount: 2, assignedCount: 1 }]);

    const deletedRequirement = await run<{
      setShiftRequirement: { id: string } | null;
    }>(
      `mutation ($organizationId: String!, $scheduleId: String!, $date: DateTime!, $shiftTemplateId: String!, $roleId: String!) {
        setShiftRequirement(organizationId: $organizationId, scheduleId: $scheduleId, date: $date, shiftTemplateId: $shiftTemplateId, roleId: $roleId, requiredCount: 0) { id }
      }`,
      { organizationId, scheduleId, date: "2026-09-21T00:00:00.000Z", shiftTemplateId: templateId, roleId },
    );
    expect(deletedRequirement.errors).toBeUndefined();
    expect(deletedRequirement.data?.setShiftRequirement).toBeNull();
    const restoredRequirement = await run(
      `mutation ($organizationId: String!, $scheduleId: String!, $date: DateTime!, $shiftTemplateId: String!, $roleId: String!) {
        setShiftRequirement(organizationId: $organizationId, scheduleId: $scheduleId, date: $date, shiftTemplateId: $shiftTemplateId, roleId: $roleId, requiredCount: 2) { id }
      }`,
      { organizationId, scheduleId, date: "2026-09-21T00:00:00.000Z", shiftTemplateId: templateId, roleId },
    );
    expect(restoredRequirement.errors).toBeUndefined();

    const validation = await run(
      `query ($organizationId: String!, $input: ValidateAssignmentInput!) {
        validateAssignment(organizationId: $organizationId, input: $input) { hasErrors hasWarnings violations { code } }
      }`,
      {
        organizationId,
        input: {
          scheduleId,
          employeeId,
          shiftTemplateId: templateId,
          date: "2026-09-24T00:00:00.000Z",
          startTime: "08:00",
          endTime: "16:00",
          breakMinutes: 0,
          roleId,
        },
      },
    );
    expect(validation.errors).toBeUndefined();
    expect(await prisma.shiftAssignment.count({ where: { scheduleId } })).toBe(4);

    const published = await run<{ publishSchedule: { status: string; version: number; publishedAt: string } }>(
      `mutation ($organizationId: String!, $id: String!) {
        publishSchedule(organizationId: $organizationId, id: $id) { status version publishedAt }
      }`,
      { organizationId, id: scheduleId },
    );
    expect(published.errors).toBeUndefined();
    expect(published.data!.publishSchedule.status).toBe("PUBLISHED");
    expect(published.data!.publishSchedule.version).toBe(1);
    expect(await prisma.scheduleVersion.count({ where: { scheduleId } })).toBe(1);

    const reopened = await run<{ reopenSchedule: { status: string; version: number } }>(
      `mutation ($organizationId: String!, $id: String!) {
        reopenSchedule(organizationId: $organizationId, id: $id) { status version }
      }`,
      { organizationId, id: scheduleId },
    );
    expect(reopened.errors).toBeUndefined();
    expect(reopened.data?.reopenSchedule).toEqual({ status: "DRAFT", version: 1 });
    const republished = await run<{ publishSchedule: { status: string; version: number } }>(
      `mutation ($organizationId: String!, $id: String!) {
        publishSchedule(organizationId: $organizationId, id: $id) { status version }
      }`,
      { organizationId, id: scheduleId },
    );
    expect(republished.errors).toBeUndefined();
    expect(republished.data?.publishSchedule).toEqual({ status: "PUBLISHED", version: 2 });
    expect(await prisma.scheduleVersion.count({ where: { scheduleId } })).toBe(2);
  });

  it("filters employee schedule visibility and hides drafts", async () => {
    const draftSchedule = await prisma.schedule.create({
      data: { organizationId, weekStartDate: new Date("2026-09-28T00:00:00.000Z") },
    });
    const draft = await run<{ schedule: { id: string } | null }>(
      `query ($organizationId: String!, $weekStartDate: DateTime!) {
        schedule(organizationId: $organizationId, weekStartDate: $weekStartDate) { id }
      }`,
      { organizationId, weekStartDate: "2026-09-28T00:00:00.000Z" },
      employeeUserId,
    );
    expect(draft.errors).toBeUndefined();
    expect(draft.data?.schedule).toBeNull();
    await prisma.schedule.delete({ where: { id: draftSchedule.id } });

    const published = await run<{
      schedule: { assignments: Array<{ employeeId: string }> } | null;
    }>(
      `query ($organizationId: String!, $weekStartDate: DateTime!) {
        schedule(organizationId: $organizationId, weekStartDate: $weekStartDate) {
          assignments { employeeId }
        }
      }`,
      { organizationId, weekStartDate: "2026-09-21T00:00:00.000Z" },
      employeeUserId,
    );
    expect(published.errors).toBeUndefined();
    expect(published.data?.schedule?.assignments.length).toBeGreaterThan(0);
    expect(published.data?.schedule?.assignments.every(({ employeeId: id }) => id === employeeId)).toBe(true);
  });

  it("scopes schedules and writes to the organization", async () => {
    const otherOrganization = await prisma.organization.create({
      data: { name: `Other ${suffix}`, slug: `other-${suffix}` },
    });
    const otherOwner = await prisma.user.create({
      data: {
        email: `other-owner-${suffix}@example.test`,
        passwordHash: "hash",
        firstName: "Other",
        lastName: "Owner",
      },
    });
    await prisma.membership.create({
      data: { userId: otherOwner.id, organizationId: otherOrganization.id, role: MembershipRole.OWNER },
    });
    const byId = await run(
      `query ($organizationId: String!, $id: String!) {
        scheduleById(organizationId: $organizationId, id: $id) { id }
      }`,
      { organizationId, id: scheduleId },
      otherOwner.id,
    );
    expect(firstError(byId)).toMatch(/Not a member/i);

    const assign = await run(
      `mutation ($organizationId: String!, $scheduleId: String!, $employeeId: String!, $shiftTemplateId: String!, $date: DateTime!) {
        assignShift(organizationId: $organizationId, scheduleId: $scheduleId, employeeId: $employeeId, shiftTemplateId: $shiftTemplateId, date: $date) { assignment { id } }
      }`,
      {
        organizationId,
        scheduleId,
        employeeId,
        shiftTemplateId: templateId,
        date: "2026-09-29T00:00:00.000Z",
      },
      otherOwner.id,
    );
    expect(firstError(assign)).toMatch(/Not a member/i);

    await prisma.organization.delete({ where: { id: otherOrganization.id } });
    await prisma.user.delete({ where: { id: otherOwner.id } });
  });
});
