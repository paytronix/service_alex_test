export enum NotificationType {
  SHIFT_ASSIGNED = "SHIFT_ASSIGNED",
  SHIFT_CHANGED = "SHIFT_CHANGED",
  REQUEST_APPROVED = "REQUEST_APPROVED",
  REQUEST_REJECTED = "REQUEST_REJECTED",
  SCHEDULE_PUBLISHED = "SCHEDULE_PUBLISHED",
  SWAP_REQUESTED = "SWAP_REQUESTED",
  SWAP_ACCEPTED = "SWAP_ACCEPTED",
  SWAP_APPROVED = "SWAP_APPROVED",
  SWAP_REJECTED = "SWAP_REJECTED",
  SHIFT_COMMENT_ADDED = "SHIFT_COMMENT_ADDED",
  TIME_ENTRY_ADJUSTED = "TIME_ENTRY_ADJUSTED",
  TIME_ENTRY_APPROVED = "TIME_ENTRY_APPROVED",
  OPEN_SHIFT_PUBLISHED = "OPEN_SHIFT_PUBLISHED",
  OPEN_SHIFT_CLAIMED = "OPEN_SHIFT_CLAIMED",
  OPEN_SHIFT_CLAIM_APPROVED = "OPEN_SHIFT_CLAIM_APPROVED",
  OPEN_SHIFT_CLAIM_REJECTED = "OPEN_SHIFT_CLAIM_REJECTED",
  CERTIFICATION_EXPIRING = "CERTIFICATION_EXPIRING",
  CERTIFICATION_EXPIRED = "CERTIFICATION_EXPIRED",
  SUBSCRIPTION_UPDATED = "SUBSCRIPTION_UPDATED",
}

export enum NotificationChannel {
  EMAIL = "EMAIL",
  IN_APP = "IN_APP",
  TELEGRAM = "TELEGRAM",
  SLACK = "SLACK",
}

export enum NotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  READ = "READ",
}

export enum ScheduleChangeType {
  CREATED = "CREATED",
  MOVED = "MOVED",
  REPLACED = "REPLACED",
  REMOVED = "REMOVED",
}

export enum AuditAction {
  EMPLOYEE_CREATED = "EMPLOYEE_CREATED",
  EMPLOYEE_UPDATED = "EMPLOYEE_UPDATED",
  EMPLOYEE_DISMISSED = "EMPLOYEE_DISMISSED",
  EMPLOYEE_DELETED = "EMPLOYEE_DELETED",
  SCHEDULE_CREATED = "SCHEDULE_CREATED",
  SCHEDULE_PUBLISHED = "SCHEDULE_PUBLISHED",
  SCHEDULE_REOPENED = "SCHEDULE_REOPENED",
  SHIFT_ASSIGNED = "SHIFT_ASSIGNED",
  SHIFT_MOVED = "SHIFT_MOVED",
  SHIFT_UPDATED = "SHIFT_UPDATED",
  SHIFT_REMOVED = "SHIFT_REMOVED",
  LEAVE_REQUEST_APPROVED = "LEAVE_REQUEST_APPROVED",
  LEAVE_REQUEST_REJECTED = "LEAVE_REQUEST_REJECTED",
  NOTIFICATION_SENT = "NOTIFICATION_SENT",
  SHIFTS_BULK_UPDATED = "SHIFTS_BULK_UPDATED",
  SCHEDULE_GENERATED_FROM_TEMPLATE = "SCHEDULE_GENERATED_FROM_TEMPLATE",
  WEEK_TEMPLATE_CREATED = "WEEK_TEMPLATE_CREATED",
  SWAP_REQUEST_CREATED = "SWAP_REQUEST_CREATED",
  SWAP_REQUEST_ACCEPTED = "SWAP_REQUEST_ACCEPTED",
  SWAP_REQUEST_APPROVED = "SWAP_REQUEST_APPROVED",
  SWAP_REQUEST_REJECTED = "SWAP_REQUEST_REJECTED",
  SWAP_REQUEST_CANCELLED = "SWAP_REQUEST_CANCELLED",
  SHIFT_COMMENT_CREATED = "SHIFT_COMMENT_CREATED",
  SHIFT_COMMENT_DELETED = "SHIFT_COMMENT_DELETED",
  ATTACHMENT_UPLOADED = "ATTACHMENT_UPLOADED",
  ATTACHMENT_DELETED = "ATTACHMENT_DELETED",
  LOCATION_CREATED = "LOCATION_CREATED",
  LOCATION_UPDATED = "LOCATION_UPDATED",
  LOCATION_DELETED = "LOCATION_DELETED",
  CALENDAR_CREATED = "CALENDAR_CREATED",
  CALENDAR_UPDATED = "CALENDAR_UPDATED",
  CALENDAR_DELETED = "CALENDAR_DELETED",
  TIME_ENTRY_CLOCKED_IN = "TIME_ENTRY_CLOCKED_IN",
  TIME_ENTRY_CLOCKED_OUT = "TIME_ENTRY_CLOCKED_OUT",
  TIME_ENTRY_ADJUSTED = "TIME_ENTRY_ADJUSTED",
  TIME_ENTRY_APPROVED = "TIME_ENTRY_APPROVED",
  PAY_PERIOD_OPENED = "PAY_PERIOD_OPENED",
  PAY_PERIOD_LOCKED = "PAY_PERIOD_LOCKED",
  PAYROLL_EXPORTED = "PAYROLL_EXPORTED",
  OPEN_SHIFT_PUBLISHED = "OPEN_SHIFT_PUBLISHED",
  OPEN_SHIFT_CANCELLED = "OPEN_SHIFT_CANCELLED",
  OPEN_SHIFT_CLAIMED = "OPEN_SHIFT_CLAIMED",
  OPEN_SHIFT_CLAIM_WITHDRAWN = "OPEN_SHIFT_CLAIM_WITHDRAWN",
  OPEN_SHIFT_CLAIM_APPROVED = "OPEN_SHIFT_CLAIM_APPROVED",
  OPEN_SHIFT_CLAIM_REJECTED = "OPEN_SHIFT_CLAIM_REJECTED",
  WEBHOOK_CREATED = "WEBHOOK_CREATED",
  WEBHOOK_UPDATED = "WEBHOOK_UPDATED",
  WEBHOOK_DELETED = "WEBHOOK_DELETED",
  CALENDAR_FEED_TOKEN_CREATED = "CALENDAR_FEED_TOKEN_CREATED",
  CALENDAR_FEED_TOKEN_REVOKED = "CALENDAR_FEED_TOKEN_REVOKED",
  INTEGRATION_CONNECTED = "INTEGRATION_CONNECTED",
  INTEGRATION_UPDATED = "INTEGRATION_UPDATED",
  INTEGRATION_DISCONNECTED = "INTEGRATION_DISCONNECTED",
  EMPLOYEE_DOCUMENT_UPLOADED = "EMPLOYEE_DOCUMENT_UPLOADED",
  EMPLOYEE_DOCUMENT_DELETED = "EMPLOYEE_DOCUMENT_DELETED",
  CERTIFICATION_CREATED = "CERTIFICATION_CREATED",
  CERTIFICATION_UPDATED = "CERTIFICATION_UPDATED",
  CERTIFICATION_DELETED = "CERTIFICATION_DELETED",
  SUBSCRIPTION_CHECKOUT_STARTED = "SUBSCRIPTION_CHECKOUT_STARTED",
  SUBSCRIPTION_UPDATED = "SUBSCRIPTION_UPDATED",
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.SHIFT_ASSIGNED]: "Shift assigned",
  [NotificationType.SHIFT_CHANGED]: "Shift changed",
  [NotificationType.REQUEST_APPROVED]: "Request approved",
  [NotificationType.REQUEST_REJECTED]: "Request rejected",
  [NotificationType.SCHEDULE_PUBLISHED]: "Schedule published",
  [NotificationType.SWAP_REQUESTED]: "Shift swap requested",
  [NotificationType.SWAP_ACCEPTED]: "Shift swap accepted",
  [NotificationType.SWAP_APPROVED]: "Shift swap approved",
  [NotificationType.SWAP_REJECTED]: "Shift swap rejected",
  [NotificationType.SHIFT_COMMENT_ADDED]: "New shift comment",
  [NotificationType.TIME_ENTRY_ADJUSTED]: "Time entry adjusted",
  [NotificationType.TIME_ENTRY_APPROVED]: "Time entry approved",
  [NotificationType.OPEN_SHIFT_PUBLISHED]: "Open shift published",
  [NotificationType.OPEN_SHIFT_CLAIMED]: "Open shift claimed",
  [NotificationType.OPEN_SHIFT_CLAIM_APPROVED]: "Open shift claim approved",
  [NotificationType.OPEN_SHIFT_CLAIM_REJECTED]: "Open shift claim rejected",
  [NotificationType.CERTIFICATION_EXPIRING]: "Certification expiring",
  [NotificationType.CERTIFICATION_EXPIRED]: "Certification expired",
  [NotificationType.SUBSCRIPTION_UPDATED]: "Subscription updated",
};

export interface NotificationDto {
  id: string;
  organizationId: string;
  recipientId: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
  sentAt?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  organizationId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ScheduleVersionDto {
  id: string;
  scheduleId: string;
  version: number;
  publishedAt: string;
  publishedById?: string | null;
}

export interface ShiftAssignmentHistoryDto {
  id: string;
  scheduleId: string;
  assignmentId: string;
  changeType: ScheduleChangeType;
  date: string;
  previousEmployeeId?: string | null;
  newEmployeeId?: string | null;
  changedById?: string | null;
  changedAt: string;
}

// ─── Domain events ───────────────────────────────────────────

export const DomainEventName = {
  ShiftAssigned: "shift.assigned",
  ShiftChanged: "shift.changed",
  LeaveRequestApproved: "leaveRequest.approved",
  LeaveRequestRejected: "leaveRequest.rejected",
  SchedulePublished: "schedule.published",
  ShiftSwapRequested: "shiftSwap.requested",
  ShiftSwapAccepted: "shiftSwap.accepted",
  ShiftSwapApproved: "shiftSwap.approved",
  ShiftSwapRejected: "shiftSwap.rejected",
  ShiftCommentAdded: "shiftComment.added",
  TimeEntryClockedIn: "timeEntry.clockedIn",
  TimeEntryClosed: "timeEntry.closed",
  TimeEntryAdjusted: "timeEntry.adjusted",
  TimeEntryApproved: "timeEntry.approved",
  OpenShiftPublished: "openShift.published",
  OpenShiftClaimed: "openShift.claimed",
  OpenShiftClaimApproved: "openShift.claimApproved",
  OpenShiftClaimRejected: "openShift.claimRejected",
  CertificationExpiring: "certification.expiring",
  CertificationExpired: "certification.expired",
  SubscriptionUpdated: "subscription.updated",
} as const;

export type DomainEventName = (typeof DomainEventName)[keyof typeof DomainEventName];

export interface ShiftEventPayload {
  organizationId: string;
  actorId?: string | null;
  scheduleId: string;
  scheduleName: string;
  scheduleStatus: string;
  scheduleVersion: number;
  assignmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  changeType: ScheduleChangeType;
  employeeId?: string | null;
  previousEmployeeId?: string | null;
}

export interface LeaveRequestEventPayload {
  organizationId: string;
  actorId?: string | null;
  leaveRequestId: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reviewerComment?: string | null;
}

export interface SchedulePublishedEventPayload {
  organizationId: string;
  actorId?: string | null;
  scheduleId: string;
  scheduleName: string;
  version: number;
  startDate: string;
  endDate: string;
  employeeIds: string[];
}

export interface ShiftSwapEventPayload {
  organizationId: string;
  actorId?: string | null;
  swapRequestId: string;
  assignmentId: string;
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  requestedById: string;
  targetEmployeeId: string;
  status: string;
  message?: string | null;
}

export interface ShiftCommentEventPayload {
  organizationId: string;
  actorId?: string | null;
  commentId: string;
  assignmentId?: string | null;
  scheduleId?: string | null;
  text: string;
  recipientEmployeeIds: string[];
}

export interface TimeEntryEventPayload {
  organizationId: string;
  actorId?: string | null;
  timeEntryId: string;
  employeeId: string;
  shiftAssignmentId?: string | null;
  clockInAt: string;
  clockOutAt?: string | null;
  minutesWorked: number;
  status: string;
  source: string;
}

export interface OpenShiftEventPayload {
  organizationId: string;
  actorId?: string | null;
  openShiftId: string;
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  roleId: string;
  locationId?: string | null;
  requiredCount: number;
  status: string;
  eligibleEmployeeIds?: string[];
}

export interface OpenShiftClaimEventPayload {
  organizationId: string;
  actorId?: string | null;
  openShiftId: string;
  claimId: string;
  employeeId: string;
  date: string;
  status: string;
  assignmentId?: string | null;
}

export interface CertificationEventPayload {
  organizationId: string;
  actorId?: string | null;
  certificationId: string;
  employeeId: string;
  name: string;
  status: string;
  expiresAt?: string | null;
}

export interface SubscriptionEventPayload {
  organizationId: string;
  actorId?: string | null;
  subscriptionId: string;
  plan: string;
  status: string;
  currentPeriodEnd?: string | null;
}

export interface DomainEventPayloads {
  "shift.assigned": ShiftEventPayload;
  "shift.changed": ShiftEventPayload;
  "leaveRequest.approved": LeaveRequestEventPayload;
  "leaveRequest.rejected": LeaveRequestEventPayload;
  "schedule.published": SchedulePublishedEventPayload;
  "shiftSwap.requested": ShiftSwapEventPayload;
  "shiftSwap.accepted": ShiftSwapEventPayload;
  "shiftSwap.approved": ShiftSwapEventPayload;
  "shiftSwap.rejected": ShiftSwapEventPayload;
  "shiftComment.added": ShiftCommentEventPayload;
  "timeEntry.clockedIn": TimeEntryEventPayload;
  "timeEntry.closed": TimeEntryEventPayload;
  "timeEntry.adjusted": TimeEntryEventPayload;
  "timeEntry.approved": TimeEntryEventPayload;
  "openShift.published": OpenShiftEventPayload;
  "openShift.claimed": OpenShiftClaimEventPayload;
  "openShift.claimApproved": OpenShiftClaimEventPayload;
  "openShift.claimRejected": OpenShiftClaimEventPayload;
  "certification.expiring": CertificationEventPayload;
  "certification.expired": CertificationEventPayload;
  "subscription.updated": SubscriptionEventPayload;
}
