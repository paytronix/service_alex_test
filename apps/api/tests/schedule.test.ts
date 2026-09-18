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
let employeeId = "";
let roleId = "";
let templateId = "";
let scheduleId = "";

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
): Promise<ExecutionResult<T>> {
  return (await graphql({
    schema,
    source,
    variableValues,
    contextValue: context(ownerId),
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
  const role = await prisma.role.create({ data: { name: `Barista ${suffix}`, organizationId } });
  roleId = role.id;
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
      firstName: "Employee",
      lastName: "Test",
      email: `employee-${suffix}@example.test`,
      roleId,
      maxHoursPerWeek: 40,
    },
  });
  employeeId = employee.id;
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } });
  await prisma.user.delete({ where: { id: ownerId } });
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
    expect(await prisma.shiftAssignment.count({ where: { scheduleId } })).toBe(2);

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
  });
});
