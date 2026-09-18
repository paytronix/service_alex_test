import { builder } from "../builder";
import { DepartmentType, RoleType, SkillType, ShiftTemplateType } from "../types/catalog";
import { DepartmentService } from "../../services/department.service";
import { RoleService } from "../../services/role.service";
import { SkillService } from "../../services/skill.service";
import { ShiftTemplateService } from "../../services/shift-template.service";
import { requireManager, requireMember, GraphQLContext } from "../../middleware/auth";

const departmentService = new DepartmentService();
const roleService = new RoleService();
const skillService = new SkillService();
const shiftTemplateService = new ShiftTemplateService();

function requireUser(ctx: GraphQLContext): string {
  if (!ctx.user) throw new Error("Not authenticated");
  return ctx.user.userId;
}

// ─── Departments ─────────────────────────────────────────────

builder.queryField("departments", (t) =>
  t.field({
    type: [DepartmentType],
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return departmentService.list(args.organizationId);
    },
  }),
);

builder.queryField("department", (t) =>
  t.field({
    type: DepartmentType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return departmentService.getById(args.organizationId, args.id);
    },
  }),
);

builder.mutationField("createDepartment", (t) =>
  t.field({
    type: DepartmentType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return departmentService.create(args.organizationId, userId, { name: args.name });
    },
  }),
);

builder.mutationField("updateDepartment", (t) =>
  t.field({
    type: DepartmentType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return departmentService.update(args.organizationId, userId, args.id, { name: args.name });
    },
  }),
);

builder.mutationField("deleteDepartment", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return departmentService.delete(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Roles ───────────────────────────────────────────────────

builder.queryField("roles", (t) =>
  t.field({
    type: [RoleType],
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return roleService.list(args.organizationId);
    },
  }),
);

builder.queryField("role", (t) =>
  t.field({
    type: RoleType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return roleService.getById(args.organizationId, args.id);
    },
  }),
);

builder.mutationField("createRole", (t) =>
  t.field({
    type: RoleType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
      color: t.arg.string({ required: false }),
      description: t.arg.string({ required: false }),
      maxLoad: t.arg.int({ required: false }),
      hourlyRate: t.arg.float({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return roleService.create(args.organizationId, userId, {
        name: args.name,
        color: args.color ?? undefined,
        description: args.description ?? undefined,
        maxLoad: args.maxLoad ?? undefined,
        hourlyRate: args.hourlyRate ?? undefined,
      });
    },
  }),
);

builder.mutationField("updateRole", (t) =>
  t.field({
    type: RoleType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      name: t.arg.string({ required: false }),
      color: t.arg.string({ required: false }),
      description: t.arg.string({ required: false }),
      maxLoad: t.arg.int({ required: false }),
      hourlyRate: t.arg.float({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return roleService.update(args.organizationId, userId, args.id, {
        name: args.name ?? undefined,
        color: args.color ?? undefined,
        description: args.description ?? undefined,
        maxLoad: args.maxLoad ?? undefined,
        hourlyRate: args.hourlyRate ?? undefined,
      });
    },
  }),
);

builder.mutationField("deleteRole", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return roleService.delete(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Skills ──────────────────────────────────────────────────

builder.queryField("skills", (t) =>
  t.field({
    type: [SkillType],
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return skillService.list(args.organizationId);
    },
  }),
);

builder.queryField("skill", (t) =>
  t.field({
    type: SkillType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return skillService.getById(args.organizationId, args.id);
    },
  }),
);

builder.mutationField("createSkill", (t) =>
  t.field({
    type: SkillType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return skillService.create(args.organizationId, userId, { name: args.name });
    },
  }),
);

builder.mutationField("updateSkill", (t) =>
  t.field({
    type: SkillType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return skillService.update(args.organizationId, userId, args.id, { name: args.name });
    },
  }),
);

builder.mutationField("deleteSkill", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return skillService.delete(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Shift Templates ─────────────────────────────────────────

builder.queryField("shiftTemplates", (t) =>
  t.field({
    type: [ShiftTemplateType],
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return shiftTemplateService.list(args.organizationId);
    },
  }),
);

builder.queryField("shiftTemplate", (t) =>
  t.field({
    type: ShiftTemplateType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return shiftTemplateService.getById(args.organizationId, args.id);
    },
  }),
);

builder.mutationField("createShiftTemplate", (t) =>
  t.field({
    type: ShiftTemplateType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
      startTime: t.arg.string({ required: true }),
      endTime: t.arg.string({ required: true }),
      roleId: t.arg.string({ required: false }),
      breakMinutes: t.arg.int({ required: false }),
      minEmployees: t.arg.int({ required: false }),
      maxEmployees: t.arg.int({ required: false }),
      color: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return shiftTemplateService.create(args.organizationId, userId, {
        name: args.name,
        startTime: args.startTime,
        endTime: args.endTime,
        roleId: args.roleId ?? undefined,
        breakMinutes: args.breakMinutes ?? undefined,
        minEmployees: args.minEmployees ?? undefined,
        maxEmployees: args.maxEmployees ?? undefined,
        color: args.color ?? undefined,
      });
    },
  }),
);

builder.mutationField("updateShiftTemplate", (t) =>
  t.field({
    type: ShiftTemplateType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      name: t.arg.string({ required: false }),
      startTime: t.arg.string({ required: false }),
      endTime: t.arg.string({ required: false }),
      roleId: t.arg.string({ required: false }),
      breakMinutes: t.arg.int({ required: false }),
      minEmployees: t.arg.int({ required: false }),
      maxEmployees: t.arg.int({ required: false }),
      color: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return shiftTemplateService.update(args.organizationId, userId, args.id, {
        name: args.name ?? undefined,
        startTime: args.startTime ?? undefined,
        endTime: args.endTime ?? undefined,
        roleId: args.roleId ?? undefined,
        breakMinutes: args.breakMinutes ?? undefined,
        minEmployees: args.minEmployees ?? undefined,
        maxEmployees: args.maxEmployees ?? undefined,
        color: args.color ?? undefined,
      });
    },
  }),
);

builder.mutationField("deleteShiftTemplate", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return shiftTemplateService.delete(args.organizationId, userId, args.id);
    },
  }),
);
