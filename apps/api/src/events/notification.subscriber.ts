import { MembershipRole, NotificationType, ScheduleStatus } from "@prisma/client";
import type {
  CertificationEventPayload,
  LeaveRequestEventPayload,
  OpenShiftClaimEventPayload,
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

  bus.on("timeEntry.adjusted", async (payload) => {
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.TIME_ENTRY_ADJUSTED,
      title: "Time entry adjusted",
      body: `A manager adjusted your time entry (${payload.minutesWorked} minutes recorded).`,
      payload: { timeEntryId: payload.timeEntryId, status: payload.status },
      employeeIds: [payload.employeeId],
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("timeEntry.approved", async (payload) => {
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.TIME_ENTRY_APPROVED,
      title: "Time entry approved",
      body: "Your recorded hours were approved.",
      payload: { timeEntryId: payload.timeEntryId, status: payload.status },
      employeeIds: [payload.employeeId],
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("openShift.published", async (payload) => {
    if (!payload.eligibleEmployeeIds?.length) return;
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.OPEN_SHIFT_PUBLISHED,
      title: "New open shift",
      body: `An open shift on ${payload.date} (${payload.startTime}–${payload.endTime}) is available to claim.`,
      payload: { openShiftId: payload.openShiftId, date: payload.date },
      employeeIds: payload.eligibleEmployeeIds,
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("openShift.claimed", async (payload) => {
    const managers = await managerUserIds(payload.organizationId);
    if (managers.length === 0) return;
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.OPEN_SHIFT_CLAIMED,
      title: "Open shift claimed",
      body: `An employee claimed the open shift on ${payload.date} and needs approval.`,
      payload: claimPayload(payload),
      recipientUserIds: managers,
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("openShift.claimApproved", async (payload) => {
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.OPEN_SHIFT_CLAIM_APPROVED,
      title: "Open shift approved",
      body: `Your claim for the shift on ${payload.date} was approved.`,
      payload: claimPayload(payload),
      employeeIds: [payload.employeeId],
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("openShift.claimRejected", async (payload) => {
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.OPEN_SHIFT_CLAIM_REJECTED,
      title: "Open shift claim rejected",
      body: `Your claim for the shift on ${payload.date} was rejected.`,
      payload: claimPayload(payload),
      employeeIds: [payload.employeeId],
      excludeUserIds: payload.actorId ? [payload.actorId] : [],
    });
  });

  bus.on("certification.expiring", async (payload) => {
    await notifyCertification(
      service,
      payload,
      NotificationType.CERTIFICATION_EXPIRING,
      `${payload.name} expires on ${payload.expiresAt ?? "soon"}.`,
    );
  });

  bus.on("certification.expired", async (payload) => {
    await notifyCertification(
      service,
      payload,
      NotificationType.CERTIFICATION_EXPIRED,
      `${payload.name} has expired and must be renewed.`,
    );
  });

  bus.on("subscription.updated", async (payload) => {
    const owners = await prisma.membership.findMany({
      where: { organizationId: payload.organizationId, role: MembershipRole.OWNER },
      select: { userId: true },
    });
    if (owners.length === 0) return;
    await service.notify({
      organizationId: payload.organizationId,
      type: NotificationType.SUBSCRIPTION_UPDATED,
      title: "Subscription updated",
      body: `Your plan is now ${payload.plan} (${payload.status}).`,
      payload: { plan: payload.plan, status: payload.status },
      recipientUserIds: owners.map((owner) => owner.userId),
    });
  });
}

async function managerUserIds(organizationId: string): Promise<string[]> {
  const managers = await prisma.membership.findMany({
    where: {
      organizationId,
      role: { in: [MembershipRole.OWNER, MembershipRole.MANAGER] },
    },
    select: { userId: true },
  });
  return managers.map((manager) => manager.userId);
}

function claimPayload(payload: OpenShiftClaimEventPayload) {
  return {
    openShiftId: payload.openShiftId,
    claimId: payload.claimId,
    date: payload.date,
    status: payload.status,
  };
}

async function notifyCertification(
  service: NotificationService,
  payload: CertificationEventPayload,
  type: NotificationType,
  body: string,
): Promise<void> {
  const managers = await managerUserIds(payload.organizationId);
  await service.notify({
    organizationId: payload.organizationId,
    type,
    title: type === NotificationType.CERTIFICATION_EXPIRED ? "Certification expired" : "Certification expiring",
    body,
    payload: {
      certificationId: payload.certificationId,
      name: payload.name,
      status: payload.status,
      expiresAt: payload.expiresAt ?? null,
    },
    employeeIds: [payload.employeeId],
    recipientUserIds: managers,
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
