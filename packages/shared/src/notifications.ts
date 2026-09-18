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
}

export enum NotificationChannel {
  EMAIL = "EMAIL",
  IN_APP = "IN_APP",
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
}
