import { MembershipRole, NotificationType, ScheduleStatus } from "@prisma/client";
import type {
  LeaveRequestEventPayload,
  SchedulePublishedEventPayload,
  ShiftCommentEventPayload,
  ShiftEventPayload,
  ShiftSwapEventPayload,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { notificationService, NotificationService } from "../services/notification.service";
import type { EventBus } from "./event-bus";

/**
 * Shift changes are only announced once the schedule is visible to employees:
 * drafts are still being edited, so notifying on every move would be noise.
 */
function isVisibleToEmployees(payload: ShiftEventPayload): boolean {
  return payload.scheduleStatus === ScheduleStatus.PUBLISHED || payload.scheduleVersion > 0;
}

export function registerNotificationSubscribers(
  bus: EventBus,
  service: NotificationService = notificationService,
): void {
  bus.on("shift.assigned", async (payload) => {
    if (!isVisibleToEmployees(payload) || !payload.employeeId) return;
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.SHIFT_ASSIGNED,
      title: "New shift assigned",
      body: `You are scheduled on ${payload.date} from ${payload.startTime} to ${payload.endTime}.`,
      payload: shiftPayload(payload),
      employeeIds: [payload.employeeId],
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("shift.changed", async (payload) => {
    if (!isVisibleToEmployees(payload)) return;
    const employeeIds = [payload.employeeId, payload.previousEmployeeId].filter(
      (id): id is string => !!id,
    );
    if (employeeIds.length === 0) return;
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.SHIFT_CHANGED,
      title: "Shift changed",
      body: `Your shift on ${payload.date} was ${payload.changeType.toLowerCase()}.`,
      payload: shiftPayload(payload),
      employeeIds: [...new Set(employeeIds)],
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("leaveRequest.approved", async (payload) => {
    await notifyLeaveDecision(service, payload, NotificationType.REQUEST_APPROVED, "approved");
  });

  bus.on("leaveRequest.rejected", async (payload) => {
    await notifyLeaveDecision(service, payload, NotificationType.REQUEST_REJECTED, "rejected");
  });

  bus.on("schedule.published", async (payload) => {
    if (payload.employeeIds.length === 0) return;
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.SCHEDULE_PUBLISHED,
      title: "Schedule published",
      body: `The schedule for ${payload.startDate} – ${payload.endDate} has been published (version ${payload.version}).`,
      payload: schedulePayload(payload),
      employeeIds: payload.employeeIds,
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("shiftSwap.requested", async (payload) => {
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.SWAP_REQUESTED,
      title: "Shift swap requested",
      body: `A colleague asks you to take their shift on ${payload.date} (${payload.startTime}–${payload.endTime}).`,
      payload: swapPayload(payload),
      employeeIds: [payload.targetEmployeeId],
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("shiftSwap.accepted", async (payload) => {
    await notifyManagers(service, payload, NotificationType.SWAP_ACCEPTED, {
      title: "Shift swap awaiting approval",
      body: `A swap for the shift on ${payload.date} was accepted by the target employee and needs approval.`,
    });
  });

  bus.on("shiftSwap.approved", async (payload) => {
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.SWAP_APPROVED,
      title: "Shift swap approved",
      body: `The swap for the shift on ${payload.date} was approved.`,
      payload: swapPayload(payload),
      employeeIds: [payload.requestedById, payload.targetEmployeeId],
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("shiftSwap.rejected", async (payload) => {
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.SWAP_REJECTED,
      title: "Shift swap rejected",
      body: `The swap for the shift on ${payload.date} was rejected.`,
      payload: swapPayload(payload),
      employeeIds: [payload.requestedById, payload.targetEmployeeId],
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("shiftComment.added", async (payload) => {
    if (payload.recipientEmployeeIds.length === 0) return;
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.SHIFT_COMMENT_ADDED,
      title: "New shift comment",
      body: payload.text.slice(0, 200),
      payload: commentPayload(payload),
      employeeIds: payload.recipientEmployeeIds,
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });
}

async function notifyManagers(
  service: NotificationService,
  payload: ShiftSwapEventPayload,
  type: NotificationType,
  content: { title: string; body: string },
): Promise<void> {
  const managers = await prisma.membership.findMany({
    where: {
      organizationId: payload.organizationId,
      role: { in: [MembershipRole.OWNER, MembershipRole.MANAGER] },
    },
    select: { userId: true },
  });
  if (managers.length === 0) return;
  await service.notify({
    organizationId: payload.organizationId,
    type,
    title: content.title,
    body: content.body,
    payload: swapPayload(payload),
    recipientUserIds: managers.map((manager) => manager.userId),
    excludeUserIds: payload.actorId ? [payload.actorId] : [],
  });
}

function swapPayload(payload: ShiftSwapEventPayload) {
  return {
    swapRequestId: payload.swapRequestId,
    assignmentId: payload.assignmentId,
    scheduleId: payload.scheduleId,
    date: payload.date,
    status: payload.status,
  };
}

function commentPayload(payload: ShiftCommentEventPayload) {
  return {
    commentId: payload.commentId,
    assignmentId: payload.assignmentId,
    scheduleId: payload.scheduleId,
  };
}

async function notifyLeaveDecision(
  service: NotificationService,
  payload: LeaveRequestEventPayload,
  type: NotificationType,
  verb: string,
): Promise<void> {
  const employee = await prisma.employee.findFirst({
    where: { id: payload.employeeId, organizationId: payload.organizationId },
    select: { userId: true },
  });
  if (!employee?.userId) return;
  await service.notify({
    organizationId: payload.organizationId,
    type,
    title: `Leave request ${verb}`,
    body: `Your ${payload.leaveType.toLowerCase()} request for ${payload.startDate} – ${payload.endDate} was ${verb}.`,
    payload: {
      leaveRequestId: payload.leaveRequestId,
      leaveType: payload.leaveType,
      startDate: payload.startDate,
      endDate: payload.endDate,
    },
    recipientUserIds: [employee.userId],
  });
}

function shiftPayload(payload: ShiftEventPayload) {
  return {
    scheduleId: payload.scheduleId,
    assignmentId: payload.assignmentId,
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    changeType: payload.changeType,
  };
}

function schedulePayload(payload: SchedulePublishedEventPayload) {
  return {
    scheduleId: payload.scheduleId,
    version: payload.version,
    startDate: payload.startDate,
    endDate: payload.endDate,
  };
}
