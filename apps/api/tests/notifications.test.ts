import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { graphql, type ExecutionResult } from "graphql";
import {
  MembershipRole,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from "@prisma/client";
import { schema } from "../src/schema";
import { prisma } from "../src/utils/prisma";
import { createLoaders } from "../src/utils/loaders";
import type { GraphQLContext } from "../src/middleware/auth";
import { NotificationService } from "../src/services/notification.service";
import type {
  EmailMessage,
  EmailTransport,
  NotificationChannelSender,
  OutgoingNotification,
} from "../src/services/notification-channels";
import { EmailChannel, InAppChannel } from "../src/services/notification-channels";
import { auditService } from "../src/services/audit.service";

const suffix = `notify-${Date.now()}`;
let organizationId = "";
let otherOrganizationId = "";
let ownerId = "";
let employeeUserId = "";
let strangerUserId = "";
let employeeId = "";

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

class CollectingTransport implements EmailTransport {
  readonly sent: EmailMessage[] = [];
  async sendMail(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

class FailingChannel implements NotificationChannelSender {
  readonly channel = NotificationChannel.IN_APP;
  attempts = 0;
  async send(_notification: OutgoingNotification): Promise<void> {
    this.attempts += 1;
    throw new Error("transport down");
  }
}

beforeAll(async () => {
  const organization = await prisma.organization.create({
    data: { name: `Notify ${suffix}`, slug: `notify-${suffix}`, notifyByEmail: true },
  });
  organizationId = organization.id;
  const other = await prisma.organization.create({
    data: { name: `Notify other ${suffix}`, slug: `notify-other-${suffix}` },
  });
  otherOrganizationId = other.id;

  const owner = await prisma.user.create({
    data: {
      email: `notify-owner-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: "Olivia",
      lastName: "Owner",
    },
  });
  ownerId = owner.id;
  const employeeUser = await prisma.user.create({
    data: {
      email: `notify-emp-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: "Evan",
      lastName: "Employee",
    },
  });
  employeeUserId = employeeUser.id;
  const stranger = await prisma.user.create({
    data: {
      email: `notify-stranger-${suffix}@example.test`,
      passwordHash: "hash",
      firstName: "Sam",
      lastName: "Stranger",
    },
  });
  strangerUserId = stranger.id;

  await prisma.membership.createMany({
    data: [
      { userId: ownerId, organizationId, role: MembershipRole.OWNER },
      { userId: employeeUserId, organizationId, role: MembershipRole.EMPLOYEE },
      { userId: strangerUserId, organizationId: otherOrganizationId, role: MembershipRole.OWNER },
    ],
  });

  const department = await prisma.department.create({
    data: { organizationId, name: `Dept ${suffix}` },
  });
  const employee = await prisma.employee.create({
    data: {
      organizationId,
      userId: employeeUserId,
      firstName: "Evan",
      lastName: "Employee",
      email: employeeUser.email,
      departmentId: department.id,
      hireDate: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  employeeId = employee.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { organizationId } });
  await prisma.auditLog.deleteMany({ where: { organizationId } });
});

describe("NotificationService recipients and channels", () => {
  it("resolves employees to their user accounts and fans out per channel", async () => {
    const transport = new CollectingTransport();
    const published: OutgoingNotification[] = [];
    const service = new NotificationService({
      senders: [
        new InAppChannel((notification) => {
          published.push(notification);
        }),
        new EmailChannel(() => transport),
      ],
    });

    const created = await service.notify({
      organizationId,
      type: NotificationType.SHIFT_ASSIGNED,
      title: "New shift",
      body: "Monday 09:00",
      employeeIds: [employeeId],
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    });
    await service.drain();

    expect(created).toHaveLength(2);
    expect(created.every((item) => item.recipientId === employeeUserId)).toBe(true);
    expect(published).toHaveLength(1);
    expect(transport.sent[0].subject).toBe("New shift");

    const stored = await prisma.notification.findMany({
      where: { id: { in: created.map((item) => item.id) } },
    });
    expect(stored.every((item) => item.status === NotificationStatus.SENT)).toBe(true);
  });

  it("never notifies users outside the organization and honours excludes", async () => {
    const service = new NotificationService({ senders: [new InAppChannel(() => undefined)] });

    const created = await service.notify({
      organizationId,
      type: NotificationType.SCHEDULE_PUBLISHED,
      title: "Published",
      body: "Week published",
      recipientUserIds: [strangerUserId, ownerId, employeeUserId],
      excludeUserIds: [ownerId],
      channels: [NotificationChannel.IN_APP],
    });
    await service.drain();

    expect(created.map((item) => item.recipientId)).toEqual([employeeUserId]);
  });

  it("uses the organization notification settings when no channel is given", async () => {
    const service = new NotificationService({ senders: [new InAppChannel(() => undefined)] });
    const created = await service.notify({
      organizationId: otherOrganizationId,
      type: NotificationType.SHIFT_CHANGED,
      title: "Changed",
      body: "Shift changed",
      recipientUserIds: [strangerUserId],
    });
    await service.drain();

    // notifyByEmail defaults to false for the other organization
    expect(created.map((item) => item.channel)).toEqual([NotificationChannel.IN_APP]);
    await prisma.notification.deleteMany({ where: { organizationId: otherOrganizationId } });
  });
});

describe("NotificationService failure handling", () => {
  it("retries and marks the notification FAILED after exhausting attempts", async () => {
    const failing = new FailingChannel();
    const service = new NotificationService({
      senders: [failing],
      maxAttempts: 3,
      retryDelayMs: 0,
    });

    const [notification] = await service.notify({
      organizationId,
      type: NotificationType.SHIFT_CHANGED,
      title: "Shift changed",
      body: "Tuesday",
      recipientUserIds: [employeeUserId],
      channels: [NotificationChannel.IN_APP],
    });
    await service.drain();

    expect(failing.attempts).toBe(3);
    const stored = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(stored.status).toBe(NotificationStatus.FAILED);
    expect(stored.attempts).toBe(3);
    expect(stored.lastError).toContain("transport down");
  });

  it("retryFailed re-delivers previously failed notifications", async () => {
    const published: OutgoingNotification[] = [];
    const service = new NotificationService({
      senders: [
        new InAppChannel((notification) => {
          published.push(notification);
        }),
      ],
      retryDelayMs: 0,
    });

    const retried = await service.retryFailed(organizationId);
    expect(retried).toBeGreaterThan(0);
    expect(published.length).toBe(retried);
    const failed = await prisma.notification.count({
      where: { organizationId, status: NotificationStatus.FAILED },
    });
    expect(failed).toBe(0);
  });
});

describe("Notification GraphQL API", () => {
  const LIST = `
    query Notifications($organizationId: String!, $read: Boolean) {
      notifications(organizationId: $organizationId, read: $read) {
        id
        title
        readAt
      }
    }
  `;

  it("returns only the notifications of the current user", async () => {
    const ownerResult = await run<{ notifications: { id: string }[] }>(
      LIST,
      { organizationId },
      ownerId,
    );
    expect(ownerResult.errors).toBeUndefined();
    expect(ownerResult.data?.notifications).toHaveLength(0);

    const employeeResult = await run<{ notifications: { id: string }[] }>(
      LIST,
      { organizationId },
      employeeUserId,
    );
    expect(employeeResult.data?.notifications.length).toBeGreaterThan(0);
  });

  it("rejects access from a user of another organization", async () => {
    const result = await run(LIST, { organizationId }, strangerUserId);
    expect(result.errors?.[0]?.message).toBeTruthy();
  });

  it("marks a notification read and updates the unread count", async () => {
    const before = await run<{ unreadNotificationsCount: number }>(
      `query C($organizationId: String!) { unreadNotificationsCount(organizationId: $organizationId) }`,
      { organizationId },
      employeeUserId,
    );
    const unreadBefore = before.data?.unreadNotificationsCount ?? 0;
    expect(unreadBefore).toBeGreaterThan(0);

    const target = await prisma.notification.findFirstOrThrow({
      where: { organizationId, recipientId: employeeUserId, readAt: null },
    });
    const marked = await run<{ markNotificationRead: { readAt: string | null } }>(
      `mutation M($organizationId: String!, $id: String!) {
        markNotificationRead(organizationId: $organizationId, id: $id) { id readAt status }
      }`,
      { organizationId, id: target.id },
      employeeUserId,
    );
    expect(marked.errors).toBeUndefined();
    expect(marked.data?.markNotificationRead.readAt).toBeTruthy();

    const all = await run<{ markAllNotificationsRead: number }>(
      `mutation M($organizationId: String!) { markAllNotificationsRead(organizationId: $organizationId) }`,
      { organizationId },
      employeeUserId,
    );
    expect(all.errors).toBeUndefined();

    const after = await run<{ unreadNotificationsCount: number }>(
      `query C($organizationId: String!) { unreadNotificationsCount(organizationId: $organizationId) }`,
      { organizationId },
      employeeUserId,
    );
    expect(after.data?.unreadNotificationsCount).toBe(0);
  });

  it("does not allow marking somebody else's notification as read", async () => {
    const target = await prisma.notification.findFirstOrThrow({
      where: { organizationId, recipientId: employeeUserId },
    });
    const result = await run(
      `mutation M($organizationId: String!, $id: String!) {
        markNotificationRead(organizationId: $organizationId, id: $id) { id }
      }`,
      { organizationId, id: target.id },
      ownerId,
    );
    expect(result.errors?.[0]?.message).toContain("not found");
  });
});

describe("AuditService", () => {
  it("records entries and filters them by action, entity and actor", async () => {
    await auditService.record(
      { userId: ownerId, organizationId },
      "EMPLOYEE_CREATED",
      { type: "Employee", id: employeeId },
      { firstName: "Evan" },
    );
    await auditService.record(
      { userId: ownerId, organizationId },
      "SCHEDULE_PUBLISHED",
      { type: "Schedule", id: "schedule-x" },
    );

    const byAction = await auditService.list(organizationId, { action: "EMPLOYEE_CREATED" });
    expect(byAction).toHaveLength(1);
    expect(byAction[0].entityId).toBe(employeeId);
    expect(byAction[0].user?.id).toBe(ownerId);

    const byEntity = await auditService.count(organizationId, { entity: "Schedule" });
    expect(byEntity).toBe(1);

    const byActor = await auditService.count(organizationId, { actorId: employeeUserId });
    expect(byActor).toBe(0);
  });

  it("exposes auditLogs only to Owner/Manager", async () => {
    const AUDIT = `
      query Audit($organizationId: String!) {
        auditLogs(organizationId: $organizationId) { id action }
      }
    `;
    const owner = await run<{ auditLogs: { action: string }[] }>(
      AUDIT,
      { organizationId },
      ownerId,
    );
    expect(owner.errors).toBeUndefined();
    expect(owner.data?.auditLogs.length).toBeGreaterThan(0);

    const employee = await run(AUDIT, { organizationId }, employeeUserId);
    expect(employee.errors?.[0]?.message).toBeTruthy();
  });
});
