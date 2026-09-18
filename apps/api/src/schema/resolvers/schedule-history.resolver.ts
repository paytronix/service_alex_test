import { MembershipRole } from "@prisma/client";
import { builder } from "../builder";
import {
  ScheduleVersionDiffEntryRef,
  ScheduleVersionRef,
  ShiftAssignmentHistoryRef,
} from "../types/schedule-history";
import { scheduleHistoryService } from "../../services/schedule-history.service";
import { requireRole, type GraphQLContext } from "../../middleware/auth";

/** Schedule history is management information: Supervisors may read it too. */
const requireHistoryAccess = (ctx: GraphQLContext, organizationId: string) =>
  requireRole(
    MembershipRole.OWNER,
    MembershipRole.MANAGER,
    MembershipRole.SUPERVISOR,
  )(ctx, organizationId);

builder.queryField("scheduleVersions", (t) =>
  t.field({
    type: [ScheduleVersionRef],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await requireHistoryAccess(ctx, args.organizationId);
      return scheduleHistoryService.versions(args.organizationId, args.scheduleId);
    },
  }),
);

builder.queryField("scheduleChangeHistory", (t) =>
  t.field({
    type: [ShiftAssignmentHistoryRef],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string({ required: true }),
      skip: t.arg.int({ required: false }),
      take: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      await requireHistoryAccess(ctx, args.organizationId);
      return scheduleHistoryService.changeHistory(
        args.organizationId,
        args.scheduleId,
        args.skip ?? 0,
        args.take ?? 50,
      );
    },
  }),
);

builder.queryField("scheduleVersionDiff", (t) =>
  t.field({
    type: [ScheduleVersionDiffEntryRef],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string({ required: true }),
      versionA: t.arg.int({ required: true }),
      versionB: t.arg.int({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await requireHistoryAccess(ctx, args.organizationId);
      return scheduleHistoryService.diff(
        args.organizationId,
        args.scheduleId,
        args.versionA,
        args.versionB,
      );
    },
  }),
);
