import { ViolationLevel, type Violation } from "./scheduling";

// ─── Time tracking ───────────────────────────────────────────

export enum TimeEntrySource {
  WEB = "WEB",
  QR = "QR",
  MANUAL = "MANUAL",
}

export enum TimeEntryStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  ADJUSTED = "ADJUSTED",
}

export interface TimeEntryDto {
  id: string;
  organizationId: string;
  employeeId: string;
  shiftAssignmentId?: string | null;
  clockInAt: string;
  clockOutAt?: string | null;
  source: TimeEntrySource;
  status: TimeEntryStatus;
  note?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  minutesWorked: number;
}

/** A timesheet line comparing the plan (assignment) with the fact (time entry). */
export interface TimesheetRowDto {
  employeeId: string;
  employeeName: string;
  date: string;
  shiftAssignmentId?: string | null;
  timeEntryId?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  plannedMinutes: number;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  actualMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status?: TimeEntryStatus | null;
  approved: boolean;
  missing: boolean;
  unplanned: boolean;
}

export interface TimesheetDto {
  from: string;
  to: string;
  rows: TimesheetRowDto[];
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
}

export const TIMESHEET_LATE_TOLERANCE_MINUTES = 5;

export function minutesBetween(from: Date | string, to: Date | string): number {
  const start = from instanceof Date ? from : new Date(from);
  const end = to instanceof Date ? to : new Date(to);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

/** Minutes of an entry; an open entry is measured up to `now`. */
export function timeEntryMinutes(
  entry: { clockInAt: Date | string; clockOutAt?: Date | string | null },
  now: Date = new Date(),
): number {
  return minutesBetween(entry.clockInAt, entry.clockOutAt ?? now);
}

export function lateMinutes(
  plannedStartAt: Date | string | null | undefined,
  actualStartAt: Date | string | null | undefined,
  toleranceMinutes = TIMESHEET_LATE_TOLERANCE_MINUTES,
): number {
  if (!plannedStartAt || !actualStartAt) return 0;
  const delta = minutesBetween(plannedStartAt, actualStartAt);
  return delta > toleranceMinutes ? delta : 0;
}

export function overtimeMinutes(plannedMinutes: number, actualMinutes: number): number {
  return Math.max(0, actualMinutes - plannedMinutes);
}

// ─── Pay periods & labor cost ────────────────────────────────

export enum PayPeriodStatus {
  OPEN = "OPEN",
  LOCKED = "LOCKED",
}

export interface PayPeriodDto {
  id: string;
  organizationId: string;
  from: string;
  to: string;
  status: PayPeriodStatus;
  lockedAt?: string | null;
  lockedById?: string | null;
}

export enum LaborCostGroupBy {
  EMPLOYEE = "EMPLOYEE",
  DEPARTMENT = "DEPARTMENT",
  LOCATION = "LOCATION",
}

export interface LaborCostRowDto {
  key: string;
  label: string;
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
  hourlyRate: number;
  plannedCost: number;
  actualCost: number;
}

export interface LaborCostReportDto {
  from: string;
  to: string;
  groupBy: LaborCostGroupBy;
  currency: string;
  rows: LaborCostRowDto[];
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
  plannedCost: number;
  actualCost: number;
}

export interface PayrollRowDto {
  employeeId: string;
  employeeName: string;
  departmentName?: string | null;
  roleName?: string | null;
  locationName?: string | null;
  hourlyRate: number;
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
  grossPay: number;
}

export const DEFAULT_CURRENCY = "USD";

/** Cost of `hours` at `rate`, rounded to cents. */
export function laborCost(hours: number, rate: number): number {
  return Math.round(hours * rate * 100) / 100;
}

// ─── Open shift marketplace ──────────────────────────────────

export enum OpenShiftStatus {
  OPEN = "OPEN",
  FILLED = "FILLED",
  CANCELLED = "CANCELLED",
}

export enum ClaimStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  WITHDRAWN = "WITHDRAWN",
}

export interface OpenShiftDto {
  id: string;
  organizationId: string;
  scheduleId: string;
  locationId?: string | null;
  date: string;
  shiftTemplateId: string;
  roleId: string;
  requiredCount: number;
  filledCount: number;
  status: OpenShiftStatus;
  note?: string | null;
}

export interface OpenShiftClaimDto {
  id: string;
  organizationId: string;
  openShiftId: string;
  employeeId: string;
  status: ClaimStatus;
  message?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
}

// ─── Integrations ────────────────────────────────────────────

export enum WebhookEvent {
  SHIFT_ASSIGNED = "shift.assigned",
  SHIFT_CHANGED = "shift.changed",
  SCHEDULE_PUBLISHED = "schedule.published",
  LEAVE_REQUEST_APPROVED = "leaveRequest.approved",
  LEAVE_REQUEST_REJECTED = "leaveRequest.rejected",
  TIME_ENTRY_CLOSED = "timeEntry.closed",
  TIME_ENTRY_ADJUSTED = "timeEntry.adjusted",
  OPEN_SHIFT_PUBLISHED = "openShift.published",
  OPEN_SHIFT_CLAIMED = "openShift.claimed",
  OPEN_SHIFT_CLAIM_APPROVED = "openShift.claimApproved",
  CERTIFICATION_EXPIRING = "certification.expiring",
  SUBSCRIPTION_UPDATED = "subscription.updated",
}

export const WEBHOOK_EVENTS: WebhookEvent[] = Object.values(WebhookEvent);

export function isWebhookEvent(value: string): value is WebhookEvent {
  return WEBHOOK_EVENTS.includes(value as WebhookEvent);
}

export enum WebhookDeliveryStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export interface WebhookDto {
  id: string;
  organizationId: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  description?: string | null;
}

export interface WebhookDeliveryDto {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseCode?: number | null;
  error?: string | null;
  createdAt: string;
  deliveredAt?: string | null;
}

/** Body sent to subscribers; the signature is computed over its JSON form. */
export interface WebhookPayload<T = Record<string, unknown>> {
  id: string;
  event: WebhookEvent;
  organizationId: string;
  createdAt: string;
  data: T;
}

export const WEBHOOK_SIGNATURE_HEADER = "x-shiftflow-signature";
export const WEBHOOK_EVENT_HEADER = "x-shiftflow-event";
export const WEBHOOK_MAX_ATTEMPTS = 3;

export enum CalendarFeedScope {
  EMPLOYEE = "EMPLOYEE",
  ORGANIZATION = "ORGANIZATION",
}

export interface CalendarFeedTokenDto {
  id: string;
  organizationId: string;
  employeeId?: string | null;
  scope: CalendarFeedScope;
  token: string;
  revokedAt?: string | null;
  url: string;
}

export enum IntegrationType {
  TELEGRAM = "TELEGRAM",
  SLACK = "SLACK",
  GOOGLE_CALENDAR = "GOOGLE_CALENDAR",
}

export interface IntegrationConnectionDto {
  id: string;
  organizationId: string;
  type: IntegrationType;
  active: boolean;
  config: Record<string, unknown>;
}

// ─── Documents & certifications ──────────────────────────────

export enum EmployeeDocumentType {
  CONTRACT = "CONTRACT",
  ID = "ID",
  CERTIFICATE = "CERTIFICATE",
  MEDICAL = "MEDICAL",
  OTHER = "OTHER",
}

export interface EmployeeDocumentDto {
  id: string;
  organizationId: string;
  employeeId: string;
  type: EmployeeDocumentType;
  fileName: string;
  storageKey: string;
  url?: string | null;
  mimeType: string;
  size: number;
  uploadedById?: string | null;
  createdAt: string;
}

export enum CertificationStatus {
  VALID = "VALID",
  EXPIRING = "EXPIRING",
  EXPIRED = "EXPIRED",
}

export interface CertificationDto {
  id: string;
  organizationId: string;
  employeeId: string;
  skillId?: string | null;
  name: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  status: CertificationStatus;
}

export const CERTIFICATION_EXPIRING_DAYS = 30;

/** Recomputes the lifecycle status from the expiry date. */
export function certificationStatusFor(
  expiresAt: Date | string | null | undefined,
  now: Date = new Date(),
  expiringWithinDays = CERTIFICATION_EXPIRING_DAYS,
): CertificationStatus {
  if (!expiresAt) return CertificationStatus.VALID;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (expiry.getTime() <= now.getTime()) return CertificationStatus.EXPIRED;
  const days = (expiry.getTime() - now.getTime()) / 86400000;
  return days <= expiringWithinDays ? CertificationStatus.EXPIRING : CertificationStatus.VALID;
}

// ─── Billing ─────────────────────────────────────────────────

export enum SubscriptionPlan {
  FREE = "FREE",
  PRO = "PRO",
  BUSINESS = "BUSINESS",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELLED = "CANCELLED",
}

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  PAID = "PAID",
  VOID = "VOID",
  UNCOLLECTIBLE = "UNCOLLECTIBLE",
}

export enum PlanFeature {
  OPEN_SHIFTS = "OPEN_SHIFTS",
  TIME_TRACKING = "TIME_TRACKING",
  LABOR_COST = "LABOR_COST",
  PAYROLL_EXPORT = "PAYROLL_EXPORT",
  WEBHOOKS = "WEBHOOKS",
  CALENDAR_FEED = "CALENDAR_FEED",
  CHAT_INTEGRATIONS = "CHAT_INTEGRATIONS",
  DOCUMENTS = "DOCUMENTS",
}

export interface PlanLimits {
  plan: SubscriptionPlan;
  maxEmployees: number | null;
  maxLocations: number | null;
  features: PlanFeature[];
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  [SubscriptionPlan.FREE]: {
    plan: SubscriptionPlan.FREE,
    maxEmployees: 10,
    maxLocations: 1,
    features: [PlanFeature.TIME_TRACKING, PlanFeature.CALENDAR_FEED],
  },
  [SubscriptionPlan.PRO]: {
    plan: SubscriptionPlan.PRO,
    maxEmployees: 50,
    maxLocations: 5,
    features: [
      PlanFeature.TIME_TRACKING,
      PlanFeature.CALENDAR_FEED,
      PlanFeature.OPEN_SHIFTS,
      PlanFeature.LABOR_COST,
      PlanFeature.PAYROLL_EXPORT,
      PlanFeature.DOCUMENTS,
      PlanFeature.CHAT_INTEGRATIONS,
    ],
  },
  [SubscriptionPlan.BUSINESS]: {
    plan: SubscriptionPlan.BUSINESS,
    maxEmployees: null,
    maxLocations: null,
    features: Object.values(PlanFeature),
  },
};

export function planLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function planAllowsFeature(plan: SubscriptionPlan, feature: PlanFeature): boolean {
  return PLAN_LIMITS[plan].features.includes(feature);
}

export function isWithinPlanLimit(limit: number | null, current: number): boolean {
  return limit === null || current < limit;
}

export interface SubscriptionDto {
  id: string;
  organizationId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  limits: PlanLimits;
  employeeCount: number;
  locationCount: number;
}

export interface InvoiceDto {
  id: string;
  organizationId: string;
  stripeInvoiceId: string;
  number?: string | null;
  status: InvoiceStatus;
  amountDue: number;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl?: string | null;
  issuedAt?: string | null;
}

// ─── Violation helpers ───────────────────────────────────────

export function splitViolations(
  violations: Violation[],
): { errors: Violation[]; warnings: Violation[] } {
  return {
    errors: violations.filter((violation) => violation.level === ViolationLevel.ERROR),
    warnings: violations.filter((violation) => violation.level === ViolationLevel.WARNING),
  };
}
