import {
  CalendarFeedScope,
  CertificationStatus,
  ClaimStatus,
  EmployeeDocumentType,
  IntegrationType,
  InvoiceStatus,
  OpenShiftStatus,
  PayPeriodStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  TimeEntrySource,
  TimeEntryStatus,
  WebhookDeliveryStatus,
  type CalendarFeedToken,
  type Certification,
  type EmployeeDocument,
  type IntegrationConnection,
  type Invoice,
  type OpenShift,
  type OpenShiftClaim,
  type PayPeriod,
  type Subscription,
  type TimeEntry,
  type Webhook,
  type WebhookDelivery,
} from "@prisma/client";
import { LaborCostGroupBy, PlanFeature } from "@shiftflow/shared";
import type {
  LaborCostReportDto,
  LaborCostRowDto,
  PayrollRowDto,
  PlanLimits,
  TimesheetDto,
  TimesheetRowDto,
} from "@shiftflow/shared";
import { builder } from "../builder";
import { redactConfig } from "../../services/integration.service";
import { EmployeeType } from "./employee";

// ─── Enums ───────────────────────────────────────────────────

export const TimeEntrySourceEnum = builder.enumType(TimeEntrySource, { name: "TimeEntrySource" });
export const TimeEntryStatusEnum = builder.enumType(TimeEntryStatus, { name: "TimeEntryStatus" });
export const PayPeriodStatusEnum = builder.enumType(PayPeriodStatus, { name: "PayPeriodStatus" });
export const LaborCostGroupByEnum = builder.enumType(LaborCostGroupBy, {
  name: "LaborCostGroupBy",
});
export const OpenShiftStatusEnum = builder.enumType(OpenShiftStatus, { name: "OpenShiftStatus" });
export const ClaimStatusEnum = builder.enumType(ClaimStatus, { name: "ClaimStatus" });
export const WebhookDeliveryStatusEnum = builder.enumType(WebhookDeliveryStatus, {
  name: "WebhookDeliveryStatus",
});
export const CalendarFeedScopeEnum = builder.enumType(CalendarFeedScope, {
  name: "CalendarFeedScope",
});
export const IntegrationTypeEnum = builder.enumType(IntegrationType, { name: "IntegrationType" });
export const EmployeeDocumentTypeEnum = builder.enumType(EmployeeDocumentType, {
  name: "EmployeeDocumentType",
});
export const CertificationStatusEnum = builder.enumType(CertificationStatus, {
  name: "CertificationStatus",
});
export const SubscriptionPlanEnum = builder.enumType(SubscriptionPlan, { name: "SubscriptionPlan" });
export const SubscriptionStatusEnum = builder.enumType(SubscriptionStatus, {
  name: "SubscriptionStatus",
});
export const InvoiceStatusEnum = builder.enumType(InvoiceStatus, { name: "InvoiceStatus" });
export const PlanFeatureEnum = builder.enumType(PlanFeature, { name: "PlanFeature" });

// ─── Time tracking ───────────────────────────────────────────

export const TimeEntryType = builder.objectRef<TimeEntry>("TimeEntry");

builder.objectType(TimeEntryType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    employeeId: t.exposeString("employeeId"),
    shiftAssignmentId: t.exposeString("shiftAssignmentId", { nullable: true }),
    clockInAt: t.expose("clockInAt", { type: "DateTime" }),
    clockOutAt: t.expose("clockOutAt", { type: "DateTime", nullable: true }),
    source: t.field({ type: TimeEntrySourceEnum, resolve: (parent) => parent.source }),
    status: t.field({ type: TimeEntryStatusEnum, resolve: (parent) => parent.status }),
    note: t.exposeString("note", { nullable: true }),
    approvedById: t.exposeString("approvedById", { nullable: true }),
    approvedAt: t.expose("approvedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    minutesWorked: t.int({
      resolve: (parent) =>
        Math.max(
          0,
          Math.round(
            ((parent.clockOutAt ?? new Date()).getTime() - parent.clockInAt.getTime()) / 60000,
          ),
        ),
    }),
    employee: t.field({
      type: EmployeeType,
      nullable: true,
      resolve: (parent, _args, ctx) => ctx.loaders.employee.load(parent.employeeId),
    }),
  }),
});

export const TimesheetRowType = builder.objectRef<TimesheetRowDto>("TimesheetRow");

builder.objectType(TimesheetRowType, {
  fields: (t) => ({
    employeeId: t.exposeString("employeeId"),
    employeeName: t.exposeString("employeeName"),
    date: t.exposeString("date"),
    shiftAssignmentId: t.exposeString("shiftAssignmentId", { nullable: true }),
    timeEntryId: t.exposeString("timeEntryId", { nullable: true }),
    plannedStartAt: t.exposeString("plannedStartAt", { nullable: true }),
    plannedEndAt: t.exposeString("plannedEndAt", { nullable: true }),
    plannedMinutes: t.exposeInt("plannedMinutes"),
    actualStartAt: t.exposeString("actualStartAt", { nullable: true }),
    actualEndAt: t.exposeString("actualEndAt", { nullable: true }),
    actualMinutes: t.exposeInt("actualMinutes"),
    lateMinutes: t.exposeInt("lateMinutes"),
    earlyLeaveMinutes: t.exposeInt("earlyLeaveMinutes"),
    overtimeMinutes: t.exposeInt("overtimeMinutes"),
    status: t.field({
      type: TimeEntryStatusEnum,
      nullable: true,
      resolve: (parent) => (parent.status ?? null) as TimeEntryStatus | null,
    }),
    approved: t.exposeBoolean("approved"),
    missing: t.exposeBoolean("missing"),
    unplanned: t.exposeBoolean("unplanned"),
  }),
});

export const TimesheetType = builder.objectRef<TimesheetDto>("Timesheet");

builder.objectType(TimesheetType, {
  fields: (t) => ({
    from: t.exposeString("from"),
    to: t.exposeString("to"),
    rows: t.field({ type: [TimesheetRowType], resolve: (parent) => parent.rows }),
    plannedHours: t.exposeFloat("plannedHours"),
    actualHours: t.exposeFloat("actualHours"),
    overtimeHours: t.exposeFloat("overtimeHours"),
  }),
});

// ─── Labor cost & payroll ────────────────────────────────────

export const PayPeriodType = builder.objectRef<PayPeriod>("PayPeriod");

builder.objectType(PayPeriodType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    from: t.expose("from", { type: "DateTime" }),
    to: t.expose("to", { type: "DateTime" }),
    status: t.field({ type: PayPeriodStatusEnum, resolve: (parent) => parent.status }),
    lockedAt: t.expose("lockedAt", { type: "DateTime", nullable: true }),
    lockedById: t.exposeString("lockedById", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

export const LaborCostRowType = builder.objectRef<LaborCostRowDto>("LaborCostRow");

builder.objectType(LaborCostRowType, {
  fields: (t) => ({
    key: t.exposeString("key"),
    label: t.exposeString("label"),
    plannedHours: t.exposeFloat("plannedHours"),
    actualHours: t.exposeFloat("actualHours"),
    overtimeHours: t.exposeFloat("overtimeHours"),
    hourlyRate: t.exposeFloat("hourlyRate"),
    plannedCost: t.exposeFloat("plannedCost"),
    actualCost: t.exposeFloat("actualCost"),
  }),
});

export const LaborCostReportType = builder.objectRef<LaborCostReportDto>("LaborCostReport");

builder.objectType(LaborCostReportType, {
  fields: (t) => ({
    from: t.exposeString("from"),
    to: t.exposeString("to"),
    groupBy: t.field({ type: LaborCostGroupByEnum, resolve: (parent) => parent.groupBy }),
    currency: t.exposeString("currency"),
    rows: t.field({ type: [LaborCostRowType], resolve: (parent) => parent.rows }),
    plannedHours: t.exposeFloat("plannedHours"),
    actualHours: t.exposeFloat("actualHours"),
    overtimeHours: t.exposeFloat("overtimeHours"),
    plannedCost: t.exposeFloat("plannedCost"),
    actualCost: t.exposeFloat("actualCost"),
  }),
});

export const PayrollRowType = builder.objectRef<PayrollRowDto>("PayrollRow");

builder.objectType(PayrollRowType, {
  fields: (t) => ({
    employeeId: t.exposeString("employeeId"),
    employeeName: t.exposeString("employeeName"),
    departmentName: t.exposeString("departmentName", { nullable: true }),
    roleName: t.exposeString("roleName", { nullable: true }),
    locationName: t.exposeString("locationName", { nullable: true }),
    hourlyRate: t.exposeFloat("hourlyRate"),
    plannedHours: t.exposeFloat("plannedHours"),
    actualHours: t.exposeFloat("actualHours"),
    overtimeHours: t.exposeFloat("overtimeHours"),
    grossPay: t.exposeFloat("grossPay"),
  }),
});

/** Export payload returned base64-encoded so it can travel over GraphQL. */
export const PayrollExportType = builder.objectRef<{
  filename: string;
  mimeType: string;
  content: string;
}>("PayrollExport");

builder.objectType(PayrollExportType, {
  fields: (t) => ({
    filename: t.exposeString("filename"),
    mimeType: t.exposeString("mimeType"),
    content: t.exposeString("content", {
      description: "Base64-encoded file contents",
    }),
  }),
});

// ─── Open shifts ─────────────────────────────────────────────

export const OpenShiftType = builder.objectRef<OpenShift>("OpenShift");
export const OpenShiftClaimType = builder.objectRef<OpenShiftClaim>("OpenShiftClaim");

builder.objectType(OpenShiftType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    scheduleId: t.exposeString("scheduleId"),
    locationId: t.exposeString("locationId", { nullable: true }),
    date: t.expose("date", { type: "DateTime" }),
    shiftTemplateId: t.exposeString("shiftTemplateId"),
    roleId: t.exposeString("roleId"),
    requiredCount: t.exposeInt("requiredCount"),
    filledCount: t.exposeInt("filledCount"),
    status: t.field({ type: OpenShiftStatusEnum, resolve: (parent) => parent.status }),
    note: t.exposeString("note", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    claims: t.field({
      type: [OpenShiftClaimType],
      resolve: (parent, _args, ctx) =>
        ctx.prisma.openShiftClaim.findMany({
          where: { openShiftId: parent.id, organizationId: parent.organizationId },
          orderBy: { createdAt: "asc" },
        }),
    }),
  }),
});

builder.objectType(OpenShiftClaimType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    openShiftId: t.exposeString("openShiftId"),
    employeeId: t.exposeString("employeeId"),
    status: t.field({ type: ClaimStatusEnum, resolve: (parent) => parent.status }),
    message: t.exposeString("message", { nullable: true }),
    assignmentId: t.exposeString("assignmentId", { nullable: true }),
    reviewedById: t.exposeString("reviewedById", { nullable: true }),
    reviewedAt: t.expose("reviewedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    employee: t.field({
      type: EmployeeType,
      nullable: true,
      resolve: (parent, _args, ctx) => ctx.loaders.employee.load(parent.employeeId),
    }),
    openShift: t.field({
      type: OpenShiftType,
      resolve: async (parent, _args, ctx) => {
        const shift = await ctx.prisma.openShift.findFirst({
          where: { id: parent.openShiftId, organizationId: parent.organizationId },
        });
        if (!shift) throw new Error("Open shift not found");
        return shift;
      },
    }),
  }),
});

// ─── Integrations ────────────────────────────────────────────

export const WebhookType = builder.objectRef<Webhook>("Webhook");

builder.objectType(WebhookType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    url: t.exposeString("url"),
    events: t.exposeStringList("events"),
    description: t.exposeString("description", { nullable: true }),
    active: t.exposeBoolean("active"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

/** Returned only right after creation or rotation, when the secret is shown once. */
export const WebhookSecretType = builder.objectRef<Webhook>("WebhookWithSecret");

builder.objectType(WebhookSecretType, {
  fields: (t) => ({
    webhook: t.field({ type: WebhookType, resolve: (parent) => parent }),
    secret: t.exposeString("secret"),
  }),
});

export const WebhookDeliveryType = builder.objectRef<WebhookDelivery>("WebhookDelivery");

builder.objectType(WebhookDeliveryType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    webhookId: t.exposeString("webhookId"),
    event: t.exposeString("event"),
    status: t.field({ type: WebhookDeliveryStatusEnum, resolve: (parent) => parent.status }),
    attempts: t.exposeInt("attempts"),
    responseCode: t.exposeInt("responseCode", { nullable: true }),
    error: t.exposeString("error", { nullable: true }),
    nextAttemptAt: t.expose("nextAttemptAt", { type: "DateTime", nullable: true }),
    deliveredAt: t.expose("deliveredAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

export const CalendarFeedTokenType = builder.objectRef<CalendarFeedToken>("CalendarFeedToken");

builder.objectType(CalendarFeedTokenType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    employeeId: t.exposeString("employeeId", { nullable: true }),
    scope: t.field({ type: CalendarFeedScopeEnum, resolve: (parent) => parent.scope }),
    token: t.exposeString("token"),
    revokedAt: t.expose("revokedAt", { type: "DateTime", nullable: true }),
    lastUsedAt: t.expose("lastUsedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

export const IntegrationConnectionType =
  builder.objectRef<IntegrationConnection>("IntegrationConnection");

builder.objectType(IntegrationConnectionType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    type: t.field({ type: IntegrationTypeEnum, resolve: (parent) => parent.type }),
    active: t.exposeBoolean("active"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    config: t.field({
      type: "JSON",
      description: "Connection settings with secret values redacted",
      resolve: (parent) => redactConfig(parent.config),
    }),
  }),
});

// ─── Documents & certifications ──────────────────────────────

export const EmployeeDocumentGqlType = builder.objectRef<EmployeeDocument>("EmployeeDocument");

builder.objectType(EmployeeDocumentGqlType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    employeeId: t.exposeString("employeeId"),
    type: t.field({ type: EmployeeDocumentTypeEnum, resolve: (parent) => parent.type }),
    fileName: t.exposeString("fileName"),
    url: t.exposeString("url", { nullable: true }),
    mimeType: t.exposeString("mimeType"),
    size: t.exposeInt("size"),
    uploadedById: t.exposeString("uploadedById", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

export const CertificationType = builder.objectRef<Certification>("Certification");

builder.objectType(CertificationType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    employeeId: t.exposeString("employeeId"),
    skillId: t.exposeString("skillId", { nullable: true }),
    name: t.exposeString("name"),
    issuedAt: t.expose("issuedAt", { type: "DateTime", nullable: true }),
    expiresAt: t.expose("expiresAt", { type: "DateTime", nullable: true }),
    status: t.field({ type: CertificationStatusEnum, resolve: (parent) => parent.status }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    employee: t.field({
      type: EmployeeType,
      nullable: true,
      resolve: (parent, _args, ctx) => ctx.loaders.employee.load(parent.employeeId),
    }),
  }),
});

// ─── Billing ─────────────────────────────────────────────────

export const PlanLimitsType = builder.objectRef<PlanLimits>("PlanLimits");

builder.objectType(PlanLimitsType, {
  fields: (t) => ({
    plan: t.field({ type: SubscriptionPlanEnum, resolve: (parent) => parent.plan }),
    maxEmployees: t.exposeInt("maxEmployees", { nullable: true }),
    maxLocations: t.exposeInt("maxLocations", { nullable: true }),
    features: t.field({ type: [PlanFeatureEnum], resolve: (parent) => parent.features }),
  }),
});

export const SubscriptionType = builder.objectRef<
  Subscription & { limits: PlanLimits; employeeCount: number; locationCount: number }
>("Subscription");

builder.objectType(SubscriptionType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    plan: t.field({ type: SubscriptionPlanEnum, resolve: (parent) => parent.plan }),
    status: t.field({ type: SubscriptionStatusEnum, resolve: (parent) => parent.status }),
    stripeCustomerId: t.exposeString("stripeCustomerId", { nullable: true }),
    currentPeriodEnd: t.expose("currentPeriodEnd", { type: "DateTime", nullable: true }),
    cancelAtPeriodEnd: t.exposeBoolean("cancelAtPeriodEnd"),
    limits: t.field({ type: PlanLimitsType, resolve: (parent) => parent.limits }),
    employeeCount: t.exposeInt("employeeCount"),
    locationCount: t.exposeInt("locationCount"),
  }),
});

export const InvoiceType = builder.objectRef<Invoice>("Invoice");

builder.objectType(InvoiceType, {
  fields: (t) => ({
    id: t.exposeString("id"),
    organizationId: t.exposeString("organizationId"),
    stripeInvoiceId: t.exposeString("stripeInvoiceId"),
    number: t.exposeString("number", { nullable: true }),
    status: t.field({ type: InvoiceStatusEnum, resolve: (parent) => parent.status }),
    amountDue: t.exposeInt("amountDue", { description: "Amount due in minor units" }),
    amountPaid: t.exposeInt("amountPaid", { description: "Amount paid in minor units" }),
    currency: t.exposeString("currency"),
    hostedInvoiceUrl: t.exposeString("hostedInvoiceUrl", { nullable: true }),
    issuedAt: t.expose("issuedAt", { type: "DateTime", nullable: true }),
  }),
});

export const CheckoutSessionType = builder.objectRef<{ url: string }>("CheckoutSession");

builder.objectType(CheckoutSessionType, {
  fields: (t) => ({
    url: t.exposeString("url"),
  }),
});
