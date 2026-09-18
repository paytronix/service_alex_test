import { MembershipRole } from "@prisma/client";
import { builder } from "../builder";
import { NotificationRef, NotificationTypeEnum } from "../types/notification";
import { notificationService } from "../../services/notification.service";
import { requireMember } from "../../middleware/auth";
import { notificationTopic, pubsub, toAsyncIterable } from "../../utils/pubsub";
import { prisma } from "../../utils/prisma";

builder.queryField("notifications", (t) =>
  t.field({
    type: [NotificationRef],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      read: t.arg.boolean({ required: false }),
      type: t.arg({ type: NotificationTypeEnum, required: false }),
      skip: t.arg.int({ required: false }),
      take: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireMember(ctx, args.organizationId);
      return notificationService.list(args.organizationId, ctx.user.userId, {
        read: args.read ?? undefined,
        type: args.type ?? undefined,
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
      });
    },
  }),
);

builder.queryField("notificationsCount", (t) =>
  t.int({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      read: t.arg.boolean({ required: false }),
      type: t.arg({ type: NotificationTypeEnum, required: false }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireMember(ctx, args.organizationId);
      return notificationService.count(args.organizationId, ctx.user.userId, {
        read: args.read ?? undefined,
        type: args.type ?? undefined,
      });
    },
  }),
);

builder.queryField("unreadNotificationsCount", (t) =>
  t.int({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireMember(ctx, args.organizationId);
      return notificationService.unreadCount(args.organizationId, ctx.user.userId);
    },
  }),
);

builder.mutationField("markNotificationRead", (t) =>
  t.field({
    type: NotificationRef,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireMember(ctx, args.organizationId);
      return notificationService.markRead(args.organizationId, ctx.user.userId, args.id);
    },
  }),
);

builder.mutationField("markAllNotificationsRead", (t) =>
  t.int({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireMember(ctx, args.organizationId);
      return notificationService.markAllRead(args.organizationId, ctx.user.userId);
    },
  }),
);

builder.subscriptionField("notificationReceived", (t) =>
  t.field({
    type: NotificationRef,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
    },
    subscribe: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      const membership = await ctx.getMembership(args.organizationId);
      if (!membership || !ALLOWED_ROLES.includes(membership.role)) {
        throw new Error("Not a member of this organization");
      }
      return toAsyncIterable(
        pubsub.asyncIterator<string>(notificationTopic(args.organizationId, ctx.user.userId)),
      );
    },
    resolve: async (payload: string, _args, ctx) => {
      const notification = await prisma.notification.findFirst({
        where: { id: payload, recipientId: ctx.user?.userId },
      });
      if (!notification) throw new Error("Notification not found");
      return notification;
    },
  }),
);

const ALLOWED_ROLES: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.MANAGER,
  MembershipRole.SUPERVISOR,
  MembershipRole.EMPLOYEE,
];
