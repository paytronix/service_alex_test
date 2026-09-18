import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { graphql, type ExecutionResult } from "graphql";
import { MembershipRole } from "@prisma/client";
import { schema } from "../src/schema";
import { prisma } from "../src/utils/prisma";
import { createLoaders } from "../src/utils/loaders";
import type { GraphQLContext } from "../src/middleware/auth";

const suffix = `advanced-${Date.now()}`;
const weekStartDate = "2026-10-05T00:00:00.000Z";
const monday = "2026-10-05T00:00:00.000Z";
const tuesday = "2026-10-06T00:00:00.000Z";

let organizationId = "";
let ownerId = "";
let requesterUserId = "";
let targetUserId = "";
let requesterEmployeeId = "";
let targetEmployeeId = "";
let roleId = "";
let shiftTemplateId = "";
let locationId = "";
let calendarId = "";

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

async function createUser(name: string, role: MembershipRole): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `${name}-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: name,
      lastName: "Test",
    },
  });
  await prisma.membership.create({ data: { userId: user.id, organizationId, role } });
  return user.id;
}

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: { name: `Advanced ${suffix}`, slug: `advanced-${suffix}` },
  });
  organizationId = organization.id;
  ownerId = await createUser("owner", MembershipRole.OWNER);
  requesterUserId = await createUser("requester", MembershipRole.EMPLOYEE);
  targetUserId = await createUser("target", MembershipRole.EMPLOYEE);

  const role = await prisma.role.create({ data: { name: `Cook ${suffix}`, organizationId } });
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
  shiftTemplateId = template.id;
  const requester = await prisma.employee.create({
    data: {
      organizationId,
      userId: requesterUserId,
      firstName: "Requester",
      lastName: "Test",
      email: `requester-${suffix}@example.test`,
      roleId,
    },
  });
  requesterEmployeeId = requester.id;
  const target = await prisma.employee.create({
    data: {
      organizationId,
      userId: targetUserId,
      firstName: "Target",
      lastName: "Test",
      email: `target-${suffix}@example.test`,
      roleId,
    },
  });
  targetEmployeeId = target.id;
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } });
  await prisma.user.deleteMany({
    where: { id: { in: [ownerId, requesterUserId, targetUserId] } },
  });
  await prisma.$disconnect();
});

describe("locations and calendars", () => {
  it("creates a location and calendar for managers only", async () => {
    const forbidden = await run(
      `mutation ($organizationId: String!, $name: String!) {
        createLocation(organizationId: $organizationId, name: $name) { id }
      }`,
      { organizationId, name: `Denied ${suffix}` },
      requesterUserId,
    );
    expect(forbidden.errors?.[0]?.message).toBeTruthy();

    const location = await run<{ createLocation: { id: string; isDefault: boolean } }>(
      `mutation ($organizationId: String!, $name: String!) {
        createLocation(organizationId: $organizationId, name: $name, isDefault: true) { id isDefault }
      }`,
      { organizationId, name: `Main ${suffix}` },
    );
    expect(location.errors).toBeUndefined();
    locationId = location.data!.createLocation.id;
    expect(location.data!.createLocation.isDefault).toBe(true);

    const calendar = await run<{ createCalendar: { id: string } }>(
      `mutation ($organizationId: String!, $name: String!, $locationId: String) {
        createCalendar(organizationId: $organizationId, name: $name, locationId: $locationId) { id }
      }`,
      { organizationId, name: `Hall ${suffix}`, locationId },
    );
    expect(calendar.errors).toBeUndefined();
    calendarId = calendar.data!.createCalendar.id;

    const calendars = await run<{ calendars: Array<{ id: string }> }>(
      `query ($organizationId: String!, $locationId: String) {
        calendars(organizationId: $organizationId, locationId: $locationId) { id }
      }`,
      { organizationId, locationId },
    );
    expect(calendars.data!.calendars.map((entry) => entry.id)).toContain(calendarId);
  });
});

describe("week templates", () => {
  it("generates a scoped draft schedule from recurring rules", async () => {
    const template = await run<{ createWeekTemplate: { id: string } }>(
      `mutation ($organizationId: String!, $name: String!, $locationId: String, $calendarId: String) {
        createWeekTemplate(organizationId: $organizationId, name: $name, locationId: $locationId, calendarId: $calendarId) { id }
      }`,
      { organizationId, name: `Summer ${suffix}`, locationId, calendarId },
    );
    expect(template.errors).toBeUndefined();
    const weekTemplateId = template.data!.createWeekTemplate.id;

    const rule = await run<{ createRecurringShiftRule: { id: string } }>(
      `mutation ($organizationId: String!, $weekTemplateId: String, $shiftTemplateId: String!, $roleId: String, $employeeId: String) {
        createRecurringShiftRule(
          organizationId: $organizationId
          weekTemplateId: $weekTemplateId
          dayOfWeek: 1
          shiftTemplateId: $shiftTemplateId
          roleId: $roleId
          employeeId: $employeeId
          requiredCount: 1
        ) { id }
      }`,
      { organizationId, weekTemplateId, shiftTemplateId, roleId, employeeId: requesterEmployeeId },
    );
    expect(rule.errors).toBeUndefined();

    const generated = await run<{
      generateScheduleFromTemplate: {
        schedule: { id: string; status: string };
        createdAssignmentIds: string[];
        createdRequirementIds: string[];
        skipped: Array<{ reason: string }>;
      };
    }>(
      `mutation ($organizationId: String!, $weekStartDate: DateTime!, $weekTemplateId: String, $locationId: String, $calendarId: String) {
        generateScheduleFromTemplate(
          organizationId: $organizationId
          weekStartDate: $weekStartDate
          weekTemplateId: $weekTemplateId
          locationId: $locationId
          calendarId: $calendarId
        ) {
          schedule { id status locationId calendarId }
          createdAssignmentIds
          createdRequirementIds
          skipped { reason }
          violations { code level }
        }
      }`,
      { organizationId, weekStartDate, weekTemplateId, locationId, calendarId },
    );
    expect(generated.errors).toBeUndefined();
    const result = generated.data!.generateScheduleFromTemplate;
    expect(result.schedule.status).toBe("DRAFT");
    expect(result.createdAssignmentIds).toHaveLength(1);
    expect(result.createdRequirementIds).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);

    const scoped = await run<{ schedule: { id: string } | null }>(
      `query ($organizationId: String!, $weekStartDate: DateTime!, $locationId: String, $calendarId: String) {
        schedule(organizationId: $organizationId, weekStartDate: $weekStartDate, locationId: $locationId, calendarId: $calendarId) { id }
      }`,
      { organizationId, weekStartDate, locationId, calendarId },
    );
    expect(scoped.data!.schedule?.id).toBe(result.schedule.id);
  });
});

describe("bulk operations", () => {
  it("copies and removes shifts with per-item results", async () => {
    const schedule = await prisma.schedule.findFirstOrThrow({
      where: { organizationId, locationId, calendarId },
    });
    const assignment = await prisma.shiftAssignment.findFirstOrThrow({
      where: { scheduleId: schedule.id },
    });

    const copied = await run<{
      bulkCopyShifts: {
        successCount: number;
        failureCount: number;
        results: Array<{ success: boolean; assignmentId: string | null; message: string | null }>;
      };
    }>(
      `mutation ($organizationId: String!, $items: [BulkCopyShiftInput!]!) {
        bulkCopyShifts(organizationId: $organizationId, items: $items) {
          successCount
          failureCount
          results { success assignmentId message }
        }
      }`,
      {
        organizationId,
        items: [
          { assignmentId: assignment.id, date: tuesday },
          { assignmentId: "missing-assignment", date: tuesday },
        ],
      },
    );
    expect(copied.errors).toBeUndefined();
    expect(copied.data!.bulkCopyShifts.successCount).toBe(1);
    expect(copied.data!.bulkCopyShifts.failureCount).toBe(1);
    const copiedId = copied.data!.bulkCopyShifts.results.find((entry) => entry.success)!.assignmentId!;

    const removed = await run<{ bulkRemoveShifts: { successCount: number } }>(
      `mutation ($organizationId: String!, $assignmentIds: [String!]!) {
        bulkRemoveShifts(organizationId: $organizationId, assignmentIds: $assignmentIds) { successCount failureCount }
      }`,
      { organizationId, assignmentIds: [copiedId] },
    );
    expect(removed.data!.bulkRemoveShifts.successCount).toBe(1);
    expect(await prisma.shiftAssignment.findUnique({ where: { id: copiedId } })).toBeNull();
  });

  it("rejects bulk edits for employees", async () => {
    const result = await run(
      `mutation ($organizationId: String!, $assignmentIds: [String!]!) {
        bulkRemoveShifts(organizationId: $organizationId, assignmentIds: $assignmentIds) { successCount }
      }`,
      { organizationId, assignmentIds: [] },
      requesterUserId,
    );
    expect(result.errors?.[0]?.message).toBeTruthy();
  });
});

describe("shift swaps", () => {
  it("reassigns the shift after accept and approve", async () => {
    const schedule = await prisma.schedule.findFirstOrThrow({
      where: { organizationId, locationId, calendarId },
    });
    const assignment = await prisma.shiftAssignment.create({
      data: {
        organizationId,
        scheduleId: schedule.id,
        employeeId: requesterEmployeeId,
        shiftTemplateId,
        roleId,
        date: new Date(monday),
        breakMinutes: 30,
      },
    });

    const created = await run<{ createShiftSwapRequest: { id: string; status: string } }>(
      `mutation ($organizationId: String!, $assignmentId: String!, $targetEmployeeId: String!) {
        createShiftSwapRequest(organizationId: $organizationId, assignmentId: $assignmentId, targetEmployeeId: $targetEmployeeId) { id status }
      }`,
      { organizationId, assignmentId: assignment.id, targetEmployeeId },
      requesterUserId,
    );
    expect(created.errors).toBeUndefined();
    const swapId = created.data!.createShiftSwapRequest.id;
    expect(created.data!.createShiftSwapRequest.status).toBe("PENDING");

    const earlyApproval = await run(
      `mutation ($organizationId: String!, $id: String!) {
        approveShiftSwap(organizationId: $organizationId, id: $id) { id }
      }`,
      { organizationId, id: swapId },
    );
    expect(earlyApproval.errors?.[0]?.message).toContain("accept");

    const wrongAccept = await run(
      `mutation ($organizationId: String!, $id: String!) {
        acceptShiftSwap(organizationId: $organizationId, id: $id) { id }
      }`,
      { organizationId, id: swapId },
      requesterUserId,
    );
    expect(wrongAccept.errors?.[0]?.message).toBeTruthy();

    const accepted = await run<{ acceptShiftSwap: { status: string } }>(
      `mutation ($organizationId: String!, $id: String!) {
        acceptShiftSwap(organizationId: $organizationId, id: $id) { status }
      }`,
      { organizationId, id: swapId },
      targetUserId,
    );
    expect(accepted.data!.acceptShiftSwap.status).toBe("ACCEPTED_BY_TARGET");

    const approved = await run<{ approveShiftSwap: { status: string } }>(
      `mutation ($organizationId: String!, $id: String!) {
        approveShiftSwap(organizationId: $organizationId, id: $id) { status }
      }`,
      { organizationId, id: swapId },
    );
    expect(approved.errors).toBeUndefined();
    expect(approved.data!.approveShiftSwap.status).toBe("APPROVED");

    const reassigned = await prisma.shiftAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    expect(reassigned.employeeId).toBe(targetEmployeeId);
    const history = await prisma.shiftAssignmentHistory.findFirst({
      where: { assignmentId: assignment.id },
      orderBy: { changedAt: "desc" },
    });
    expect(history?.newEmployeeId).toBe(targetEmployeeId);
  });
});

describe("shift comments", () => {
  it("lets any member comment and only the author or a manager delete", async () => {
    const schedule = await prisma.schedule.findFirstOrThrow({
      where: { organizationId, locationId, calendarId },
    });
    const comment = await run<{ createShiftComment: { id: string; text: string } }>(
      `mutation ($organizationId: String!, $scheduleId: String, $text: String!) {
        createShiftComment(organizationId: $organizationId, scheduleId: $scheduleId, text: $text) { id text }
      }`,
      { organizationId, scheduleId: schedule.id, text: "Banquet tonight" },
      requesterUserId,
    );
    expect(comment.errors).toBeUndefined();
    const commentId = comment.data!.createShiftComment.id;

    const otherEmployeeDelete = await run(
      `mutation ($organizationId: String!, $id: String!) {
        deleteShiftComment(organizationId: $organizationId, id: $id)
      }`,
      { organizationId, id: commentId },
      targetUserId,
    );
    expect(otherEmployeeDelete.errors?.[0]?.message).toBeTruthy();

    const managerDelete = await run<{ deleteShiftComment: boolean }>(
      `mutation ($organizationId: String!, $id: String!) {
        deleteShiftComment(organizationId: $organizationId, id: $id)
      }`,
      { organizationId, id: commentId },
    );
    expect(managerDelete.data!.deleteShiftComment).toBe(true);
  });
});
