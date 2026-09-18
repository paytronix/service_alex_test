import { EmployeeStatus, LeaveStatus, LeaveType, Prisma } from "@prisma/client";
import { datesOverlap, toDateOnly } from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { eventBus } from "../events";
import { assertDateRange } from "../utils/employee";
import { AuditService } from "./audit.service";

export interface LeaveRequestFilter {
  employeeId?: string;
  status?: LeaveStatus;
}

export interface CreateLeaveRequestInput {
  employeeId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason?: string;
}

const ACTIVE_STATUSES: LeaveStatus[] = [LeaveStatus.PENDING, LeaveStatus.APPROVED];

const auditService = new AuditService();

export class LeaveRequestService {
  async list(organizationId: string, filter: LeaveRequestFilter = {}) {
    const where: Prisma.LeaveRequestWhereInput = {
      organizationId,
      ...(filter.employeeId && { employeeId: filter.employeeId }),
      ...(filter.status && { status: filter.status }),
    };
    return prisma.leaveRequest.findMany({ where, orderBy: { startDate: "desc" } });
  }

  async getById(organizationId: string, id: string) {
    const leaveRequest = await prisma.leaveRequest.findFirst({ where: { id, organizationId } });
    if (!leaveRequest) throw new Error("Leave request not found");
    return leaveRequest;
  }

  async create(organizationId: string, userId: string, input: CreateLeaveRequestInput) {
    assertDateRange(input.startDate, input.endDate);
    await this.assertNoOverlap(organizationId, input.employeeId, input.startDate, input.endDate);

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        organizationId,
        employeeId: input.employeeId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason?.trim() || null,
      },
    });

    await auditService.log({
      userId,
      organizationId,
      action: "LEAVE_REQUEST_CREATED",
      entity: "LeaveRequest",
      entityId: leaveRequest.id,
      meta: { employeeId: leaveRequest.employeeId, type: leaveRequest.type },
    });

    return leaveRequest;
  }

  async approve(organizationId: string, userId: string, id: string) {
    const pending = await this.assertPending(organizationId, id);

    const leaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.APPROVED, reviewedById: userId, reviewedAt: new Date() },
    });

    const status = employeeStatusForLeave(leaveRequest.type);
    if (status && isActiveNow(leaveRequest.startDate, leaveRequest.endDate)) {
      await prisma.employee.update({ where: { id: pending.employeeId }, data: { status } });
    }

    await auditService.log({
      userId,
      organizationId,
      action: "LEAVE_REQUEST_APPROVED",
      entity: "LeaveRequest",
      entityId: id,
      meta: { employeeId: leaveRequest.employeeId },
    });

    eventBus.emit("leaveRequest.approved", leaveEventPayload(organizationId, userId, leaveRequest));

    return leaveRequest;
  }

  async reject(organizationId: string, userId: string, id: string) {
    await this.assertPending(organizationId, id);

    const leaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.REJECTED, reviewedById: userId, reviewedAt: new Date() },
    });

    await auditService.log({
      userId,
      organizationId,
      action: "LEAVE_REQUEST_REJECTED",
      entity: "LeaveRequest",
      entityId: id,
      meta: { employeeId: leaveRequest.employeeId },
    });

    eventBus.emit("leaveRequest.rejected", leaveEventPayload(organizationId, userId, leaveRequest));

    return leaveRequest;
  }

  async cancel(organizationId: string, userId: string, id: string) {
    await this.assertPending(organizationId, id);

    const leaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
    });

    await auditService.log({
      userId,
      organizationId,
      action: "LEAVE_REQUEST_CANCELLED",
      entity: "LeaveRequest",
      entityId: id,
      meta: { employeeId: leaveRequest.employeeId },
    });

    return leaveRequest;
  }

  private async assertPending(organizationId: string, id: string) {
    const leaveRequest = await this.getById(organizationId, id);
    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new Error(`Leave request has already been ${leaveRequest.status.toLowerCase()}`);
    }
    return leaveRequest;
  }

  private async assertNoOverlap(
    organizationId: string,
    employeeId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const existing = await prisma.leaveRequest.findMany({
      where: { organizationId, employeeId, status: { in: ACTIVE_STATUSES } },
      select: { startDate: true, endDate: true },
    });
    const overlapping = existing.some((leave) =>
      datesOverlap(startDate, endDate, leave.startDate, leave.endDate),
    );
    if (overlapping) {
      throw new Error("Leave request overlaps an existing request for this employee");
    }
  }
}

function leaveEventPayload(
  organizationId: string,
  actorId: string,
  leaveRequest: { id: string; employeeId: string; type: LeaveType; startDate: Date; endDate: Date },
) {
  return {
    organizationId,
    actorId,
    leaveRequestId: leaveRequest.id,
    employeeId: leaveRequest.employeeId,
    leaveType: leaveRequest.type,
    startDate: toDateOnly(leaveRequest.startDate),
    endDate: toDateOnly(leaveRequest.endDate),
  };
}

function employeeStatusForLeave(type: LeaveType): EmployeeStatus | null {
  if (type === LeaveType.SICK) return EmployeeStatus.SICK;
  if (type === LeaveType.VACATION) return EmployeeStatus.VACATION;
  return null;
}

function isActiveNow(startDate: Date, endDate: Date): boolean {
  const now = Date.now();
  return startDate.getTime() <= now && endDate.getTime() >= now;
}
