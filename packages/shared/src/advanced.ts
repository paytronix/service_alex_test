import type { Violation } from "./scheduling";

// ─── Shift swap ──────────────────────────────────────────────

export enum ShiftSwapStatus {
  PENDING = "PENDING",
  ACCEPTED_BY_TARGET = "ACCEPTED_BY_TARGET",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export const SHIFT_SWAP_STATUS_LABELS: Record<ShiftSwapStatus, string> = {
  [ShiftSwapStatus.PENDING]: "Waiting for colleague",
  [ShiftSwapStatus.ACCEPTED_BY_TARGET]: "Waiting for manager",
  [ShiftSwapStatus.APPROVED]: "Approved",
  [ShiftSwapStatus.REJECTED]: "Rejected",
  [ShiftSwapStatus.CANCELLED]: "Cancelled",
};

export interface ShiftSwapRequestDto {
  id: string;
  organizationId: string;
  assignmentId: string;
  requestedById: string;
  targetEmployeeId: string;
  status: ShiftSwapStatus;
  message?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  respondedAt?: string | null;
  createdAt: string;
}

// ─── Attachments ─────────────────────────────────────────────

export enum AttachmentEntityType {
  SHIFT_ASSIGNMENT = "SHIFT_ASSIGNMENT",
  SCHEDULE = "SCHEDULE",
  EMPLOYEE = "EMPLOYEE",
}

export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export function isAllowedAttachmentMimeType(mimeType: string): boolean {
  return (ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export interface AttachmentDto {
  id: string;
  organizationId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  storageKey: string;
  url?: string | null;
  mimeType: string;
  size: number;
  uploadedById?: string | null;
  createdAt: string;
}

export interface ShiftCommentDto {
  id: string;
  organizationId: string;
  assignmentId?: string | null;
  scheduleId?: string | null;
  authorId: string;
  text: string;
  createdAt: string;
}

// ─── Locations & calendars ───────────────────────────────────

export interface LocationDto {
  id: string;
  organizationId: string;
  name: string;
  timezone: string;
  address?: string | null;
  isDefault: boolean;
}

export interface CalendarDto {
  id: string;
  organizationId: string;
  locationId?: string | null;
  name: string;
  color?: string | null;
}

// ─── Recurrence / week templates ─────────────────────────────

export interface RecurringShiftRuleDto {
  id: string;
  organizationId: string;
  weekTemplateId?: string | null;
  dayOfWeek: number;
  shiftTemplateId: string;
  roleId?: string | null;
  employeeId?: string | null;
  requiredCount: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface WeekTemplateDto {
  id: string;
  organizationId: string;
  locationId?: string | null;
  calendarId?: string | null;
  name: string;
  description?: string | null;
  rules?: RecurringShiftRuleDto[];
}

export function isRuleEffectiveOn(
  rule: Pick<RecurringShiftRuleDto, "effectiveFrom" | "effectiveTo">,
  date: Date,
): boolean {
  const time = date.getTime();
  if (rule.effectiveFrom && new Date(rule.effectiveFrom).getTime() > time) return false;
  if (rule.effectiveTo && new Date(rule.effectiveTo).getTime() < time) return false;
  return true;
}

// ─── Bulk operations ─────────────────────────────────────────

export enum BulkOperation {
  ASSIGN = "ASSIGN",
  REMOVE = "REMOVE",
  COPY = "COPY",
  MOVE = "MOVE",
}

export interface BulkItemResultDto {
  index: number;
  success: boolean;
  assignmentId?: string | null;
  errors: Violation[];
  message?: string | null;
}

export interface BulkResultDto {
  operation: BulkOperation;
  successCount: number;
  failureCount: number;
  results: BulkItemResultDto[];
}

// ─── Real-time subscription payloads ─────────────────────────

export enum ScheduleUpdateKind {
  ASSIGNMENT_CREATED = "ASSIGNMENT_CREATED",
  ASSIGNMENT_UPDATED = "ASSIGNMENT_UPDATED",
  ASSIGNMENT_MOVED = "ASSIGNMENT_MOVED",
  ASSIGNMENT_REMOVED = "ASSIGNMENT_REMOVED",
  BULK_CHANGE = "BULK_CHANGE",
  SWAP_APPROVED = "SWAP_APPROVED",
  SCHEDULE_GENERATED = "SCHEDULE_GENERATED",
  SCHEDULE_PUBLISHED = "SCHEDULE_PUBLISHED",
}

export interface ScheduleUpdatedPayload {
  organizationId: string;
  scheduleId: string;
  weekStartDate: string;
  locationId?: string | null;
  calendarId?: string | null;
  kind: ScheduleUpdateKind;
  assignmentIds: string[];
  actorId?: string | null;
  version: number;
  updatedAt: string;
}

export interface ShiftAssignmentChangedPayload {
  organizationId: string;
  scheduleId: string;
  assignmentId: string;
  kind: ScheduleUpdateKind;
  employeeId?: string | null;
  date: string;
  actorId?: string | null;
  updatedAt: string;
}

// ─── Offline draft ───────────────────────────────────────────

export enum OfflineMutationKind {
  ASSIGN = "ASSIGN",
  MOVE = "MOVE",
  UPDATE = "UPDATE",
  REMOVE = "REMOVE",
}

export interface OfflineQueuedMutation {
  id: string;
  kind: OfflineMutationKind;
  scheduleId: string;
  variables: Record<string, unknown>;
  createdAt: string;
}
