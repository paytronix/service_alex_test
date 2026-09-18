import {
  ScheduleStatus,
  ShiftAssignmentStatus,
  type Schedule,
  type ShiftAssignment,
  type ShiftRequirement,
} from "@prisma/client";
import { MembershipRole } from "@prisma/client";
import {
  crossesMidnight,
  shiftDurationMinutes,
  ViolationCode,
  ViolationLevel,
} from "@shiftflow/shared";
import { builder } from "../builder";
import { EmployeeType } from "./employee";
import { RoleType, ShiftTemplateType } from "./catalog";

export const ScheduleStatusEnum = builder.enumType(ScheduleStatus, { name: "ScheduleStatus" });
export const ShiftAssignmentStatusEnum = builder.enumType(ShiftAssignmentStatus, {
  name: "ShiftAssignmentStatus",
});

export const ViolationLevelEnum = builder.enumType("ViolationLevel", {
  values: ["ERROR", "WARNING"] as const,
});
export const ViolationCodeEnum = builder.enumType("ViolationCode", {
  values: [
    "OVERLAP",
    "INSUFFICIENT_REST",
    "OVERTIME",
    "ON_LEAVE",
    "EMPLOYEE_INACTIVE",
    "ROLE_MISMATCH",
    "SKILL_MISMATCH",
    "UNAVAILABLE",
    "AVAILABLE_AFTER_CONFLICT",
    "MAX_CONSECUTIVE_SHIFTS",
  ] as const,
});

export const ShiftAssignmentType = builder.objectRef<ShiftAssignment>("ShiftAssignment");
export const ShiftRequirementType = builder.objectRef<ShiftRequirement>("ShiftRequirement");
export const ScheduleType = builder.objectRef<Schedule>("Schedule");
export const ShiftCoverageType = builder.objectRef<{
  date: Date;
  shiftTemplateId: string;
  roleId: string;
  requiredCount: number;
  assignedCount: number;
}>("ShiftCoverage");
export const ViolationType = builder.objectRef<{
  code: ViolationCode;
  level: ViolationLevel;
  message: string;
  meta?: unknown;
}>("Violation");
export const ValidationResultType = builder.objectRef<{
  violations: Array<{ code: ViolationCode; level: ViolationLevel; message: string; meta?: unknown }>;
  hasErrors: boolean;
  hasWarnings: boolean;
}>("ValidationResult");
export const ShiftMutationResultType = builder.objectRef<{
  assignment: ShiftAssignment;
  violations: Array<{ code: ViolationCode; level: ViolationLevel; message: string; meta?: unknown }>;
}>("ShiftMutationResult");

builder.objectType(ViolationType, {
  fields: (t) => ({
    code: t.field({ type: ViolationCodeEnum, resolve: (parent) => parent.code }),
    level: t.field({ type: ViolationLevelEnum, resolve: (parent) => parent.level }),
    message: t.exposeString("message"),
    meta: t.expose("meta", { type: "JSON", nullable: true }),
  }),
});

builder.objectType(ValidationResultType, {
  fields: (t) => ({
    violations: t.field({ type: [ViolationType], resolve: (parent) => parent.violations }),
    hasErrors: t.exposeBoolean("hasErrors"),
    hasWarnings: t.exposeBoolean("hasWarnings"),
  }),
});

builder.objectType(ShiftMutationResultType, {
  fields: (t) => ({
    assignment: t.field({ type: ShiftAssignmentType, resolve: (parent) => parent.assignment }),
    violations: t.field({ type: [ViolationType], resolve: (parent) => parent.violations }),
  }),
});

builder.objectType(ShiftCoverageType, {
  fields: (t) => ({
    date: t.expose("date", { type: "DateTime" }),
    shiftTemplateId: t.exposeString("shiftTemplateId"),
    roleId: t.exposeString("roleId"),
    requiredCount: t.exposeInt("requiredCount"),
    assignedCount: t.exposeInt("assignedCount"),
  }),
});

builder.objectType(ShiftRequirementType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    scheduleId: t.exposeString("scheduleId"),
    date: t.expose("date", { type: "DateTime" }),
    shiftTemplateId: t.exposeString("shiftTemplateId"),
    roleId: t.exposeString("roleId"),
    requiredCount: t.exposeInt("requiredCount"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

builder.objectType(ShiftAssignmentType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    scheduleId: t.exposeString("scheduleId"),
    organizationId: t.exposeString("organizationId"),
    employeeId: t.exposeString("employeeId"),
    shiftTemplateId: t.exposeString("shiftTemplateId"),
    roleId: t.exposeString("roleId", { nullable: true }),
    date: t.expose("date", { type: "DateTime" }),
    startTime: t.exposeString("startTime", { nullable: true }),
    endTime: t.exposeString("endTime", { nullable: true }),
    breakMinutes: t.exposeInt("breakMinutes"),
    status: t.field({ type: ShiftAssignmentStatusEnum, resolve: (parent) => parent.status }),
    notes: t.exposeString("notes", { nullable: true }),
    effectiveStartTime: t.string({
      resolve: async (parent, _args, ctx) => {
        if (parent.startTime) return parent.startTime;
        const template = await ctx.loaders.shiftTemplate.load(parent.shiftTemplateId);
        if (!template) throw new Error("Shift template not found");
        return template.startTime;
      },
    }),
    effectiveEndTime: t.string({
      resolve: async (parent, _args, ctx) => {
        if (parent.endTime) return parent.endTime;
        const template = await ctx.loaders.shiftTemplate.load(parent.shiftTemplateId);
        if (!template) throw new Error("Shift template not found");
        return template.endTime;
      },
    }),
    crossesMidnight: t.boolean({
      resolve: async (parent, _args, ctx) => {
        const template = await ctx.loaders.shiftTemplate.load(parent.shiftTemplateId);
        if (!template) throw new Error("Shift template not found");
        return crossesMidnight(parent.startTime ?? template.startTime, parent.endTime ?? template.endTime);
      },
    }),
    durationHours: t.float({
      resolve: async (parent, _args, ctx) => {
        const template = await ctx.loaders.shiftTemplate.load(parent.shiftTemplateId);
        if (!template) throw new Error("Shift template not found");
        return shiftDurationMinutes(
          parent.startTime ?? template.startTime,
          parent.endTime ?? template.endTime,
        ) / 60;
      },
    }),
    employee: t.field({
      type: EmployeeType,
      resolve: async (parent, _args, ctx) => {
        const employee = await ctx.loaders.employee.load(parent.employeeId);
        if (!employee) throw new Error("Employee not found");
        return employee;
      },
    }),
    shiftTemplate: t.field({
      type: ShiftTemplateType,
      resolve: async (parent, _args, ctx) => {
        const template = await ctx.loaders.shiftTemplate.load(parent.shiftTemplateId);
        if (!template) throw new Error("Shift template not found");
        return template;
      },
    }),
    role: t.field({
      type: RoleType,
      nullable: true,
      resolve: (parent, _args, ctx) =>
        parent.roleId === null ? null : ctx.loaders.role.load(parent.roleId),
    }),
  }),
});

builder.objectType(ScheduleType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    locationId: t.exposeString("locationId", { nullable: true }),
    calendarId: t.exposeString("calendarId", { nullable: true }),
    weekStartDate: t.expose("weekStartDate", { type: "DateTime" }),
    status: t.field({ type: ScheduleStatusEnum, resolve: (parent) => parent.status }),
    version: t.exposeInt("version"),
    publishedAt: t.expose("publishedAt", { type: "DateTime", nullable: true }),
    publishedById: t.exposeString("publishedById", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
    assignments: t.field({
      type: [ShiftAssignmentType],
      resolve: async (parent, _args, ctx) => {
        const schedule = parent as Schedule & { assignments?: ShiftAssignment[] };
        const assignments = schedule.assignments ?? await ctx.prisma.shiftAssignment.findMany({
          where: { scheduleId: parent.id, organizationId: parent.organizationId },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        });
        const membership = await ctx.getMembership(parent.organizationId);
        if (membership?.role !== MembershipRole.EMPLOYEE || !ctx.user) return assignments;
        const employee = await ctx.prisma.employee.findFirst({
          where: { organizationId: parent.organizationId, userId: ctx.user.userId },
          select: { id: true },
        });
        return employee ? assignments.filter((assignment) => assignment.employeeId === employee.id) : [];
      },
    }),
    requirements: t.field({
      type: [ShiftRequirementType],
      resolve: (parent, _args, ctx) => {
        const schedule = parent as Schedule & { requirements?: ShiftRequirement[] };
        return schedule.requirements ?? ctx.prisma.shiftRequirement.findMany({
          where: { scheduleId: parent.id, organizationId: parent.organizationId },
          orderBy: { date: "asc" },
        });
      },
    }),
  }),
});
