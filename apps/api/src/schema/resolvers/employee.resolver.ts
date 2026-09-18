import { MembershipRole } from "@prisma/client";
import { builder } from "../builder";
import {
  AvailabilityGraphType,
  AvailabilityTypeEnum,
  EmployeeSkillType,
  EmployeeStatusEnum,
  EmployeeType,
  LeaveRequestType,
  LeaveStatusEnum,
  LeaveTypeEnum,
} from "../types/employee";
import { EmployeeService } from "../../services/employee.service";
import { AvailabilityService } from "../../services/availability.service";
import { LeaveRequestService } from "../../services/leave-request.service";
import { GraphQLContext, requireManager, requireMember } from "../../middleware/auth";

const employeeService = new EmployeeService();
const availabilityService = new AvailabilityService();
const leaveRequestService = new LeaveRequestService();

function requireUser(ctx: GraphQLContext): string {
  if (!ctx.user) throw new Error("Not authenticated");
  return ctx.user.userId;
}

function isManagerRole(role: MembershipRole): boolean {
  return role === MembershipRole.OWNER || role === MembershipRole.MANAGER;
}

/**
 * Owners and Managers may act on any employee; everyone else only on the employee
 * record linked to their own user account.
 */
async function requireSelfOrManager(
  ctx: GraphQLContext,
  organizationId: string,
  employeeId: string,
  action: string,
): Promise<MembershipRole> {
  const userId = requireUser(ctx);
  const role = await requireMember(ctx, organizationId);
  if (isManagerRole(role)) return role;

  const employee = await employeeService.getById(organizationId, employeeId);
  if (employee.userId !== userId) {
    throw new Error(`Only Owners and Managers may ${action} for other employees`);
  }
  return role;
}

const AvailabilityEntryInput = builder.inputType("AvailabilityEntryInput", {
  fields: (t) => ({
    dayOfWeek: t.int({ required: true }),
    type: t.field({ type: AvailabilityTypeEnum, required: true }),
    availableFrom: t.string({ required: false }),
  }),
});

// ─── Employees ───────────────────────────────────────────────

builder.queryField("employees", (t) =>
  t.field({
    type: [EmployeeType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      departmentId: t.arg.string({ required: false }),
      roleId: t.arg.string({ required: false }),
      status: t.arg({ type: EmployeeStatusEnum, required: false }),
      search: t.arg.string({ required: false }),
      skip: t.arg.int({ required: false }),
      take: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return employeeService.list(args.organizationId, {
        departmentId: args.departmentId ?? undefined,
        roleId: args.roleId ?? undefined,
        status: args.status ?? undefined,
        search: args.search ?? undefined,
        skip: args.skip ?? undefined,
        take: args.take ?? undefined,
      });
    },
  }),
);

builder.queryField("employeeCount", (t) =>
  t.field({
    type: "Int",
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return employeeService.count(args.organizationId);
    },
  }),
);

builder.queryField("employee", (t) =>
  t.field({
    type: EmployeeType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return employeeService.getById(args.organizationId, args.id);
    },
  }),
);

builder.queryField("myEmployeeProfile", (t) =>
  t.field({
    type: EmployeeType,
    nullable: true,
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return employeeService.findByUser(args.organizationId, userId);
    },
  }),
);

builder.mutationField("createEmployee", (t) =>
  t.field({
    type: EmployeeType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      firstName: t.arg.string({ required: true }),
      lastName: t.arg.string({ required: true }),
      email: t.arg.string({ required: true }),
      phone: t.arg.string({ required: false }),
      photoUrl: t.arg.string({ required: false }),
      roleId: t.arg.string({ required: false }),
      departmentId: t.arg.string({ required: false }),
      userId: t.arg.string({ required: false }),
      hireDate: t.arg({ type: "DateTime", required: false }),
      status: t.arg({ type: EmployeeStatusEnum, required: false }),
      maxHoursPerWeek: t.arg.int({ required: false }),
      maxConsecutiveShifts: t.arg.int({ required: false }),
      minRestHours: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return employeeService.create(args.organizationId, userId, {
        firstName: args.firstName,
        lastName: args.lastName,
        email: args.email,
        phone: args.phone ?? undefined,
        photoUrl: args.photoUrl ?? undefined,
        roleId: args.roleId ?? null,
        departmentId: args.departmentId ?? null,
        userId: args.userId ?? null,
        hireDate: args.hireDate ?? null,
        status: args.status ?? undefined,
        maxHoursPerWeek: args.maxHoursPerWeek ?? null,
        maxConsecutiveShifts: args.maxConsecutiveShifts ?? null,
        minRestHours: args.minRestHours ?? null,
      });
    },
  }),
);

builder.mutationField("updateEmployee", (t) =>
  t.field({
    type: EmployeeType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      firstName: t.arg.string({ required: false }),
      lastName: t.arg.string({ required: false }),
      email: t.arg.string({ required: false }),
      phone: t.arg.string({ required: false }),
      photoUrl: t.arg.string({ required: false }),
      roleId: t.arg.string({ required: false }),
      departmentId: t.arg.string({ required: false }),
      userId: t.arg.string({ required: false }),
      hireDate: t.arg({ type: "DateTime", required: false }),
      status: t.arg({ type: EmployeeStatusEnum, required: false }),
      maxHoursPerWeek: t.arg.int({ required: false }),
      maxConsecutiveShifts: t.arg.int({ required: false }),
      minRestHours: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return employeeService.update(args.organizationId, userId, args.id, {
        ...(args.firstName !== null && args.firstName !== undefined && {
          firstName: args.firstName,
        }),
        ...(args.lastName !== null && args.lastName !== undefined && { lastName: args.lastName }),
        ...(args.email !== null && args.email !== undefined && { email: args.email }),
        ...(args.phone !== null && args.phone !== undefined && { phone: args.phone }),
        ...(args.photoUrl !== null && args.photoUrl !== undefined && { photoUrl: args.photoUrl }),
        ...(args.roleId !== undefined && { roleId: args.roleId }),
        ...(args.departmentId !== undefined && { departmentId: args.departmentId }),
        ...(args.userId !== undefined && { userId: args.userId }),
        ...(args.hireDate !== undefined && { hireDate: args.hireDate }),
        ...(args.status !== null && args.status !== undefined && { status: args.status }),
        ...(args.maxHoursPerWeek !== undefined && { maxHoursPerWeek: args.maxHoursPerWeek }),
        ...(args.maxConsecutiveShifts !== undefined && {
          maxConsecutiveShifts: args.maxConsecutiveShifts,
        }),
        ...(args.minRestHours !== undefined && { minRestHours: args.minRestHours }),
      });
    },
  }),
);

builder.mutationField("dismissEmployee", (t) =>
  t.field({
    type: EmployeeType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return employeeService.dismiss(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("deleteEmployee", (t) =>
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
      return employeeService.delete(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Employee skills ─────────────────────────────────────────

builder.mutationField("setEmployeeSkills", (t) =>
  t.field({
    type: [EmployeeSkillType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string({ required: true }),
      skillIds: t.arg.stringList({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return employeeService.setSkills(
        args.organizationId,
        userId,
        args.employeeId,
        args.skillIds,
      );
    },
  }),
);

builder.mutationField("assignSkillToEmployee", (t) =>
  t.field({
    type: EmployeeSkillType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string({ required: true }),
      skillId: t.arg.string({ required: true }),
      level: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return employeeService.assignSkill(
        args.organizationId,
        userId,
        args.employeeId,
        args.skillId,
        args.level ?? undefined,
      );
    },
  }),
);

builder.mutationField("removeSkillFromEmployee", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string({ required: true }),
      skillId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return employeeService.removeSkill(
        args.organizationId,
        userId,
        args.employeeId,
        args.skillId,
      );
    },
  }),
);

// ─── Availability ────────────────────────────────────────────

builder.queryField("employeeAvailability", (t) =>
  t.field({
    type: [AvailabilityGraphType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      await employeeService.getById(args.organizationId, args.employeeId);
      return availabilityService.list(args.employeeId);
    },
  }),
);

builder.mutationField("setAvailability", (t) =>
  t.field({
    type: [AvailabilityGraphType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string({ required: true }),
      entries: t.arg({ type: [AvailabilityEntryInput], required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireSelfOrManager(ctx, args.organizationId, args.employeeId, "set availability");
      await employeeService.getById(args.organizationId, args.employeeId);
      return availabilityService.set(
        args.organizationId,
        userId,
        args.employeeId,
        args.entries.map((entry) => ({
          dayOfWeek: entry.dayOfWeek,
          type: entry.type,
          availableFrom: entry.availableFrom ?? null,
        })),
      );
    },
  }),
);

// ─── Leave requests ──────────────────────────────────────────

builder.queryField("leaveRequests", (t) =>
  t.field({
    type: [LeaveRequestType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string({ required: false }),
      status: t.arg({ type: LeaveStatusEnum, required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const role = await requireMember(ctx, args.organizationId);

      // Employees only ever see their own requests.
      if (role === MembershipRole.EMPLOYEE) {
        const profile = await employeeService.findByUser(args.organizationId, userId);
        if (!profile) return [];
        return leaveRequestService.list(args.organizationId, {
          employeeId: profile.id,
          status: args.status ?? undefined,
        });
      }

      return leaveRequestService.list(args.organizationId, {
        employeeId: args.employeeId ?? undefined,
        status: args.status ?? undefined,
      });
    },
  }),
);

builder.queryField("leaveRequest", (t) =>
  t.field({
    type: LeaveRequestType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const role = await requireMember(ctx, args.organizationId);
      const leaveRequest = await leaveRequestService.getById(args.organizationId, args.id);

      if (role === MembershipRole.EMPLOYEE) {
        const profile = await employeeService.findByUser(args.organizationId, userId);
        if (!profile || profile.id !== leaveRequest.employeeId) {
          throw new Error("Leave request not found");
        }
      }

      return leaveRequest;
    },
  }),
);

builder.mutationField("createLeaveRequest", (t) =>
  t.field({
    type: LeaveRequestType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string({ required: true }),
      type: t.arg({ type: LeaveTypeEnum, required: true }),
      startDate: t.arg({ type: "DateTime", required: true }),
      endDate: t.arg({ type: "DateTime", required: true }),
      reason: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireSelfOrManager(
        ctx,
        args.organizationId,
        args.employeeId,
        "create leave requests",
      );
      await employeeService.getById(args.organizationId, args.employeeId);
      return leaveRequestService.create(args.organizationId, userId, {
        employeeId: args.employeeId,
        type: args.type,
        startDate: args.startDate,
        endDate: args.endDate,
        reason: args.reason ?? undefined,
      });
    },
  }),
);

builder.mutationField("approveLeaveRequest", (t) =>
  t.field({
    type: LeaveRequestType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return leaveRequestService.approve(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("rejectLeaveRequest", (t) =>
  t.field({
    type: LeaveRequestType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return leaveRequestService.reject(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("cancelLeaveRequest", (t) =>
  t.field({
    type: LeaveRequestType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const leaveRequest = await leaveRequestService.getById(args.organizationId, args.id);
      await requireSelfOrManager(
        ctx,
        args.organizationId,
        leaveRequest.employeeId,
        "cancel leave requests",
      );
      return leaveRequestService.cancel(args.organizationId, userId, args.id);
    },
  }),
);
