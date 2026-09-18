import {
  AttachmentEntityType,
  ShiftSwapStatus,
  type Attachment,
  type Calendar,
  type Location,
  type RecurringShiftRule,
  type Schedule,
  type ShiftComment,
  type ShiftRequirement,
  type ShiftSwapRequest,
  type WeekTemplate,
} from "@prisma/client";
import { BulkOperation, ScheduleUpdateKind } from "@shiftflow/shared";
import type {
  BulkItemResultDto,
  BulkResultDto,
  ScheduleUpdatedPayload,
  ShiftAssignmentChangedPayload,
  Violation,
} from "@shiftflow/shared";
import { builder } from "../builder";
import { EmployeeType } from "./employee";
import { ScheduleType, ShiftAssignmentType, ViolationType } from "./schedule";

export const ShiftSwapStatusEnum = builder.enumType(ShiftSwapStatus, { name: "ShiftSwapStatus" });
export const AttachmentEntityTypeEnum = builder.enumType(AttachmentEntityType, {
  name: "AttachmentEntityType",
});
export const BulkOperationEnum = builder.enumType(BulkOperation, { name: "BulkOperation" });
export const ScheduleUpdateKindEnum = builder.enumType(ScheduleUpdateKind, {
  name: "ScheduleUpdateKind",
});

// ─── Locations & calendars ───────────────────────────────────

export const LocationType = builder.objectRef<Location>("Location");

builder.objectType(LocationType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    name: t.exposeString("name"),
    timezone: t.exposeString("timezone"),
    address: t.exposeString("address", { nullable: true }),
    isDefault: t.exposeBoolean("isDefault"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

export const CalendarType = builder.objectRef<Calendar>("Calendar");

builder.objectType(CalendarType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    locationId: t.exposeString("locationId", { nullable: true }),
    name: t.exposeString("name"),
    color: t.exposeString("color", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// ─── Week templates & recurring rules ────────────────────────

export const RecurringShiftRuleType = builder.objectRef<RecurringShiftRule>("RecurringShiftRule");

builder.objectType(RecurringShiftRuleType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    weekTemplateId: t.exposeString("weekTemplateId", { nullable: true }),
    dayOfWeek: t.exposeInt("dayOfWeek"),
    shiftTemplateId: t.exposeString("shiftTemplateId"),
    roleId: t.exposeString("roleId", { nullable: true }),
    employeeId: t.exposeString("employeeId", { nullable: true }),
    requiredCount: t.exposeInt("requiredCount"),
    effectiveFrom: t.expose("effectiveFrom", { type: "DateTime", nullable: true }),
    effectiveTo: t.expose("effectiveTo", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    employee: t.field({
      type: EmployeeType,
      nullable: true,
      resolve: (parent, _args, ctx) =>
        parent.employeeId === null ? null : ctx.loaders.employee.load(parent.employeeId),
    }),
  }),
});

export const WeekTemplateType = builder.objectRef<WeekTemplate & { rules?: RecurringShiftRule[] }>(
  "WeekTemplate",
);

builder.objectType(WeekTemplateType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    locationId: t.exposeString("locationId", { nullable: true }),
    calendarId: t.exposeString("calendarId", { nullable: true }),
    name: t.exposeString("name"),
    description: t.exposeString("description", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
    rules: t.field({
      type: [RecurringShiftRuleType],
      resolve: (parent, _args, ctx) =>
        parent.rules ??
        ctx.prisma.recurringShiftRule.findMany({
          where: { weekTemplateId: parent.id, organizationId: parent.organizationId },
          orderBy: { dayOfWeek: "asc" },
        }),
    }),
  }),
});

export const GeneratedScheduleType = builder.objectRef<{
  schedule: Schedule & { assignments?: unknown; requirements?: ShiftRequirement[] };
  createdAssignmentIds: string[];
  createdRequirementIds: string[];
  skipped: Array<{ ruleId: string; date: string; reason: string }>;
  violations: Violation[];
}>("GeneratedSchedule");

export const SkippedRuleType = builder.objectRef<{ ruleId: string; date: string; reason: string }>(
  "SkippedRule",
);

builder.objectType(SkippedRuleType, {
  fields: (t) => ({
    ruleId: t.exposeString("ruleId"),
    date: t.exposeString("date"),
    reason: t.exposeString("reason"),
  }),
});

builder.objectType(GeneratedScheduleType, {
  fields: (t) => ({
    schedule: t.field({ type: ScheduleType, resolve: (parent) => parent.schedule as Schedule }),
    createdAssignmentIds: t.exposeStringList("createdAssignmentIds"),
    createdRequirementIds: t.exposeStringList("createdRequirementIds"),
    skipped: t.field({ type: [SkippedRuleType], resolve: (parent) => parent.skipped }),
    violations: t.field({ type: [ViolationType], resolve: (parent) => parent.violations }),
  }),
});

// ─── Bulk operations ─────────────────────────────────────────

export const BulkItemResultType = builder.objectRef<BulkItemResultDto>("BulkItemResult");

builder.objectType(BulkItemResultType, {
  fields: (t) => ({
    index: t.exposeInt("index"),
    success: t.exposeBoolean("success"),
    assignmentId: t.exposeString("assignmentId", { nullable: true }),
    message: t.exposeString("message", { nullable: true }),
    errors: t.field({ type: [ViolationType], resolve: (parent) => parent.errors }),
  }),
});

export const BulkResultType = builder.objectRef<BulkResultDto>("BulkResult");

builder.objectType(BulkResultType, {
  fields: (t) => ({
    operation: t.field({ type: BulkOperationEnum, resolve: (parent) => parent.operation }),
    successCount: t.exposeInt("successCount"),
    failureCount: t.exposeInt("failureCount"),
    results: t.field({ type: [BulkItemResultType], resolve: (parent) => parent.results }),
  }),
});

// ─── Shift swaps ─────────────────────────────────────────────

export const ShiftSwapRequestType = builder.objectRef<ShiftSwapRequest>("ShiftSwapRequest");

builder.objectType(ShiftSwapRequestType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    assignmentId: t.exposeString("assignmentId"),
    requestedById: t.exposeString("requestedById"),
    targetEmployeeId: t.exposeString("targetEmployeeId"),
    status: t.field({ type: ShiftSwapStatusEnum, resolve: (parent) => parent.status }),
    message: t.exposeString("message", { nullable: true }),
    reviewedById: t.exposeString("reviewedById", { nullable: true }),
    reviewedAt: t.expose("reviewedAt", { type: "DateTime", nullable: true }),
    respondedAt: t.expose("respondedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    assignment: t.field({
      type: ShiftAssignmentType,
      resolve: async (parent, _args, ctx) => {
        const assignment = await ctx.prisma.shiftAssignment.findFirst({
          where: { id: parent.assignmentId, organizationId: parent.organizationId },
        });
        if (!assignment) throw new Error("Shift assignment not found");
        return assignment;
      },
    }),
    requestedBy: t.field({
      type: EmployeeType,
      resolve: async (parent, _args, ctx) => {
        const employee = await ctx.loaders.employee.load(parent.requestedById);
        if (!employee) throw new Error("Employee not found");
        return employee;
      },
    }),
    targetEmployee: t.field({
      type: EmployeeType,
      resolve: async (parent, _args, ctx) => {
        const employee = await ctx.loaders.employee.load(parent.targetEmployeeId);
        if (!employee) throw new Error("Employee not found");
        return employee;
      },
    }),
  }),
});

// ─── Comments & attachments ──────────────────────────────────

export const ShiftCommentType = builder.objectRef<ShiftComment>("ShiftComment");

builder.objectType(ShiftCommentType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    assignmentId: t.exposeString("assignmentId", { nullable: true }),
    scheduleId: t.exposeString("scheduleId", { nullable: true }),
    authorId: t.exposeString("authorId"),
    text: t.exposeString("text"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
    authorName: t.string({
      resolve: async (parent, _args, ctx) => {
        const author = await ctx.prisma.user.findUnique({
          where: { id: parent.authorId },
          select: { firstName: true, lastName: true, email: true },
        });
        if (!author) return "Unknown";
        const name = [author.firstName, author.lastName].filter(Boolean).join(" ").trim();
        return name || author.email;
      },
    }),
  }),
});

export const AttachmentType = builder.objectRef<Attachment>("Attachment");

builder.objectType(AttachmentType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    entityType: t.field({ type: AttachmentEntityTypeEnum, resolve: (parent) => parent.entityType }),
    entityId: t.exposeString("entityId"),
    fileName: t.exposeString("fileName"),
    url: t.exposeString("url", { nullable: true }),
    mimeType: t.exposeString("mimeType"),
    size: t.exposeInt("size"),
    uploadedById: t.exposeString("uploadedById", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

// ─── Real-time payloads ──────────────────────────────────────

export const ScheduleUpdatedPayloadType =
  builder.objectRef<ScheduleUpdatedPayload>("ScheduleUpdatedPayload");

builder.objectType(ScheduleUpdatedPayloadType, {
  fields: (t) => ({
    organizationId: t.exposeString("organizationId"),
    scheduleId: t.exposeString("scheduleId"),
    weekStartDate: t.exposeString("weekStartDate"),
    locationId: t.exposeString("locationId", { nullable: true }),
    calendarId: t.exposeString("calendarId", { nullable: true }),
    kind: t.field({ type: ScheduleUpdateKindEnum, resolve: (parent) => parent.kind }),
    assignmentIds: t.exposeStringList("assignmentIds"),
    actorId: t.exposeString("actorId", { nullable: true }),
    version: t.exposeInt("version"),
    updatedAt: t.exposeString("updatedAt"),
  }),
});

export const ShiftAssignmentChangedPayloadType =
  builder.objectRef<ShiftAssignmentChangedPayload>("ShiftAssignmentChangedPayload");

builder.objectType(ShiftAssignmentChangedPayloadType, {
  fields: (t) => ({
    organizationId: t.exposeString("organizationId"),
    scheduleId: t.exposeString("scheduleId"),
    assignmentId: t.exposeString("assignmentId"),
    kind: t.field({ type: ScheduleUpdateKindEnum, resolve: (parent) => parent.kind }),
    employeeId: t.exposeString("employeeId", { nullable: true }),
    date: t.exposeString("date"),
    actorId: t.exposeString("actorId", { nullable: true }),
    updatedAt: t.exposeString("updatedAt"),
  }),
});
