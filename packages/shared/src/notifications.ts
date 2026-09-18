export enum NotificationType {
  SHIFT_ASSIGNED = "SHIFT_ASSIGNED",
  SHIFT_CHANGED = "SHIFT_CHANGED",
  REQUEST_APPROVED = "REQUEST_APPROVED",
  REQUEST_REJECTED = "REQUEST_REJECTED",
  SCHEDULE_PUBLISHED = "SCHEDULE_PUBLISHED",
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
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.SHIFT_ASSIGNED]: "Shift assigned",
  [NotificationType.SHIFT_CHANGED]: "Shift changed",
  [NotificationType.REQUEST_APPROVED]: "Request approved",
  [NotificationType.REQUEST_REJECTED]: "Request rejected",
  [NotificationType.SCHEDULE_PUBLISHED]: "Schedule published",
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

export interface DomainEventPayloads {
  "shift.assigned": ShiftEventPayload;
  "shift.changed": ShiftEventPayload;
  "leaveRequest.approved": LeaveRequestEventPayload;
  "leaveRequest.rejected": LeaveRequestEventPayload;
  "schedule.published": SchedulePublishedEventPayload;
}
