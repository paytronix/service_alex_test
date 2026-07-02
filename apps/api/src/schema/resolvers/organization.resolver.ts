import { MembershipRole } from "@prisma/client";
import { builder } from "../builder";
import {
  OrganizationType,
  MemberType,
  InvitationType,
  MembershipRoleEnum,
} from "../types/organization";
import { OrganizationService } from "../../services/organization.service";
import { AuditLogType } from "../types/audit";
import { AuditService } from "../../services/audit.service";
import { requireRole } from "../../middleware/auth";

const orgService = new OrganizationService();
const auditService = new AuditService();

builder.queryField("myOrganizations", (t) =>
  t.field({
    type: [OrganizationType],
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      return orgService.getUserOrganizations(ctx.user.userId);
    },
  }),
);

builder.queryField("organization", (t) =>
  t.field({
    type: OrganizationType,
    authScopes: { authenticated: true },
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireRole(
        MembershipRole.OWNER,
        MembershipRole.MANAGER,
        MembershipRole.SUPERVISOR,
        MembershipRole.EMPLOYEE,
      )(ctx, args.id);
      return orgService.getById(args.id);
    },
  }),
);

builder.queryField("organizationMembers", (t) =>
  t.field({
    type: [MemberType],
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireRole(
        MembershipRole.OWNER,
        MembershipRole.MANAGER,
        MembershipRole.SUPERVISOR,
        MembershipRole.EMPLOYEE,
      )(ctx, args.organizationId);
      return orgService.getMembers(args.organizationId);
    },
  }),
);

builder.queryField("auditLogs", (t) =>
  t.field({
    type: [AuditLogType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireRole(MembershipRole.OWNER, MembershipRole.MANAGER)(ctx, args.organizationId);
      return auditService.getByOrganization(args.organizationId, args.limit ?? 50);
    },
  }),
);

builder.mutationField("createOrganization", (t) =>
  t.field({
    type: OrganizationType,
    authScopes: { authenticated: true },
    args: {
      name: t.arg.string({ required: true }),
      timezone: t.arg.string({ required: false }),
      workingDays: t.arg.intList({ required: false }),
      shiftStartDefault: t.arg.string({ required: false }),
      shiftEndDefault: t.arg.string({ required: false }),
      minRestHours: t.arg.int({ required: false }),
      maxWeeklyHours: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      return orgService.create(ctx.user.userId, {
        name: args.name,
        timezone: args.timezone ?? undefined,
        workingDays: args.workingDays ?? undefined,
        shiftStartDefault: args.shiftStartDefault ?? undefined,
        shiftEndDefault: args.shiftEndDefault ?? undefined,
        minRestHours: args.minRestHours ?? undefined,
        maxWeeklyHours: args.maxWeeklyHours ?? undefined,
      });
    },
  }),
);

builder.mutationField("updateOrganization", (t) =>
  t.field({
    type: OrganizationType,
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
      name: t.arg.string({ required: false }),
      timezone: t.arg.string({ required: false }),
      workingDays: t.arg.intList({ required: false }),
      shiftStartDefault: t.arg.string({ required: false }),
      shiftEndDefault: t.arg.string({ required: false }),
      minRestHours: t.arg.int({ required: false }),
      maxWeeklyHours: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireRole(MembershipRole.OWNER, MembershipRole.MANAGER)(ctx, args.id);
      return orgService.update(args.id, {
        name: args.name ?? undefined,
        timezone: args.timezone ?? undefined,
        workingDays: args.workingDays ?? undefined,
        shiftStartDefault: args.shiftStartDefault ?? undefined,
        shiftEndDefault: args.shiftEndDefault ?? undefined,
        minRestHours: args.minRestHours ?? undefined,
        maxWeeklyHours: args.maxWeeklyHours ?? undefined,
      });
    },
  }),
);

builder.mutationField("inviteToOrganization", (t) =>
  t.field({
    type: InvitationType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      email: t.arg.string({ required: true }),
      role: t.arg({ type: MembershipRoleEnum, required: false }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireRole(MembershipRole.OWNER, MembershipRole.MANAGER)(ctx, args.organizationId);
      return orgService.invite(ctx.user.userId, {
        email: args.email,
        organizationId: args.organizationId,
        role: (args.role as MembershipRole) ?? undefined,
      });
    },
  }),
);

builder.mutationField("acceptInvitation", (t) =>
  t.field({
    type: InvitationType,
    authScopes: { authenticated: true },
    args: {
      token: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      return orgService.acceptInvitation(args.token, ctx.user.userId);
    },
  }),
);

builder.mutationField("updateMemberRole", (t) =>
  t.field({
    type: MemberType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      userId: t.arg.string({ required: true }),
      role: t.arg({ type: MembershipRoleEnum, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireRole(MembershipRole.OWNER)(ctx, args.organizationId);
      await orgService.updateMemberRole(
        args.organizationId,
        args.userId,
        args.role as MembershipRole,
      );
      const members = await orgService.getMembers(args.organizationId);
      return members.find((m) => m.userId === args.userId)!;
    },
  }),
);

builder.mutationField("removeMember", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      userId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) throw new Error("Not authenticated");
      await requireRole(MembershipRole.OWNER)(ctx, args.organizationId);
      if (args.userId === ctx.user.userId) {
        throw new Error("Cannot remove yourself");
      }
      await orgService.removeMember(args.organizationId, args.userId);
      return true;
    },
  }),
);
