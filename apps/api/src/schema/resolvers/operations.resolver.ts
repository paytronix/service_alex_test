import {
  CalendarFeedScope,
  CertificationStatus,
  ClaimStatus,
  IntegrationType,
  MembershipRole,
  OpenShiftStatus,
  SubscriptionPlan,
  TimeEntrySource,
  TimeEntryStatus,
} from "@prisma/client";
import { ExportFormat, LaborCostGroupBy, PlanFeature } from "@shiftflow/shared";
import { builder } from "../builder";
import { GraphQLContext, requireManager, requireMember, requireRole } from "../../middleware/auth";
import { billingService } from "../../services/billing.service";
import { calendarFeedService } from "../../services/calendar-feed.service";
import { certificationService } from "../../services/certification.service";
import { employeeDocumentService } from "../../services/employee-document.service";
import { integrationService } from "../../services/integration.service";
import { laborCostService } from "../../services/labor-cost.service";
import { openShiftService } from "../../services/open-shift.service";
import { timeEntryService } from "../../services/time-entry.service";
import { webhookService } from "../../services/webhook.service";
import { ExportFormatEnum } from "../types/report";
import {
  CalendarFeedScopeEnum,
  CalendarFeedTokenType,
  CertificationStatusEnum,
  CertificationType,
  CheckoutSessionType,
  ClaimStatusEnum,
  EmployeeDocumentGqlType,
  IntegrationConnectionType,
  IntegrationTypeEnum,
  InvoiceType,
  LaborCostGroupByEnum,
  LaborCostReportType,
  OpenShiftClaimType,
  OpenShiftStatusEnum,
  OpenShiftType,
  PayPeriodType,
  PayrollExportType,
  PayrollRowType,
  SubscriptionPlanEnum,
  SubscriptionType,
  TimeEntrySourceEnum,
  TimeEntryStatusEnum,
  TimeEntryType,
  TimesheetType,
  WebhookDeliveryType,
  WebhookSecretType,
  WebhookType,
} from "../types/operations";

const requireOwner = requireRole(MembershipRole.OWNER);
const requireOwnerOrManager = requireManager;

function requireUser(ctx: GraphQLContext): string {
  if (!ctx.user) throw new Error("Not authenticated");
  return ctx.user.userId;
}

async function isManager(ctx: GraphQLContext, organizationId: string): Promise<boolean> {
  const membership = await ctx.getMembership(organizationId);
  return membership?.role === MembershipRole.OWNER || membership?.role === MembershipRole.MANAGER;
}

/** The employee record linked to the current user, if any. */
async function ownEmployeeId(
  ctx: GraphQLContext,
  organizationId: string,
): Promise<string | null> {
  const userId = requireUser(ctx);
  const employee = await ctx.prisma.employee.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  return employee?.id ?? null;
}

/** Managers act on anyone; other members only on their own employee record. */
async function requireSelfOrManager(
  ctx: GraphQLContext,
  organizationId: string,
  employeeId: string,
): Promise<void> {
  await requireMember(ctx, organizationId);
  if (await isManager(ctx, organizationId)) return;
  if ((await ownEmployeeId(ctx, organizationId)) !== employeeId) {
    throw new Error("You can only access your own records");
  }
}

/** Non-managers are silently narrowed to their own employee record. */
async function scopedEmployeeId(
  ctx: GraphQLContext,
  organizationId: string,
  requested: string | null | undefined,
): Promise<string | null> {
  await requireMember(ctx, organizationId);
  if (await isManager(ctx, organizationId)) return requested ?? null;
  const own = await ownEmployeeId(ctx, organizationId);
  if (!own) throw new Error("No employee record linked to your account");
  if (requested && requested !== own) throw new Error("You can only access your own records");
  return own;
}

// ─── Time tracking ───────────────────────────────────────────

builder.queryField("timeEntries", (t) =>
  t.field({
    type: [TimeEntryType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string(),
      from: t.arg.string(),
      to: t.arg.string(),
      status: t.arg({ type: TimeEntryStatusEnum }),
      skip: t.arg.int(),
      take: t.arg.int(),
    },
    resolve: async (_root, args, ctx) => {
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      return timeEntryService.list(args.organizationId, {
        employeeId,
        from: args.from ?? null,
        to: args.to ?? null,
        status: (args.status as TimeEntryStatus | null) ?? null,
        skip: args.skip ?? null,
        take: args.take ?? null,
      });
    },
  }),
);

builder.queryField("openTimeEntry", (t) =>
  t.field({
    type: TimeEntryType,
    nullable: true,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      if (!employeeId) throw new Error("employeeId is required");
      return timeEntryService.openEntry(args.organizationId, employeeId);
    },
  }),
);

builder.queryField("timesheet", (t) =>
  t.field({
    type: TimesheetType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      from: t.arg.string({ required: true }),
      to: t.arg.string({ required: true }),
      employeeId: t.arg.string(),
      departmentId: t.arg.string(),
      locationId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      return timeEntryService.timesheet(args.organizationId, {
        from: args.from,
        to: args.to,
        employeeId,
        departmentId: args.departmentId ?? null,
        locationId: args.locationId ?? null,
      });
    },
  }),
);

builder.mutationField("clockIn", (t) =>
  t.field({
    type: TimeEntryType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string(),
      shiftAssignmentId: t.arg.string(),
      source: t.arg({ type: TimeEntrySourceEnum }),
      note: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      if (!employeeId) throw new Error("employeeId is required");
      await billingService.assertFeature(args.organizationId, PlanFeature.TIME_TRACKING);
      return timeEntryService.clockIn(args.organizationId, userId, {
        employeeId,
        shiftAssignmentId: args.shiftAssignmentId ?? null,
        source: (args.source as TimeEntrySource | null) ?? null,
        note: args.note ?? null,
      });
    },
  }),
);

builder.mutationField("clockOut", (t) =>
  t.field({
    type: TimeEntryType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string(),
      timeEntryId: t.arg.string(),
      note: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      if (!employeeId) throw new Error("employeeId is required");
      return timeEntryService.clockOut(args.organizationId, userId, {
        employeeId,
        timeEntryId: args.timeEntryId ?? null,
        note: args.note ?? null,
      });
    },
  }),
);

builder.mutationField("adjustTimeEntry", (t) =>
  t.field({
    type: TimeEntryType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      clockInAt: t.arg({ type: "DateTime" }),
      clockOutAt: t.arg({ type: "DateTime" }),
      shiftAssignmentId: t.arg.string(),
      note: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return timeEntryService.adjust(args.organizationId, userId, args.id, {
        clockInAt: args.clockInAt ?? null,
        clockOutAt: args.clockOutAt ?? null,
        shiftAssignmentId: args.shiftAssignmentId ?? null,
        note: args.note ?? null,
      });
    },
  }),
);

builder.mutationField("approveTimeEntry", (t) =>
  t.field({
    type: TimeEntryType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return timeEntryService.approve(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Labor cost, payroll & pay periods ───────────────────────

builder.queryField("laborCostReport", (t) =>
  t.field({
    type: LaborCostReportType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      from: t.arg.string({ required: true }),
      to: t.arg.string({ required: true }),
      groupBy: t.arg({ type: LaborCostGroupByEnum }),
      departmentId: t.arg.string(),
      locationId: t.arg.string(),
      roleId: t.arg.string(),
      employeeId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      // Employees may only see their own cost; managers and owners see everything.
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      await billingService.assertFeature(args.organizationId, PlanFeature.LABOR_COST);
      return laborCostService.report(
        args.organizationId,
        {
          from: args.from,
          to: args.to,
          employeeId,
          departmentId: args.departmentId ?? null,
          locationId: args.locationId ?? null,
          roleId: args.roleId ?? null,
        },
        (args.groupBy as LaborCostGroupBy | null) ?? LaborCostGroupBy.EMPLOYEE,
      );
    },
  }),
);

builder.queryField("payrollRows", (t) =>
  t.field({
    type: [PayrollRowType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      from: t.arg.string({ required: true }),
      to: t.arg.string({ required: true }),
      departmentId: t.arg.string(),
      locationId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireOwner(ctx, args.organizationId);
      return laborCostService.payrollRows(args.organizationId, {
        from: args.from,
        to: args.to,
        departmentId: args.departmentId ?? null,
        locationId: args.locationId ?? null,
      });
    },
  }),
);

builder.queryField("payPeriods", (t) =>
  t.field({
    type: [PayPeriodType],
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return laborCostService.listPayPeriods(args.organizationId);
    },
  }),
);

builder.mutationField("payrollExport", (t) =>
  t.field({
    type: PayrollExportType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      payPeriodId: t.arg.string(),
      from: t.arg.string(),
      to: t.arg.string(),
      format: t.arg({ type: ExportFormatEnum }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwner(ctx, args.organizationId);
      await billingService.assertFeature(args.organizationId, PlanFeature.PAYROLL_EXPORT);
      const result = await laborCostService.payrollExport(args.organizationId, userId, {
        payPeriodId: args.payPeriodId ?? null,
        from: args.from ?? null,
        to: args.to ?? null,
        format: (args.format as ExportFormat | null) ?? ExportFormat.CSV,
      });
      return {
        filename: result.filename,
        mimeType: result.mimeType,
        content: result.body.toString("base64"),
      };
    },
  }),
);

builder.mutationField("openPayPeriod", (t) =>
  t.field({
    type: PayPeriodType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      from: t.arg.string({ required: true }),
      to: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwner(ctx, args.organizationId);
      return laborCostService.openPayPeriod(args.organizationId, userId, {
        from: args.from,
        to: args.to,
      });
    },
  }),
);

builder.mutationField("lockPayPeriod", (t) =>
  t.field({
    type: PayPeriodType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwner(ctx, args.organizationId);
      return laborCostService.lockPayPeriod(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Open shifts ─────────────────────────────────────────────

builder.queryField("openShifts", (t) =>
  t.field({
    type: [OpenShiftType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string(),
      roleId: t.arg.string(),
      locationId: t.arg.string(),
      status: t.arg({ type: OpenShiftStatusEnum }),
      from: t.arg.string(),
      to: t.arg.string(),
      /** Employees see only shifts they may take; managers can opt in explicitly. */
      onlyEligible: t.arg.boolean(),
    },
    resolve: async (_root, args, ctx) => {
      await requireMember(ctx, args.organizationId);
      const manager = await isManager(ctx, args.organizationId);
      const eligibleForEmployeeId =
        !manager || args.onlyEligible ? await ownEmployeeId(ctx, args.organizationId) : null;
      if (!manager && !eligibleForEmployeeId) {
        throw new Error("No employee record linked to your account");
      }
      return openShiftService.list(args.organizationId, {
        scheduleId: args.scheduleId ?? null,
        roleId: args.roleId ?? null,
        locationId: args.locationId ?? null,
        status: (args.status as OpenShiftStatus | null) ?? null,
        from: args.from ?? null,
        to: args.to ?? null,
        eligibleForEmployeeId,
      });
    },
  }),
);

builder.queryField("openShiftClaims", (t) =>
  t.field({
    type: [OpenShiftClaimType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      openShiftId: t.arg.string(),
      employeeId: t.arg.string(),
      status: t.arg({ type: ClaimStatusEnum }),
    },
    resolve: async (_root, args, ctx) => {
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      return openShiftService.listClaims(args.organizationId, {
        openShiftId: args.openShiftId ?? null,
        employeeId,
        status: (args.status as ClaimStatus | null) ?? null,
      });
    },
  }),
);

builder.mutationField("publishOpenShift", (t) =>
  t.field({
    type: OpenShiftType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string({ required: true }),
      date: t.arg.string({ required: true }),
      shiftTemplateId: t.arg.string({ required: true }),
      roleId: t.arg.string({ required: true }),
      requiredCount: t.arg.int(),
      locationId: t.arg.string(),
      note: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      await billingService.assertFeature(args.organizationId, PlanFeature.OPEN_SHIFTS);
      return openShiftService.publish(args.organizationId, userId, {
        scheduleId: args.scheduleId,
        date: args.date,
        shiftTemplateId: args.shiftTemplateId,
        roleId: args.roleId,
        requiredCount: args.requiredCount ?? null,
        locationId: args.locationId ?? null,
        note: args.note ?? null,
      });
    },
  }),
);

builder.mutationField("generateOpenShifts", (t) =>
  t.field({
    type: [OpenShiftType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scheduleId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      await billingService.assertFeature(args.organizationId, PlanFeature.OPEN_SHIFTS);
      return openShiftService.generateFromRequirements(
        args.organizationId,
        userId,
        args.scheduleId,
      );
    },
  }),
);

builder.mutationField("cancelOpenShift", (t) =>
  t.field({
    type: OpenShiftType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return openShiftService.cancel(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("claimOpenShift", (t) =>
  t.field({
    type: OpenShiftClaimType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      openShiftId: t.arg.string({ required: true }),
      employeeId: t.arg.string(),
      message: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      if (!employeeId) throw new Error("employeeId is required");
      return openShiftService.claim(args.organizationId, userId, {
        openShiftId: args.openShiftId,
        employeeId,
        message: args.message ?? null,
      });
    },
  }),
);

builder.mutationField("withdrawOpenShiftClaim", (t) =>
  t.field({
    type: OpenShiftClaimType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const claim = await ctx.prisma.openShiftClaim.findFirst({
        where: { id: args.id, organizationId: args.organizationId },
        select: { employeeId: true },
      });
      if (!claim) throw new Error("Claim not found");
      await requireSelfOrManager(ctx, args.organizationId, claim.employeeId);
      return openShiftService.withdrawClaim(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("approveOpenShiftClaim", (t) =>
  t.field({
    type: OpenShiftClaimType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return openShiftService.approveClaim(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("rejectOpenShiftClaim", (t) =>
  t.field({
    type: OpenShiftClaimType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return openShiftService.rejectClaim(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Webhooks ────────────────────────────────────────────────

builder.queryField("webhooks", (t) =>
  t.field({
    type: [WebhookType],
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return webhookService.list(args.organizationId);
    },
  }),
);

builder.queryField("webhookDeliveries", (t) =>
  t.field({
    type: [WebhookDeliveryType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      webhookId: t.arg.string(),
      take: t.arg.int(),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return webhookService.deliveries(args.organizationId, {
        webhookId: args.webhookId ?? null,
        take: args.take ?? null,
      });
    },
  }),
);

builder.mutationField("createWebhook", (t) =>
  t.field({
    type: WebhookSecretType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      url: t.arg.string({ required: true }),
      events: t.arg.stringList({ required: true }),
      description: t.arg.string(),
      active: t.arg.boolean(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      await billingService.assertFeature(args.organizationId, PlanFeature.WEBHOOKS);
      return webhookService.create(args.organizationId, userId, {
        url: args.url,
        events: args.events,
        description: args.description ?? null,
        active: args.active ?? null,
      });
    },
  }),
);

builder.mutationField("updateWebhook", (t) =>
  t.field({
    type: WebhookType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      url: t.arg.string(),
      events: t.arg.stringList(),
      description: t.arg.string(),
      active: t.arg.boolean(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return webhookService.update(args.organizationId, userId, args.id, {
        ...(args.url !== null && args.url !== undefined ? { url: args.url } : {}),
        ...(args.events ? { events: args.events } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
        ...(args.active !== null && args.active !== undefined ? { active: args.active } : {}),
      });
    },
  }),
);

builder.mutationField("rotateWebhookSecret", (t) =>
  t.field({
    type: WebhookSecretType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return webhookService.rotateSecret(args.organizationId, userId, args.id);
    },
  }),
);

builder.mutationField("deleteWebhook", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      await webhookService.delete(args.organizationId, userId, args.id);
      return true;
    },
  }),
);

// ─── Calendar feeds & chat integrations ──────────────────────

builder.queryField("calendarFeedTokens", (t) =>
  t.field({
    type: [CalendarFeedTokenType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      await requireMember(ctx, args.organizationId);
      const manager = await isManager(ctx, args.organizationId);
      if (manager) return calendarFeedService.list(args.organizationId, args.employeeId ?? null);
      const own = await ownEmployeeId(ctx, args.organizationId);
      if (!own) throw new Error("No employee record linked to your account");
      return calendarFeedService.list(args.organizationId, own);
    },
  }),
);

builder.queryField("calendarFeedUrl", (t) =>
  t.string({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      token: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await requireMember(ctx, args.organizationId);
      return calendarFeedService.feedUrl(args.token);
    },
  }),
);

builder.mutationField("issueCalendarFeedToken", (t) =>
  t.field({
    type: CalendarFeedTokenType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      scope: t.arg({ type: CalendarFeedScopeEnum }),
      employeeId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const scope = (args.scope as CalendarFeedScope | null) ?? CalendarFeedScope.EMPLOYEE;
      await billingService.assertFeature(args.organizationId, PlanFeature.CALENDAR_FEED);
      if (scope === CalendarFeedScope.ORGANIZATION) {
        await requireOwnerOrManager(ctx, args.organizationId);
        return calendarFeedService.issue(args.organizationId, userId, { scope });
      }
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      if (!employeeId) throw new Error("employeeId is required");
      return calendarFeedService.issue(args.organizationId, userId, { scope, employeeId });
    },
  }),
);

builder.mutationField("revokeCalendarFeedToken", (t) =>
  t.field({
    type: CalendarFeedTokenType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      const token = await ctx.prisma.calendarFeedToken.findFirst({
        where: { id: args.id, organizationId: args.organizationId },
        select: { employeeId: true },
      });
      if (!token) throw new Error("Calendar feed token not found");
      if (token.employeeId) {
        await requireSelfOrManager(ctx, args.organizationId, token.employeeId);
      } else {
        await requireOwnerOrManager(ctx, args.organizationId);
      }
      return calendarFeedService.revoke(args.organizationId, userId, args.id);
    },
  }),
);

builder.queryField("integrationConnections", (t) =>
  t.field({
    type: [IntegrationConnectionType],
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return integrationService.list(args.organizationId);
    },
  }),
);

builder.mutationField("connectIntegration", (t) =>
  t.field({
    type: IntegrationConnectionType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      type: t.arg({ type: IntegrationTypeEnum, required: true }),
      config: t.arg({ type: "JSON", required: true }),
      active: t.arg.boolean(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      if (args.type !== IntegrationType.GOOGLE_CALENDAR) {
        await billingService.assertFeature(args.organizationId, PlanFeature.CHAT_INTEGRATIONS);
      }
      return integrationService.upsert(args.organizationId, userId, {
        type: args.type as IntegrationType,
        config: (args.config ?? {}) as Record<string, unknown>,
        active: args.active ?? null,
      });
    },
  }),
);

builder.mutationField("disconnectIntegration", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return integrationService.disconnect(args.organizationId, userId, args.id);
    },
  }),
);

// ─── Documents & certifications ──────────────────────────────

builder.queryField("employeeDocuments", (t) =>
  t.field({
    type: [EmployeeDocumentGqlType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      return employeeDocumentService.list(args.organizationId, employeeId);
    },
  }),
);

builder.mutationField("deleteEmployeeDocument", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      await employeeDocumentService.delete(args.organizationId, userId, args.id);
      return true;
    },
  }),
);

builder.queryField("certifications", (t) =>
  t.field({
    type: [CertificationType],
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string(),
      status: t.arg({ type: CertificationStatusEnum }),
    },
    resolve: async (_root, args, ctx) => {
      const employeeId = await scopedEmployeeId(ctx, args.organizationId, args.employeeId);
      return certificationService.list(args.organizationId, {
        employeeId,
        status: (args.status as CertificationStatus | null) ?? null,
      });
    },
  }),
);

builder.mutationField("createCertification", (t) =>
  t.field({
    type: CertificationType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      employeeId: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
      skillId: t.arg.string(),
      issuedAt: t.arg.string(),
      expiresAt: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return certificationService.create(args.organizationId, userId, {
        employeeId: args.employeeId,
        name: args.name,
        skillId: args.skillId ?? null,
        issuedAt: args.issuedAt ?? null,
        expiresAt: args.expiresAt ?? null,
      });
    },
  }),
);

builder.mutationField("updateCertification", (t) =>
  t.field({
    type: CertificationType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
      name: t.arg.string(),
      skillId: t.arg.string(),
      issuedAt: t.arg.string(),
      expiresAt: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      return certificationService.update(args.organizationId, userId, args.id, {
        ...(args.name !== null && args.name !== undefined ? { name: args.name } : {}),
        ...(args.skillId !== undefined ? { skillId: args.skillId } : {}),
        ...(args.issuedAt !== undefined ? { issuedAt: args.issuedAt } : {}),
        ...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {}),
      });
    },
  }),
);

builder.mutationField("deleteCertification", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwnerOrManager(ctx, args.organizationId);
      await certificationService.delete(args.organizationId, userId, args.id);
      return true;
    },
  }),
);

// ─── Billing ─────────────────────────────────────────────────

builder.queryField("subscription", (t) =>
  t.field({
    type: SubscriptionType,
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      await requireMember(ctx, args.organizationId);
      const [subscription, limits, usage] = await Promise.all([
        billingService.subscription(args.organizationId),
        billingService.limits(args.organizationId),
        billingService.usage(args.organizationId),
      ]);
      return {
        ...subscription,
        limits,
        employeeCount: usage.employeeCount,
        locationCount: usage.locationCount,
      };
    },
  }),
);

builder.queryField("invoices", (t) =>
  t.field({
    type: [InvoiceType],
    authScopes: { authenticated: true },
    args: { organizationId: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx);
      await requireOwner(ctx, args.organizationId);
      return billingService.invoices(args.organizationId);
    },
  }),
);

builder.mutationField("createCheckoutSession", (t) =>
  t.field({
    type: CheckoutSessionType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      plan: t.arg({ type: SubscriptionPlanEnum, required: true }),
      successUrl: t.arg.string(),
      cancelUrl: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwner(ctx, args.organizationId);
      return billingService.createCheckoutSession(args.organizationId, userId, {
        plan: args.plan as SubscriptionPlan,
        successUrl: args.successUrl ?? null,
        cancelUrl: args.cancelUrl ?? null,
      });
    },
  }),
);

builder.mutationField("createBillingPortalSession", (t) =>
  t.field({
    type: CheckoutSessionType,
    authScopes: { authenticated: true },
    args: {
      organizationId: t.arg.string({ required: true }),
      returnUrl: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireUser(ctx);
      await requireOwner(ctx, args.organizationId);
      return billingService.createPortalSession(args.organizationId, userId, args.returnUrl ?? null);
    },
  }),
);
