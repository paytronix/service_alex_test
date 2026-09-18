import { ScheduleChangeType, ShiftSwapStatus } from "@prisma/client";
import { ScheduleUpdateKind, toDateOnly, type ShiftSwapEventPayload } from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { eventBus } from "../events";
import { AuditService } from "./audit.service";
import { realtimeService } from "./realtime.service";
import { ScheduleHistoryService } from "./schedule-history.service";
import { ScheduleValidationService } from "./schedule-validation.service";

export interface SwapFilter {
  status?: ShiftSwapStatus | null;
  employeeId?: string | null;
  skip?: number | null;
  take?: number | null;
}

const auditService = new AuditService();
const historyService = new ScheduleHistoryService();
const validationService = new ScheduleValidationService();

const OPEN_STATUSES: ShiftSwapStatus[] = [
  ShiftSwapStatus.PENDING,
  ShiftSwapStatus.ACCEPTED_BY_TARGET,
];

/** Shift swap lifecycle: create → accept (target) → approve/reject (manager). */
export class ShiftSwapService {
  async list(organizationId: string, filter: SwapFilter = {}) {
    return prisma.shiftSwapRequest.findMany({
      where: {
        organizationId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.employeeId
          ? {
              OR: [
                { requestedById: filter.employeeId },
                { targetEmployeeId: filter.employeeId },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: filter.skip ?? 0,
      take: Math.min(filter.take ?? 50, 200),
    });
  }

  async getById(organizationId: string, id: string) {
    const swap = await prisma.shiftSwapRequest.findFirst({ where: { id, organizationId } });
    if (!swap) throw new Error("Shift swap request not found");
    return swap;
  }

  async create(
    organizationId: string,
    userId: string,
    input: { assignmentId: string; targetEmployeeId: string; message?: string | null },
  ) {
    const assignment = await prisma.shiftAssignment.findFirst({
      where: { id: input.assignmentId, organizationId },
      include: { shiftTemplate: true },
    });
    if (!assignment) throw new Error("Shift assignment not found");
    const target = await prisma.employee.findFirst({
      where: { id: input.targetEmployeeId, organizationId },
    });
    if (!target) throw new Error("Target employee not found");
    if (target.id === assignment.employeeId) {
      throw new Error("A shift cannot be swapped with its current owner");
    }
    const duplicate = await prisma.shiftSwapRequest.findFirst({
      where: {
        organizationId,
        assignmentId: assignment.id,
        status: { in: OPEN_STATUSES },
      },
    });
    if (duplicate) throw new Error("This shift already has an open swap request");

    const swap = await prisma.shiftSwapRequest.create({
      data: {
        organizationId,
        assignmentId: assignment.id,
        requestedById: assignment.employeeId,
        targetEmployeeId: target.id,
        message: input.message?.trim() || null,
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "SWAP_REQUEST_CREATED",
      entity: "ShiftSwapRequest",
      entityId: swap.id,
      meta: { assignmentId: assignment.id, targetEmployeeId: target.id },
    });
    eventBus.emit("shiftSwap.requested", this.eventPayload(swap, assignment, userId));
    return swap;
  }

  async accept(organizationId: string, userId: string, id: string) {
    const swap = await this.getById(organizationId, id);
    if (swap.status !== ShiftSwapStatus.PENDING) {
      throw new Error("Only pending swap requests can be accepted");
    }
    const updated = await prisma.shiftSwapRequest.update({
      where: { id },
      data: { status: ShiftSwapStatus.ACCEPTED_BY_TARGET, respondedAt: new Date() },
    });
    const assignment = await this.assignmentOf(organizationId, swap.assignmentId);
    await auditService.log({
      userId,
      organizationId,
      action: "SWAP_REQUEST_ACCEPTED",
      entity: "ShiftSwapRequest",
      entityId: id,
      meta: { assignmentId: swap.assignmentId },
    });
    eventBus.emit("shiftSwap.accepted", this.eventPayload(updated, assignment, userId));
    return updated;
  }

  /** Reassigns the shift to the target employee after validating conflicts. */
  async approve(organizationId: string, userId: string, id: string) {
    const swap = await this.getById(organizationId, id);
    if (swap.status !== ShiftSwapStatus.ACCEPTED_BY_TARGET) {
      throw new Error("Only swaps accepted by the target employee can be approved");
    }
    const assignment = await this.assignmentOf(organizationId, swap.assignmentId);
    const validation = await validationService.validate(organizationId, {
      id: assignment.id,
      scheduleId: assignment.scheduleId,
      shiftTemplateId: assignment.shiftTemplateId,
      employeeId: swap.targetEmployeeId,
      date: toDateOnly(assignment.date),
      startTime: assignment.startTime ?? assignment.shiftTemplate.startTime,
      endTime: assignment.endTime ?? assignment.shiftTemplate.endTime,
      breakMinutes: assignment.breakMinutes,
      roleId: assignment.roleId,
    });
    const errors = validation.violations.filter((violation) => violation.level === "ERROR");
    if (errors.length > 0) {
      throw new Error(
        `Swap blocked: ${errors.map((violation) => violation.message).join("; ")}`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.shiftAssignment.update({
        where: { id: assignment.id },
        data: { employeeId: swap.targetEmployeeId },
      });
      return tx.shiftSwapRequest.update({
        where: { id },
        data: {
          status: ShiftSwapStatus.APPROVED,
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });
    });

    await historyService.record({
      organizationId,
      scheduleId: assignment.scheduleId,
      assignmentId: assignment.id,
      changeType: ScheduleChangeType.REPLACED,
      date: assignment.date,
      previousEmployeeId: swap.requestedById,
      newEmployeeId: swap.targetEmployeeId,
      changedById: userId,
      metadata: { swapRequestId: id },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "SWAP_REQUEST_APPROVED",
      entity: "ShiftSwapRequest",
      entityId: id,
      meta: {
        assignmentId: assignment.id,
        previousEmployeeId: swap.requestedById,
        newEmployeeId: swap.targetEmployeeId,
      },
    });
    eventBus.emit("shiftSwap.approved", this.eventPayload(updated, assignment, userId));
    await realtimeService.publishScheduleUpdate({
      organizationId,
      scheduleId: assignment.scheduleId,
      kind: ScheduleUpdateKind.SWAP_APPROVED,
      assignmentIds: [assignment.id],
      actorId: userId,
    });
    await realtimeService.publishAssignmentChange({
      organizationId,
      scheduleId: assignment.scheduleId,
      assignmentId: assignment.id,
      kind: ScheduleUpdateKind.SWAP_APPROVED,
      employeeId: swap.targetEmployeeId,
      date: assignment.date,
      actorId: userId,
    });
    return updated;
  }

  async reject(organizationId: string, userId: string, id: string) {
    const swap = await this.getById(organizationId, id);
    if (!OPEN_STATUSES.includes(swap.status)) {
      throw new Error("Only open swap requests can be rejected");
    }
    const updated = await prisma.shiftSwapRequest.update({
      where: { id },
      data: { status: ShiftSwapStatus.REJECTED, reviewedById: userId, reviewedAt: new Date() },
    });
    const assignment = await this.assignmentOf(organizationId, swap.assignmentId);
    await auditService.log({
      userId,
      organizationId,
      action: "SWAP_REQUEST_REJECTED",
      entity: "ShiftSwapRequest",
      entityId: id,
      meta: { assignmentId: swap.assignmentId },
    });
    eventBus.emit("shiftSwap.rejected", this.eventPayload(updated, assignment, userId));
    return updated;
  }

  async cancel(organizationId: string, userId: string, id: string) {
    const swap = await this.getById(organizationId, id);
    if (!OPEN_STATUSES.includes(swap.status)) {
      throw new Error("Only open swap requests can be cancelled");
    }
    const updated = await prisma.shiftSwapRequest.update({
      where: { id },
      data: { status: ShiftSwapStatus.CANCELLED },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "SWAP_REQUEST_CANCELLED",
      entity: "ShiftSwapRequest",
      entityId: id,
      meta: { assignmentId: swap.assignmentId },
    });
    return updated;
  }

  private async assignmentOf(organizationId: string, assignmentId: string) {
    const assignment = await prisma.shiftAssignment.findFirst({
      where: { id: assignmentId, organizationId },
      include: { shiftTemplate: true },
    });
    if (!assignment) throw new Error("Shift assignment not found");
    return assignment;
  }

  private eventPayload(
    swap: {
      id: string;
      organizationId: string;
      assignmentId: string;
      requestedById: string;
      targetEmployeeId: string;
      status: ShiftSwapStatus;
      message: string | null;
    },
    assignment: {
      scheduleId: string;
      date: Date;
      startTime: string | null;
      endTime: string | null;
      shiftTemplate: { startTime: string; endTime: string };
    },
    actorId: string,
  ): ShiftSwapEventPayload {
    return {
      organizationId: swap.organizationId,
      actorId,
      swapRequestId: swap.id,
      assignmentId: swap.assignmentId,
      scheduleId: assignment.scheduleId,
      date: toDateOnly(assignment.date),
      startTime: assignment.startTime ?? assignment.shiftTemplate.startTime,
      endTime: assignment.endTime ?? assignment.shiftTemplate.endTime,
      requestedById: swap.requestedById,
      targetEmployeeId: swap.targetEmployeeId,
      status: swap.status,
      message: swap.message,
    };
  }
}

export const shiftSwapService = new ShiftSwapService();
