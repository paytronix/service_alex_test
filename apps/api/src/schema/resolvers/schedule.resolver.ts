import { MembershipRole } from "@prisma/client";
import { toDateOnly } from "@shiftflow/shared";
import { builder } from "../builder";
import {
  ScheduleStatusEnum,
  ScheduleType,
  ShiftCoverageType,
  ShiftMutationResultType,
  ShiftRequirementType,
  ValidationResultType,
} from "../types/schedule";
import { GraphQLContext, requireManager, requireMember } from "../../middleware/auth";
import { EmployeeService } from "../../services/employee.service";
import { ScheduleService } from "../../services/schedule.service";
import { ShiftAssignmentService } from "../../services/shift-assignment.service";
import { ShiftRequirementService } from "../../services/shift-requirement.service";
import { ScheduleValidationService } from "../../services/schedule-validation.service";
import { pubsub, SCHEDULE_UPDATED } from "./subscription.resolver";

const employeeService = new EmployeeService();
const scheduleService = new ScheduleService();
const assignmentService = new ShiftAssignmentService();
const requirementService = new ShiftRequirementService();
const validationService = new ScheduleValidationService();

function requireUser(ctx: GraphQLContext): string {
  if (!ctx.user) throw new Error("Not authenticated");
  return ctx.user.userId;
}

export async function requireSchedulingAccess(
  ctx: GraphQLContext,
  organizationId: string,
  employeeIds: string[],
): Promise<MembershipRole> {
  const role = await requireMember(ctx, organizationId);
  if (role === MembershipRole.OWNER || role === MembershipRole.MANAGER) return role;
  if (role !== MembershipRole.SUPERVISOR || !ctx.user) {
    throw new Error("Only Owners, Managers, or eligible Supervisors may schedule shifts");
  }
  const supervisor = await employeeService.findByUser(organizationId, ctx.user.userId);
  if (!supervisor?.departmentId) {
    throw new Error("Supervisors need an employee profile with a department to schedule shifts");
  }
  const employees = await ctx.prisma.employee.findMany({
    where: { organizationId, id: { in: employeeIds } },
    select: { id: true, departmentId: true },
  });
  if (
    employees.length !== new Set(employeeIds).size ||
    employees.some((employee) => employee.departmentId !== supervisor.departmentId)
  ) {
    throw new Error("Supervisors may schedule only employees in their own department");
  }
  return role;
}

const ValidateAssignmentInput = builder.inputType("ValidateAssignmentInput", {
  fields: (t) => ({
    scheduleId: t.string({ required: true }),
    employeeId: t.string({ required: true }),
    shiftTemplateId: t.string({ required: true }),
    date: t.field({ type: "DateTime", required: true }),
    startTime: t.string({ required: true }),
    endTime: t.string({ required: true }),
    breakMinutes: t.int({ required: true }),
    roleId: t.string({ required: false }),
  }),
});

builder.queryField("schedule", (t) =>
  t.field({
    type: ScheduleType,
    nullable: true,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      weekStartDate: t.arg({ type: "DateTime", required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const role = await requireMember(ctx, args.organizationId);
      return scheduleService.getByWeek(
        args.organizationId,
        args.weekStartDate,
        role !== MembershipRole.EMPLOYEE,
      );
    },
  }),
);

builder.queryField("scheduleById", (t) =>
  t.field({
    type: ScheduleType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const role = await requireMember(ctx, args.organizationId);
      const schedule = await scheduleService.getById(
        args.organizationId,
        args.id,
        role !== MembershipRole.EMPLOYEE,
      );
      if (!schedule) throw new Error("Schedule not found");
      return schedule;
    },
  }),
);

builder.queryField("schedules", (t) =>
  t.field({
    type: [ScheduleType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      status: t.arg({ type: ScheduleStatusEnum, required: false }),
      skip: t.arg.int({ required: false }),
      take: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const role = await requireMember(ctx, args.organizationId);
      return scheduleService.list(
        args.organizationId,
        args.status ?? undefined,
        args.skip ?? undefined,
        args.take ?? undefined,
        role !== MembershipRole.EMPLOYEE,
      );
    },
  }),
);

builder.queryField("shiftRequirements", (t) =>
  t.field({
    type: [ShiftRequirementType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await requireMember(ctx, args.organizationId);
      return requirementService.list(args.organizationId, args.scheduleId);
    },
  }),
);

builder.queryField("scheduleCoverage", (t) =>
  t.field({
    type: [ShiftCoverageType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await requireMember(ctx, args.organizationId);
      return requirementService.coverage(args.organizationId, args.scheduleId);
    },
  }),
);

builder.queryField("validateAssignment", (t) =>
  t.field({
    type: ValidationResultType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      input: t.arg({ type: ValidateAssignmentInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await requireMember(ctx, args.organizationId);
      return validationService.validate(args.organizationId, {
        ...args.input,
        date: toDateOnly(args.input.date),
        roleId: args.input.roleId ?? null,
        requiredSkillIds: [],
      });
    },
  }),
);

builder.mutationField("createDraftSchedule", (t) =>
  t.field({
    type: ScheduleType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      weekStartDate: t.arg({ type: "DateTime", required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return scheduleService.createDraft(args.organizationId, userId, args.weekStartDate);
    },
  }),
);

builder.mutationField("publishSchedule", (t) =>
  t.field({
    type: ScheduleType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      const schedule = await scheduleService.publish(args.organizationId, userId, args.id);
      await pubsub.publish(`${SCHEDULE_UPDATED}_${args.organizationId}`, args.organizationId);
      return schedule;
    },
  }),
);

builder.mutationField("assignShift", (t) =>
  t.field({
    type: ShiftMutationResultType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string({ required: true }),
      employeeId: t.arg.string({ required: true }),
      shiftTemplateId: t.arg.string({ required: true }),
      date: t.arg({ type: "DateTime", required: true }),
      roleId: t.arg.string({ required: false }),
      startTime: t.arg.string({ required: false }),
      endTime: t.arg.string({ required: false }),
      breakMinutes: t.arg.int({ required: false }),
      notes: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireSchedulingAccess(ctx, args.organizationId, [args.employeeId]);
      return assignmentService.assign(args.organizationId, userId, args);
    },
  }),
);

for (const field of ["moveShift", "updateShift"] as const) {
  builder.mutationField(field, (t) =>
    t.field({
        type: ShiftMutationResultType,
        authScopes: { authenticated: true },
      args: {
        organizationId: t.arg.string({ required: true }),
        id: t.arg.string({ required: true }),
        date: t.arg({ type: "DateTime", required: false }),
        employeeId: t.arg.string({ required: false }),
        shiftTemplateId: t.arg.string({ required: false }),
        roleId: t.arg.string({ required: false }),
        startTime: t.arg.string({ required: false }),
        endTime: t.arg.string({ required: false }),
        breakMinutes: t.arg.int({ required: false }),
        notes: t.arg.string({ required: false }),
      },
      resolve: async (_root, args, ctx) => {
        const userId = requireUser(ctx);
        const existing = await assignmentService.getById(args.organizationId, args.id);
        await requireSchedulingAccess(ctx, args.organizationId, [
          existing.employeeId,
          ...(args.employeeId ? [args.employeeId] : []),
        ]);
        const input = {
          date: args.date ?? undefined,
          employeeId: args.employeeId ?? undefined,
          shiftTemplateId: args.shiftTemplateId ?? undefined,
          roleId: args.roleId ?? undefined,
          startTime: args.startTime ?? undefined,
          endTime: args.endTime ?? undefined,
          breakMinutes: args.breakMinutes ?? undefined,
          notes: args.notes ?? undefined,
        };
        return field === "moveShift"
          ? assignmentService.move(args.organizationId, userId, args.id, input)
          : assignmentService.update(args.organizationId, userId, args.id, input);
      },
    }),
  );
}

builder.mutationField("copyShift", (t) =>
  t.field({
    type: ShiftMutationResultType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      date: t.arg({ type: "DateTime", required: true }),
      employeeId: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const existing = await assignmentService.getById(args.organizationId, args.id);
      await requireSchedulingAccess(ctx, args.organizationId, [
        existing.employeeId,
        args.employeeId ?? existing.employeeId,
      ]);
      return assignmentService.copy(args.organizationId, userId, args.id, args.date, args.employeeId ?? undefined);
    },
  }),
);

builder.mutationField("removeShift", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const existing = await assignmentService.getById(args.organizationId, args.id);
      await requireSchedulingAccess(ctx, args.organizationId, [existing.employeeId]);
      return assignmentService.remove(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("setShiftRequirement", (t) =>
  t.field({
    type: ShiftRequirementType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string({ required: true }),
      date: t.arg({ type: "DateTime", required: true }),
      shiftTemplateId: t.arg.string({ required: true }),
      roleId: t.arg.string({ required: true }),
      requiredCount: t.arg.int({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return requirementService.set(
        args.organizationId,
        userId,
        args.scheduleId,
        args.date,
        args.shiftTemplateId,
        args.roleId,
        args.requiredCount,
      );
    },
  }),
);

builder.mutationField("deleteShiftRequirement", (t) =>
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
      return requirementService.remove(args.organizationId, userId, args.id);
    },
  }),
);
