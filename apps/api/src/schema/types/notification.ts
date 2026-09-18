import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from "@prisma/client";
import { builder } from "../builder";

export const NotificationTypeEnum = builder.enumType(NotificationType, {
  name: "NotificationType",
});

export const NotificationChannelEnum = builder.enumType(NotificationChannel, {
  name: "NotificationChannel",
});

export const NotificationStatusEnum = builder.enumType(NotificationStatus, {
  name: "NotificationStatus",
});

export const NotificationRef = builder.objectRef<Notification>("Notification");

builder.objectType(NotificationRef, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    recipientId: t.exposeString("recipientId"),
    type: t.expose("type", { type: NotificationTypeEnum }),
    channel: t.expose("channel", { type: NotificationChannelEnum }),
    status: t.expose("status", { type: NotificationStatusEnum }),
    title: t.exposeString("title"),
    body: t.exposeString("body"),
    payload: t.expose("payload", { type: "JSON", nullable: true }),
    sentAt: t.expose("sentAt", { type: "DateTime", nullable: true }),
    readAt: t.expose("readAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});
