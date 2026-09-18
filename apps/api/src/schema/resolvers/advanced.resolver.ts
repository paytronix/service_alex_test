import { AttachmentEntityType, MembershipRole, ShiftSwapStatus } from "@prisma/client";
import { builder } from "../builder";
import {
  AttachmentEntityTypeEnum,
  AttachmentType,
  BulkResultType,
  CalendarType,
  GeneratedScheduleType,
  LocationType,
  RecurringShiftRuleType,
  ShiftCommentType,
  ShiftSwapRequestType,
  ShiftSwapStatusEnum,
  WeekTemplateType,
} from "../types/advanced";
import { GraphQLContext, requireManager, requireMember, requireRole } from "../../middleware/auth";
import { attachmentService } from "../../services/attachment.service";
import { bulkShiftService } from "../../services/bulk-shift.service";
import { calendarService } from "../../services/calendar.service";
import { locationService } from "../../services/location.service";
import { shiftCommentService } from "../../services/shift-comment.service";
import { shiftSwapService } from "../../services/shift-swap.service";
import { weekTemplateService } from "../../services/week-template.service";

function requireUser(ctx: GraphQLContext): string {
  if (!ctx.user) throw new Error("Not authenticated");
  return ctx.user.userId;
}

const requireSupervisor = requireRole(
  MembershipRole.OWNER,
  MembershipRole.MANAGER,
  MembershipRole.SUPERVISOR,
);

async function isManager(ctx: GraphQLContext, organizationId: string): Promise<boolean> {
  const membership = await ctx.getMembership(organizationId);
  return (
    membership?.role === MembershipRole.OWNER || membership?.role === MembershipRole.MANAGER
  );
}

/** Employees may act only on swaps that involve their own employee record. */
async function requireSwapParticipant(
  ctx: GraphQLContext,
  organizationId: string,
  employeeId: string,
): Promise<void> {
  if (await isManager(ctx, organizationId)) return;
  const userId = requireUser(ctx);
  const employee = await ctx.prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    select: { userId: true },
  });
  if (!employee || employee.userId !== userId) {
    throw new Error("You can only act on your own shift swap requests");
  }
}

// ─── Locations ───────────────────────────────────────────────

builder.queryField("locations", (t) =>
  t.field({
    type: [LocationType],
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return locationService.list(args.organizationId);
    },
  }),
);

builder.queryField("location", (t) =>
  t.field({
    type: LocationType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return locationService.getById(args.organizationId, args.id);
    },
  }),
);

builder.mutationField("createLocation", (t) =>
  t.field({
    type: LocationType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
      timezone: t.arg.string(),
      address: t.arg.string(),
      isDefault: t.arg.boolean(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return locationService.create(args.organizationId, userId, {
        name: args.name,
        timezone: args.timezone ?? undefined,
        address: args.address ?? null,
        isDefault: args.isDefault ?? undefined,
      });
    },
  }),
);

builder.mutationField("updateLocation", (t) =>
  t.field({
    type: LocationType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      name: t.arg.string(),
      timezone: t.arg.string(),
      address: t.arg.string(),
      isDefault: t.arg.boolean(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return locationService.update(args.organizationId, userId, args.id, {
        ...(args.name !== null && args.name !== undefined && { name: args.name }),
        ...(args.timezone !== null && args.timezone !== undefined && { timezone: args.timezone }),
        ...(args.address !== undefined && { address: args.address }),
        ...(args.isDefault !== null && args.isDefault !== undefined && { isDefault: args.isDefault }),
      });
    },
  }),
);

builder.mutationField("deleteLocation", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return locationService.delete(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Calendars ───────────────────────────────────────────────

builder.queryField("calendars", (t) =>
  t.field({
    type: [CalendarType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      locationId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return calendarService.list(args.organizationId, args.locationId ?? null);
    },
  }),
);

builder.queryField("calendar", (t) =>
  t.field({
    type: CalendarType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return calendarService.getById(args.organizationId, args.id);
    },
  }),
);

builder.mutationField("createCalendar", (t) =>
  t.field({
    type: CalendarType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
      locationId: t.arg.string(),
      color: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return calendarService.create(args.organizationId, userId, {
        name: args.name,
        locationId: args.locationId ?? null,
        color: args.color ?? null,
      });
    },
  }),
);

builder.mutationField("updateCalendar", (t) =>
  t.field({
    type: CalendarType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      name: t.arg.string(),
      locationId: t.arg.string(),
      color: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return calendarService.update(args.organizationId, userId, args.id, {
        ...(args.name !== null && args.name !== undefined && { name: args.name }),
        ...(args.locationId !== undefined && { locationId: args.locationId }),
        ...(args.color !== undefined && { color: args.color }),
      });
    },
  }),
);

builder.mutationField("deleteCalendar", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return calendarService.delete(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Week templates & recurring rules ────────────────────────

builder.queryField("weekTemplates", (t) =>
  t.field({
    type: [WeekTemplateType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      locationId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return weekTemplateService.list(args.organizationId, args.locationId ?? null);
    },
  }),
);

builder.queryField("weekTemplate", (t) =>
  t.field({
    type: WeekTemplateType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return weekTemplateService.getById(args.organizationId, args.id);
    },
  }),
);

builder.queryField("recurringShiftRules", (t) =>
  t.field({
    type: [RecurringShiftRuleType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      weekTemplateId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return weekTemplateService.listRules(
        args.organizationId,
        args.weekTemplateId ?? undefined,
      );
    },
  }),
);

builder.mutationField("createWeekTemplate", (t) =>
  t.field({
    type: WeekTemplateType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
      description: t.arg.string(),
      locationId: t.arg.string(),
      calendarId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return weekTemplateService.create(args.organizationId, userId, {
        name: args.name,
        description: args.description ?? null,
        locationId: args.locationId ?? null,
        calendarId: args.calendarId ?? null,
      });
    },
  }),
);

builder.mutationField("updateWeekTemplate", (t) =>
  t.field({
    type: WeekTemplateType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      name: t.arg.string(),
      description: t.arg.string(),
      locationId: t.arg.string(),
      calendarId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return weekTemplateService.update(args.organizationId, userId, args.id, {
        ...(args.name !== null && args.name !== undefined && { name: args.name }),
        ...(args.description !== undefined && { description: args.description }),
        ...(args.locationId !== undefined && { locationId: args.locationId }),
        ...(args.calendarId !== undefined && { calendarId: args.calendarId }),
      });
    },
  }),
);

builder.mutationField("deleteWeekTemplate", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return weekTemplateService.delete(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("createRecurringShiftRule", (t) =>
  t.field({
    type: RecurringShiftRuleType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      weekTemplateId: t.arg.string(),
      dayOfWeek: t.arg.int({ required: true }),
      shiftTemplateId: t.arg.string({ required: true }),
      roleId: t.arg.string(),
      employeeId: t.arg.string(),
      requiredCount: t.arg.int(),
      effectiveFrom: t.arg({ type: "DateTime" }),
      effectiveTo: t.arg({ type: "DateTime" }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return weekTemplateService.createRule(args.organizationId, userId, {
        weekTemplateId: args.weekTemplateId ?? null,
        dayOfWeek: args.dayOfWeek,
        shiftTemplateId: args.shiftTemplateId,
        roleId: args.roleId ?? null,
        employeeId: args.employeeId ?? null,
        requiredCount: args.requiredCount ?? 1,
        effectiveFrom: args.effectiveFrom ?? null,
        effectiveTo: args.effectiveTo ?? null,
      });
    },
  }),
);

builder.mutationField("updateRecurringShiftRule", (t) =>
  t.field({
    type: RecurringShiftRuleType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      dayOfWeek: t.arg.int(),
      shiftTemplateId: t.arg.string(),
      roleId: t.arg.string(),
      employeeId: t.arg.string(),
      requiredCount: t.arg.int(),
      effectiveFrom: t.arg({ type: "DateTime" }),
      effectiveTo: t.arg({ type: "DateTime" }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return weekTemplateService.updateRule(args.organizationId, userId, args.id, {
        ...(args.dayOfWeek !== null && args.dayOfWeek !== undefined && { dayOfWeek: args.dayOfWeek }),
        ...(args.shiftTemplateId !== null &&
          args.shiftTemplateId !== undefined && { shiftTemplateId: args.shiftTemplateId }),
        ...(args.roleId !== undefined && { roleId: args.roleId }),
        ...(args.employeeId !== undefined && { employeeId: args.employeeId }),
        ...(args.requiredCount !== null &&
          args.requiredCount !== undefined && { requiredCount: args.requiredCount }),
        ...(args.effectiveFrom !== undefined && { effectiveFrom: args.effectiveFrom }),
        ...(args.effectiveTo !== undefined && { effectiveTo: args.effectiveTo }),
      });
    },
  }),
);

builder.mutationField("deleteRecurringShiftRule", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return weekTemplateService.deleteRule(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("generateScheduleFromTemplate", (t) =>
  t.field({
    type: GeneratedScheduleType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      weekStartDate: t.arg({ type: "DateTime", required: true }),
      weekTemplateId: t.arg.string(),
      recurringRuleIds: t.arg.stringList(),
      locationId: t.arg.string(),
      calendarId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return weekTemplateService.generateSchedule(args.organizationId, userId, {
        weekStartDate: args.weekStartDate,
        weekTemplateId: args.weekTemplateId ?? null,
        recurringRuleIds: args.recurringRuleIds ?? null,
        locationId: args.locationId ?? null,
        calendarId: args.calendarId ?? null,
      });
    },
  }),
);

builder.mutationField("saveWeekAsTemplate", (t) =>
  t.field({
    type: WeekTemplateType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
      description: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return weekTemplateService.saveWeekAsTemplate(
        args.organizationId,
        userId,
        args.scheduleId,
        args.name,
        args.description ?? null,
      );
    },
  }),
);

// ─── Bulk operations ─────────────────────────────────────────

const BulkAssignInput = builder.inputType("BulkAssignShiftInput", {
  fields: (t) => ({
    scheduleId: t.string({ required: true }),
    employeeId: t.string({ required: true }),
    shiftTemplateId: t.string({ required: true }),
    date: t.field({ type: "DateTime", required: true }),
    roleId: t.string(),
    startTime: t.string(),
    endTime: t.string(),
    breakMinutes: t.int(),
    notes: t.string(),
    calendarId: t.string(),
  }),
});

const BulkCopyInput = builder.inputType("BulkCopyShiftInput", {
  fields: (t) => ({
    assignmentId: t.string({ required: true }),
    date: t.field({ type: "DateTime", required: true }),
    employeeId: t.string(),
  }),
});

const BulkMoveInput = builder.inputType("BulkMoveShiftInput", {
  fields: (t) => ({
    assignmentId: t.string({ required: true }),
    date: t.field({ type: "DateTime" }),
    employeeId: t.string(),
  }),
});

builder.mutationField("bulkAssignShifts", (t) =>
  t.field({
    type: BulkResultType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      items: t.arg({ type: [BulkAssignInput], required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return bulkShiftService.bulkAssign(
        args.organizationId,
        userId,
        args.items.map((item) => ({
          scheduleId: item.scheduleId,
          employeeId: item.employeeId,
          shiftTemplateId: item.shiftTemplateId,
          date: item.date,
          roleId: item.roleId ?? undefined,
          startTime: item.startTime ?? null,
          endTime: item.endTime ?? null,
          breakMinutes: item.breakMinutes ?? null,
          notes: item.notes ?? null,
          calendarId: item.calendarId ?? null,
        })),
      );
    },
  }),
);

builder.mutationField("bulkRemoveShifts", (t) =>
  t.field({
    type: BulkResultType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      assignmentIds: t.arg.stringList({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return bulkShiftService.bulkRemove(args.organizationId, userId, args.assignmentIds);
    },
  }),
);

builder.mutationField("bulkCopyShifts", (t) =>
  t.field({
    type: BulkResultType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      items: t.arg({ type: [BulkCopyInput], required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return bulkShiftService.bulkCopy(
        args.organizationId,
        userId,
        args.items.map((item) => ({
          assignmentId: item.assignmentId,
          date: item.date,
          employeeId: item.employeeId ?? null,
        })),
      );
    },
  }),
);

builder.mutationField("bulkMoveShifts", (t) =>
  t.field({
    type: BulkResultType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      items: t.arg({ type: [BulkMoveInput], required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return bulkShiftService.bulkMove(
        args.organizationId,
        userId,
        args.items.map((item) => ({
          assignmentId: item.assignmentId,
          date: item.date ?? null,
          employeeId: item.employeeId ?? null,
        })),
      );
    },
  }),
);

// ─── Shift swaps ─────────────────────────────────────────────

builder.queryField("shiftSwapRequests", (t) =>
  t.field({
    type: [ShiftSwapRequestType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      status: t.arg({ type: ShiftSwapStatusEnum }),
      employeeId: t.arg.string(),
      skip: t.arg.int(),
      take: t.arg.int(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      let employeeId = args.employeeId ?? null;
      if (!(await isManager(ctx, args.organizationId))) {
        const self = await ctx.prisma.employee.findFirst({
          where: { organizationId: args.organizationId, userId },
          select: { id: true },
        });
        if (!self) return [];
        employeeId = self.id;
      }
      return shiftSwapService.list(args.organizationId, {
        status: (args.status as ShiftSwapStatus | null) ?? null,
        employeeId,
        skip: args.skip ?? null,
        take: args.take ?? null,
      });
    },
  }),
);

builder.mutationField("createShiftSwapRequest", (t) =>
  t.field({
    type: ShiftSwapRequestType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      assignmentId: t.arg.string({ required: true }),
      targetEmployeeId: t.arg.string({ required: true }),
      message: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      const assignment = await ctx.prisma.shiftAssignment.findFirst({
        where: { id: args.assignmentId, organizationId: args.organizationId },
        select: { employeeId: true },
      });
      if (!assignment) throw new Error("Shift assignment not found");
      await requireSwapParticipant(ctx, args.organizationId, assignment.employeeId);
      return shiftSwapService.create(args.organizationId, userId, {
        assignmentId: args.assignmentId,
        targetEmployeeId: args.targetEmployeeId,
        message: args.message ?? null,
      });
    },
  }),
);

builder.mutationField("acceptShiftSwap", (t) =>
  t.field({
    type: ShiftSwapRequestType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      const swap = await shiftSwapService.getById(args.organizationId, args.id);
      await requireSwapParticipant(ctx, args.organizationId, swap.targetEmployeeId);
      return shiftSwapService.accept(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("approveShiftSwap", (t) =>
  t.field({
    type: ShiftSwapRequestType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return shiftSwapService.approve(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("rejectShiftSwap", (t) =>
  t.field({
    type: ShiftSwapRequestType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireManager(ctx, args.organizationId);
      return shiftSwapService.reject(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("cancelShiftSwap", (t) =>
  t.field({
    type: ShiftSwapRequestType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      const swap = await shiftSwapService.getById(args.organizationId, args.id);
      await requireSwapParticipant(ctx, args.organizationId, swap.requestedById);
      return shiftSwapService.cancel(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Comments ────────────────────────────────────────────────

builder.queryField("shiftComments", (t) =>
  t.field({
    type: [ShiftCommentType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      assignmentId: t.arg.string(),
      scheduleId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return shiftCommentService.list(args.organizationId, {
        assignmentId: args.assignmentId ?? null,
        scheduleId: args.scheduleId ?? null,
      });
    },
  }),
);

builder.mutationField("createShiftComment", (t) =>
  t.field({
    type: ShiftCommentType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      text: t.arg.string({ required: true }),
      assignmentId: t.arg.string(),
      scheduleId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return shiftCommentService.create(args.organizationId, userId, {
        text: args.text,
        assignmentId: args.assignmentId ?? null,
        scheduleId: args.scheduleId ?? null,
      });
    },
  }),
);

builder.mutationField("updateShiftComment", (t) =>
  t.field({
    type: ShiftCommentType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      text: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return shiftCommentService.update(args.organizationId, userId, args.id, args.text);
    },
  }),
);

builder.mutationField("deleteShiftComment", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      const canModerate = await isManager(ctx, args.organizationId);
      return shiftCommentService.delete(args.organizationId, userId, args.id, canModerate);
    },
  }),
);

// ─── Attachments ─────────────────────────────────────────────

builder.queryField("attachments", (t) =>
  t.field({
    type: [AttachmentType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      entityType: t.arg({ type: AttachmentEntityTypeEnum, required: true }),
      entityId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireMember(ctx, args.organizationId);
      return attachmentService.list(
        args.organizationId,
        args.entityType as AttachmentEntityType,
        args.entityId,
      );
    },
  }),
);

builder.mutationField("deleteAttachment", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireSupervisor(ctx, args.organizationId);
      return attachmentService.delete(args.organizationId, userId, args.id);
    },
  }),
);
