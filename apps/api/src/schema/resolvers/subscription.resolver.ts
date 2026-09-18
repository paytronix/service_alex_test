import { MembershipRole } from "@prisma/client";
import { toDateOnly, startOfWeek } from "@shiftflow/shared";
import type { ScheduleUpdatedPayload, ShiftAssignmentChangedPayload } from "@shiftflow/shared";
import { builder } from "../builder";
import {
  ScheduleUpdatedPayloadType,
  ShiftAssignmentChangedPayloadType,
} from "../types/advanced";
import type { GraphQLContext } from "../../middleware/auth";
import {
  assignmentTopic,
  filterAsyncIterable,
  pubsub,
  SCHEDULE_UPDATED,
  scheduleTopic,
  toAsyncIterable,
} from "../../utils/pubsub";

export { pubsub, SCHEDULE_UPDATED };

const MEMBER_ROLES: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.MANAGER,
  MembershipRole.SUPERVISOR,
  MembershipRole.EMPLOYEE,
];

async function requireMembership(ctx: GraphQLContext, organizationId: string): Promise<void> {
  if (!ctx.user) throw new Error("Not authenticated");
  const membership = await ctx.getMembership(organizationId);
  if (!membership || !MEMBER_ROLES.includes(membership.role)) {
    throw new Error("Not a member of this organization");
  }
}

builder.subscriptionField("scheduleUpdated", (t) =>
  t.field({
    type: ScheduleUpdatedPayloadType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string(),
      weekStartDate: t.arg({ type: "DateTime" }),
      locationId: t.arg.string(),
      calendarId: t.arg.string(),
    },
    subscribe: async (_root, args, ctx) => {
      await requireMembership(ctx, args.organizationId);
      const weekStart = args.weekStartDate ? toDateOnly(startOfWeek(args.weekStartDate)) : null;
      return filterAsyncIterable(
        toAsyncIterable(
          pubsub.asyncIterator<ScheduleUpdatedPayload>(scheduleTopic(args.organizationId)),
        ),
        (payload) =>
          (!args.scheduleId || payload.scheduleId === args.scheduleId) &&
          (!weekStart || payload.weekStartDate === weekStart) &&
          (!args.locationId || payload.locationId === args.locationId) &&
          (!args.calendarId || payload.calendarId === args.calendarId),
      );
    },
    resolve: (payload: ScheduleUpdatedPayload) => payload,
  }),
);

builder.subscriptionField("shiftAssignmentChanged", (t) =>
  t.field({
    type: ShiftAssignmentChangedPayloadType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string(),
      employeeId: t.arg.string(),
    },
    subscribe: async (_root, args, ctx) => {
      await requireMembership(ctx, args.organizationId);
      return filterAsyncIterable(
        toAsyncIterable(
          pubsub.asyncIterator<ShiftAssignmentChangedPayload>(
            assignmentTopic(args.organizationId),
          ),
        ),
        (payload) =>
          (!args.scheduleId || payload.scheduleId === args.scheduleId) &&
          (!args.employeeId || payload.employeeId === args.employeeId),
      );
    },
    resolve: (payload: ShiftAssignmentChangedPayload) => payload,
  }),
);
