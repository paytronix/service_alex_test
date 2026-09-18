import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { graphql, type ExecutionResult } from "graphql";
import {
  MembershipRole,
  NotificationChannel,
  NotificationType,
  ScheduleChangeType,
  ScheduleStatus,
} from "@prisma/client";
import { ScheduleChangeType as SharedScheduleChangeType } from "@shiftflow/shared";
import { schema } from "../src/schema";
import { prisma } from "../src/utils/prisma";
import { createLoaders } from "../src/utils/loaders";
import type { GraphQLContext } from "../src/middleware/auth";
import { scheduleHistoryService } from "../src/services/schedule-history.service";
import { EventBus } from "../src/events/event-bus";
import { registerNotificationSubscribers } from "../src/events/notification.subscriber";
import { NotificationService } from "../src/services/notification.service";
import { InAppChannel } from "../src/services/notification-channels";

const suffix = `history-${Date.now()}`;
let organizationId = "";
let ownerId = "";
let supervisorUserId = "";
let employeeUserId = "";
let employeeId = "";
let otherEmployeeId = "";
let scheduleId = "";
let templateId = "";

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
  userId: string,
): Promise<ExecutionResult<T>> {
  return (await graphql({
    schema,
    source,
    variableValues,
    contextValue: context(userId),
  })) as ExecutionResult<T>;
}

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: { name: `History ${suffix}`, slug: `history-${suffix}` },
  });
  organizationId = organization.id;

  const owner = await prisma.user.create({
    data: {
      email: `history-owner-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: "Mary",
      lastName: "Manager",
    },
  });
  ownerId = owner.id;
  const supervisor = await prisma.user.create({
    data: {
      email: `history-sup-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: "Sue",
      lastName: "Supervisor",
    },
  });
  supervisorUserId = supervisor.id;
  const employeeUser = await prisma.user.create({
    data: {
      email: `history-emp-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: "John",
      lastName: "Doe",
    },
  });
  employeeUserId = employeeUser.id;

  await prisma.membership.createMany({
    data: [
      { userId: ownerId, organizationId, role: MembershipRole.OWNER },
      { userId: supervisorUserId, organizationId, role: MembershipRole.SUPERVISOR },
      { userId: employeeUserId, organizationId, role: MembershipRole.EMPLOYEE },
    ],
  });

  const department = await prisma.department.create({
    data: { organizationId, name: `Dept ${suffix}` },
  });
  const template = await prisma.shiftTemplate.create({
    data: {
      organizationId,
      name: `Morning ${suffix}`,
      startTime: "09:00",
      endTime: "17:00",
    },
  });
  templateId = template.id;

  const john = await prisma.employee.create({
    data: {
      organizationId,
      userId: employeeUserId,
      firstName: "John",
      lastName: "Doe",
      email: employeeUser.email,
      departmentId: department.id,
      hireDate: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  employeeId = john.id;
  const mike = await prisma.employee.create({
    data: {
      organizationId,
      firstName: "Mike",
      lastName: "Smith",
      email: `mike-${suffix}@example.test`,
      departmentId: department.id,
      hireDate: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  otherEmployeeId = mike.id;

  const schedule = await prisma.schedule.create({
    data: {
      organizationId,
      weekStartDate: new Date("2026-03-02T00:00:00.000Z"),
      status: ScheduleStatus.PUBLISHED,
      version: 2,
    },
  });
  scheduleId = schedule.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { organizationId } });
  await prisma.shiftAssignmentHistory.deleteMany({ where: { organizationId } });
  await prisma.scheduleVersion.deleteMany({ where: { organizationId } });
});

describe("ScheduleHistoryService", () => {
  it("records a replacement and returns it with the actor", async () => {
    await scheduleHistoryService.record({
      organizationId,
      scheduleId,
      assignmentId: "assignment-1",
      changeType: ScheduleChangeType.REPLACED,
      date: new Date("2026-03-02T00:00:00.000Z"),
      previousEmployeeId: employeeId,
      newEmployeeId: otherEmployeeId,
      changedById: ownerId,
    });

    const history = await scheduleHistoryService.changeHistory(organizationId, scheduleId);
    expect(history).toHaveLength(1);
    expect(history[0].changeType).toBe(ScheduleChangeType.REPLACED);
    expect(history[0].previousEmployeeId).toBe(employeeId);
    expect(history[0].newEmployeeId).toBe(otherEmployeeId);
    expect(history[0].changedBy?.id).toBe(ownerId);
  });

  it("diffs two published snapshots", async () => {
    const base = {
      shiftTemplateId: templateId,
      roleId: null,
      startTime: "09:00",
      endTime: "17:00",
    };
    await prisma.scheduleVersion.create({
      data: {
        organizationId,
        scheduleId,
        version: 1,
        publishedAt: new Date("2026-03-01T10:00:00.000Z"),
        publishedById: ownerId,
        snapshot: [
          { id: "a1", employeeId, date: "2026-03-02", ...base },
          { id: "a2", employeeId: otherEmployeeId, date: "2026-03-03", ...base },
        ],
      },
    });
    await prisma.scheduleVersion.create({
      data: {
        organizationId,
        scheduleId,
        version: 2,
        publishedAt: new Date("2026-03-01T14:32:00.000Z"),
        publishedById: ownerId,
        snapshot: [
          { id: "a1", employeeId: otherEmployeeId, date: "2026-03-02", ...base },
          { id: "a3", employeeId, date: "2026-03-04", ...base },
        ],
      },
    });

    const diff = await scheduleHistoryService.diff(organizationId, scheduleId, 1, 2);
    expect(diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assignmentId: "a1",
          changeType: ScheduleChangeType.REPLACED,
          previousEmployeeId: employeeId,
          newEmployeeId: otherEmployeeId,
        }),
        expect.objectContaining({
          assignmentId: "a2",
          changeType: ScheduleChangeType.REMOVED,
        }),
        expect.objectContaining({
          assignmentId: "a3",
          changeType: ScheduleChangeType.CREATED,
        }),
      ]),
    );
  });

  it("lists versions with their publisher, newest first", async () => {
    const versions = await scheduleHistoryService.versions(organizationId, scheduleId);
    expect(versions.map((version) => version.version)).toEqual([2, 1]);
    expect(versions[0].publishedBy?.id).toBe(ownerId);
  });
});

describe("Schedule history GraphQL RBAC", () => {
  const HISTORY = `
    query History($organizationId: String!, $scheduleId: String!) {
      scheduleChangeHistory(organizationId: $organizationId, scheduleId: $scheduleId) {
        id
        changeType
      }
    }
  `;

  it("allows Owner and Supervisor", async () => {
    for (const userId of [ownerId, supervisorUserId]) {
      const result = await run<{ scheduleChangeHistory: unknown[] }>(
        HISTORY,
        { organizationId, scheduleId },
        userId,
      );
      expect(result.errors).toBeUndefined();
      expect(result.data?.scheduleChangeHistory.length).toBeGreaterThan(0);
    }
  });

  it("denies Employee", async () => {
    const result = await run(HISTORY, { organizationId, scheduleId }, employeeUserId);
    expect(result.errors?.[0]?.message).toBeTruthy();
  });

  it("returns the version diff for managers", async () => {
    const result = await run<{ scheduleVersionDiff: { changeType: string }[] }>(
      `query Diff($organizationId: String!, $scheduleId: String!) {
        scheduleVersionDiff(
          organizationId: $organizationId
          scheduleId: $scheduleId
          versionA: 1
          versionB: 2
        ) { assignmentId changeType }
      }`,
      { organizationId, scheduleId },
      ownerId,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.scheduleVersionDiff.length).toBe(3);
  });
});

describe("Domain events produce notifications", () => {
  function testBus() {
    const service = new NotificationService({
      senders: [new InAppChannel(() => undefined)],
      retryDelayMs: 0,
    });
    const bus = new EventBus();
    registerNotificationSubscribers(bus, service);
    return { bus, service };
  }

  it("notifies the affected employees when a schedule is published", async () => {
    const { bus, service } = testBus();
    bus.emit("schedule.published", {
      organizationId,
      actorId: ownerId,
      scheduleId,
      scheduleName: "2026-03-02",
      version: 2,
      startDate: "2026-03-02",
      endDate: "2026-03-08",
      employeeIds: [employeeId, otherEmployeeId],
    });
    await bus.drain();
    await service.drain();

    const notifications = await prisma.notification.findMany({
      where: {
        organizationId,
        type: NotificationType.SCHEDULE_PUBLISHED,
        channel: NotificationChannel.IN_APP,
      },
    });
    expect(notifications.map((item) => item.recipientId)).toEqual([employeeUserId]);
    expect(notifications[0].channel).toBe(NotificationChannel.IN_APP);
    expect(notifications[0].body).toContain("2026-03-02");
  });

  it("does not notify for shift changes in a draft schedule", async () => {
    const { bus, service } = testBus();
    bus.emit("shift.changed", {
      organizationId,
      actorId: ownerId,
      scheduleId,
      scheduleName: "2026-03-02",
      scheduleStatus: ScheduleStatus.DRAFT,
      scheduleVersion: 0,
      assignmentId: "assignment-draft",
      changeType: SharedScheduleChangeType.MOVED,
      date: "2026-03-05",
      startTime: "09:00",
      endTime: "17:00",
      employeeId,
      previousEmployeeId: null,
    });
    await bus.drain();
    await service.drain();

    const changed = await prisma.notification.count({
      where: { organizationId, type: NotificationType.SHIFT_CHANGED },
    });
    expect(changed).toBe(0);
  });

  it("notifies both employees when a published shift is reassigned", async () => {
    const { bus, service } = testBus();
    bus.emit("shift.changed", {
      organizationId,
      actorId: ownerId,
      scheduleId,
      scheduleName: "2026-03-02",
      scheduleStatus: ScheduleStatus.PUBLISHED,
      scheduleVersion: 2,
      assignmentId: "assignment-1",
      changeType: SharedScheduleChangeType.REPLACED,
      date: "2026-03-02",
      startTime: "09:00",
      endTime: "17:00",
      employeeId: otherEmployeeId,
      previousEmployeeId: employeeId,
    });
    await bus.drain();
    await service.drain();

    const changed = await prisma.notification.findMany({
      where: {
        organizationId,
        type: NotificationType.SHIFT_CHANGED,
        channel: NotificationChannel.IN_APP,
      },
    });
    // Mike has no user account, so only John receives the in-app notification.
    expect(changed.map((item) => item.recipientId)).toEqual([employeeUserId]);
  });
});
