import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "../utils/prisma";
import { notificationTopic, pubsub } from "../utils/pubsub";
import {
  EmailChannel,
  InAppChannel,
  NotificationChannelSender,
  OutgoingNotification,
} from "./notification-channels";

export interface NotifyInput {
  organizationId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload?: Prisma.InputJsonValue;
  /** Recipients given as users. */
  recipientUserIds?: string[];
  /** Recipients given as employees; resolved to their linked user accounts. */
  employeeIds?: string[];
  /** Explicit channels; defaults to the organization notification settings. */
  channels?: NotificationChannel[];
  /** Do not notify the user who performed the action. */
  excludeUserIds?: string[];
}

export interface NotificationFilter {
  read?: boolean;
  type?: NotificationType;
  skip?: number;
  take?: number;
}

export interface NotificationServiceOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
  senders?: NotificationChannelSender[];
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

export class NotificationService {
  private readonly senders: Map<NotificationChannel, NotificationChannelSender>;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(options: NotificationServiceOptions = {}) {
    const senders = options.senders ?? [
      new InAppChannel((notification) => {
        pubsub.publish(
          notificationTopic(notification.organizationId, notification.recipientId),
          notification.id,
        );
      }),
      new EmailChannel(),
    ];
    this.senders = new Map(senders.map((sender) => [sender.channel, sender]));
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  /** Creates the notification rows and dispatches them in the background. */
  async notify(input: NotifyInput): Promise<Notification[]> {
    const recipients = await this.resolveRecipients(input);
    if (recipients.length === 0) return [];

    const channels = await this.resolveChannels(input);
    if (channels.length === 0) return [];

    const created: Notification[] = [];
    for (const recipient of recipients) {
      for (const channel of channels) {
        if (channel === NotificationChannel.EMAIL && !recipient.email) continue;
        created.push(
          await prisma.notification.create({
            data: {
              organizationId: input.organizationId,
              recipientId: recipient.id,
              type: input.type,
              channel,
              status: NotificationStatus.PENDING,
              title: input.title,
              body: input.body,
              ...(input.payload !== undefined && { payload: input.payload }),
            },
          }),
        );
      }
    }

    for (const notification of created) {
      const recipient = recipients.find((item) => item.id === notification.recipientId);
      this.track(this.deliver(notification, recipient?.email ?? null));
    }

    return created;
  }

  private track(promise: Promise<void>): void {
    const task = promise
      .catch((error) => {
        console.error("[notifications] delivery failed", error);
      })
      .then(() => {
        this.inFlight.delete(task);
      });
    this.inFlight.add(task);
  }

  /** Waits for background deliveries; used by tests and graceful shutdown. */
  async drain(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.all([...this.inFlight]);
    }
  }

  async deliver(notification: Notification, recipientEmail: string | null): Promise<void> {
    const sender = this.senders.get(notification.channel);
    if (!sender) return;

    const email =
      recipientEmail ??
      (await prisma.user.findUnique({
        where: { id: notification.recipientId },
        select: { email: true },
      }))?.email ??
      null;

    const outgoing: OutgoingNotification = {
      id: notification.id,
      organizationId: notification.organizationId,
      recipientId: notification.recipientId,
      recipientEmail: email,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      payload: notification.payload,
    };

    let attempts = notification.attempts;
    let lastError = "";
    while (attempts < this.maxAttempts) {
      attempts += 1;
      try {
        await sender.send(outgoing);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.SENT, sentAt: new Date(), attempts, lastError: null },
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempts < this.maxAttempts) await delay(this.retryDelayMs);
      }
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: NotificationStatus.FAILED, attempts, lastError },
    });
  }

  /** Re-attempts delivery of notifications left in FAILED state. */
  async retryFailed(organizationId: string, limit = 50): Promise<number> {
    const failed = await prisma.notification.findMany({
      where: { organizationId, status: NotificationStatus.FAILED },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    for (const notification of failed) {
      await this.deliver({ ...notification, attempts: 0 }, null);
    }
    return failed.length;
  }

  async list(organizationId: string, recipientId: string, filter: NotificationFilter = {}) {
    return prisma.notification.findMany({
      where: this.listWhere(organizationId, recipientId, filter),
      orderBy: { createdAt: "desc" },
      skip: filter.skip ?? 0,
      take: Math.min(filter.take ?? 20, 100),
    });
  }

  async count(organizationId: string, recipientId: string, filter: NotificationFilter = {}) {
    return prisma.notification.count({ where: this.listWhere(organizationId, recipientId, filter) });
  }

  async unreadCount(organizationId: string, recipientId: string): Promise<number> {
    return prisma.notification.count({
      where: { organizationId, recipientId, readAt: null },
    });
  }

  async markRead(organizationId: string, recipientId: string, id: string): Promise<Notification> {
    const notification = await prisma.notification.findFirst({
      where: { id, organizationId, recipientId },
    });
    if (!notification) throw new Error("Notification not found");
    if (notification.readAt) return notification;
    return prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
  }

  async markAllRead(organizationId: string, recipientId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { organizationId, recipientId, readAt: null },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
    return result.count;
  }

  private listWhere(
    organizationId: string,
    recipientId: string,
    filter: NotificationFilter,
  ): Prisma.NotificationWhereInput {
    return {
      organizationId,
      recipientId,
      ...(filter.type && { type: filter.type }),
      ...(filter.read === true && { readAt: { not: null } }),
      ...(filter.read === false && { readAt: null }),
    };
  }

  private async resolveRecipients(
    input: NotifyInput,
  ): Promise<Array<{ id: string; email: string | null }>> {
    const userIds = new Set(input.recipientUserIds ?? []);

    if (input.employeeIds?.length) {
      const employees = await prisma.employee.findMany({
        where: { organizationId: input.organizationId, id: { in: input.employeeIds } },
        select: { userId: true },
      });
      for (const employee of employees) {
        if (employee.userId) userIds.add(employee.userId);
      }
    }

    for (const excluded of input.excludeUserIds ?? []) userIds.delete(excluded);
    if (userIds.size === 0) return [];

    // Only members of the organization may receive its notifications.
    const memberships = await prisma.membership.findMany({
      where: { organizationId: input.organizationId, userId: { in: [...userIds] } },
      select: { user: { select: { id: true, email: true } } },
    });
    return memberships.map((membership) => ({
      id: membership.user.id,
      email: membership.user.email,
    }));
  }

  private async resolveChannels(input: NotifyInput): Promise<NotificationChannel[]> {
    if (input.channels) return input.channels;
    const organization = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { notifyInApp: true, notifyByEmail: true },
    });
    const channels: NotificationChannel[] = [];
    if (organization?.notifyInApp !== false) channels.push(NotificationChannel.IN_APP);
    if (organization?.notifyByEmail) channels.push(NotificationChannel.EMAIL);
    return channels;
  }
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const notificationService = new NotificationService();
