import {
  AvailabilityType,
  ClaimStatus,
  EmployeeStatus,
  OpenShiftStatus,
  Prisma,
  ScheduleChangeType,
} from "@prisma/client";
import {
  ScheduleUpdateKind,
  splitViolations,
  toDateOnly,
  type OpenShiftClaimEventPayload,
  type OpenShiftEventPayload,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { eventBus } from "../events";
import { AuditService } from "./audit.service";
import { realtimeService } from "./realtime.service";
import { ScheduleHistoryService } from "./schedule-history.service";
import { ScheduleValidationService } from "./schedule-validation.service";

export interface OpenShiftFilter {
  scheduleId?: string | null;
  roleId?: string | null;
  locationId?: string | null;
  status?: OpenShiftStatus | null;
  from?: string | null;
  to?: string | null;
  /** Restrict to shifts the employee may actually take (skills/availability/role). */
  eligibleForEmployeeId?: string | null;
}

export interface PublishOpenShiftInput {
  scheduleId: string;
  date: string;
  shiftTemplateId: string;
  roleId: string;
  requiredCount?: number | null;
  locationId?: string | null;
  note?: string | null;
}

const auditService = new AuditService();
const historyService = new ScheduleHistoryService();
const validationService = new ScheduleValidationService();

type OpenShiftWithTemplate = Prisma.OpenShiftGetPayload<{ include: { shiftTemplate: true } }>;

/** Open shift marketplace: publish → employees claim → manager approves. */
export class OpenShiftService {
  async list(organizationId: string, filter: OpenShiftFilter = {}) {
    const shifts = await prisma.openShift.findMany({
      where: {
        organizationId,
        ...(filter.scheduleId ? { scheduleId: filter.scheduleId } : {}),
        ...(filter.roleId ? { roleId: filter.roleId } : {}),
        ...(filter.locationId ? { locationId: filter.locationId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.from || filter.to
          ? {
              date: {
                ...(filter.from ? { gte: new Date(`${filter.from}T00:00:00.000Z`) } : {}),
                ...(filter.to ? { lte: new Date(`${filter.to}T00:00:00.000Z`) } : {}),
              },
            }
          : {}),
      },
      include: { shiftTemplate: { include: { requiredSkills: { select: { id: true } } } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    if (!filter.eligibleForEmployeeId) return shifts;
    return this.filterEligible(organizationId, filter.eligibleForEmployeeId, shifts);
  }

  async getById(organizationId: string, id: string) {
    const shift = await prisma.openShift.findFirst({
      where: { id, organizationId },
      include: { shiftTemplate: true },
    });
    if (!shift) throw new Error("Open shift not found");
    return shift;
  }

  async listClaims(
    organizationId: string,
    filter: { openShiftId?: string | null; employeeId?: string | null; status?: ClaimStatus | null } = {},
  ) {
    return prisma.openShiftClaim.findMany({
      where: {
        organizationId,
        ...(filter.openShiftId ? { openShiftId: filter.openShiftId } : {}),
        ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async publish(organizationId: string, userId: string, input: PublishOpenShiftInput) {
    const [schedule, template, role] = await Promise.all([
      prisma.schedule.findFirst({ where: { id: input.scheduleId, organizationId } }),
      prisma.shiftTemplate.findFirst({ where: { id: input.shiftTemplateId, organizationId } }),
      prisma.role.findFirst({ where: { id: input.roleId, organizationId } }),
    ]);
    if (!schedule) throw new Error("Schedule not found");
    if (!template) throw new Error("Shift template not found");
    if (!role) throw new Error("Role not found");

    const shift = await prisma.openShift.create({
      data: {
        organizationId,
        scheduleId: schedule.id,
        locationId: input.locationId ?? schedule.locationId,
        date: new Date(`${input.date}T00:00:00.000Z`),
        shiftTemplateId: template.id,
        roleId: role.id,
        requiredCount: Math.max(1, input.requiredCount ?? 1),
        note: input.note?.trim() || null,
      },
      include: { shiftTemplate: true },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "OPEN_SHIFT_PUBLISHED",
      entity: "OpenShift",
      entityId: shift.id,
      meta: { scheduleId: schedule.id, date: input.date, roleId: role.id },
    });
    eventBus.emit("openShift.published", await this.shiftPayload(shift, userId));
    return shift;
  }

  /** Creates open shifts for every requirement that is not fully staffed. */
  async generateFromRequirements(organizationId: string, userId: string, scheduleId: string) {
    const requirements = await prisma.shiftRequirement.findMany({
      where: { organizationId, scheduleId },
      include: { shiftTemplate: true },
    });
    const created: OpenShiftWithTemplate[] = [];
    for (const requirement of requirements) {
      const [assignedCount, existing] = await Promise.all([
        prisma.shiftAssignment.count({
          where: {
            organizationId,
            scheduleId,
            date: requirement.date,
            shiftTemplateId: requirement.shiftTemplateId,
            roleId: requirement.roleId,
          },
        }),
        prisma.openShift.findFirst({
          where: {
            organizationId,
            scheduleId,
            date: requirement.date,
            shiftTemplateId: requirement.shiftTemplateId,
            roleId: requirement.roleId,
            status: OpenShiftStatus.OPEN,
          },
        }),
      ]);
      const missing = requirement.requiredCount - assignedCount;
      if (missing <= 0 || existing) continue;
      created.push(
        await this.publish(organizationId, userId, {
          scheduleId,
          date: toDateOnly(requirement.date),
          shiftTemplateId: requirement.shiftTemplateId,
          roleId: requirement.roleId,
          requiredCount: missing,
          locationId: requirement.locationId,
        }),
      );
    }
    return created;
  }

  async cancel(organizationId: string, userId: string, id: string) {
    const shift = await this.getById(organizationId, id);
    if (shift.status === OpenShiftStatus.CANCELLED) throw new Error("Open shift already cancelled");
    const cancelled = await prisma.$transaction(async (tx) => {
      await tx.openShiftClaim.updateMany({
        where: { openShiftId: id, status: ClaimStatus.PENDING },
        data: { status: ClaimStatus.REJECTED, reviewedById: userId, reviewedAt: new Date() },
      });
      return tx.openShift.update({
        where: { id },
        data: { status: OpenShiftStatus.CANCELLED },
        include: { shiftTemplate: true },
      });
    });
    await auditService.log({
      userId,
      organizationId,
      action: "OPEN_SHIFT_CANCELLED",
      entity: "OpenShift",
      entityId: id,
      meta: { scheduleId: shift.scheduleId, date: toDateOnly(shift.date) },
    });
    return cancelled;
  }

  async claim(
    organizationId: string,
    userId: string,
    input: { openShiftId: string; employeeId: string; message?: string | null },
  ) {
    const shift = await this.getById(organizationId, input.openShiftId);
    if (shift.status !== OpenShiftStatus.OPEN) throw new Error("This shift is no longer open");
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, organizationId },
    });
    if (!employee) throw new Error("Employee not found");
    const existing = await prisma.openShiftClaim.findFirst({
      where: { openShiftId: shift.id, employeeId: employee.id },
    });
    if (existing && existing.status === ClaimStatus.PENDING) {
      throw new Error("You already claimed this shift");
    }

    const claim = existing
      ? await prisma.openShiftClaim.update({
          where: { id: existing.id },
          data: {
            status: ClaimStatus.PENDING,
            message: input.message?.trim() || null,
            reviewedById: null,
            reviewedAt: null,
          },
        })
      : await prisma.openShiftClaim.create({
          data: {
            organizationId,
            openShiftId: shift.id,
            employeeId: employee.id,
            message: input.message?.trim() || null,
          },
        });
    await auditService.log({
      userId,
      organizationId,
      action: "OPEN_SHIFT_CLAIMED",
      entity: "OpenShiftClaim",
      entityId: claim.id,
      meta: { openShiftId: shift.id, employeeId: employee.id },
    });
    eventBus.emit("openShift.claimed", this.claimPayload(claim, shift, userId));
    return claim;
  }

  async withdrawClaim(organizationId: string, userId: string, id: string) {
    const claim = await this.claimById(organizationId, id);
    if (claim.status !== ClaimStatus.PENDING) {
      throw new Error("Only pending claims can be withdrawn");
    }
    const updated = await prisma.openShiftClaim.update({
      where: { id },
      data: { status: ClaimStatus.WITHDRAWN },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "OPEN_SHIFT_CLAIM_WITHDRAWN",
      entity: "OpenShiftClaim",
      entityId: id,
      meta: { openShiftId: claim.openShiftId },
    });
    return updated;
  }

  /** Approving a claim validates conflicts and materializes a ShiftAssignment. */
  async approveClaim(organizationId: string, userId: string, id: string) {
    const claim = await this.claimById(organizationId, id);
    if (claim.status !== ClaimStatus.PENDING) throw new Error("Only pending claims can be approved");
    const shift = await this.getById(organizationId, claim.openShiftId);
    if (shift.status !== OpenShiftStatus.OPEN) throw new Error("This shift is no longer open");

    const date = toDateOnly(shift.date);
    const validation = await validationService.validate(organizationId, {
      scheduleId: shift.scheduleId,
      shiftTemplateId: shift.shiftTemplateId,
      employeeId: claim.employeeId,
      date,
      startTime: shift.shiftTemplate.startTime,
      endTime: shift.shiftTemplate.endTime,
      breakMinutes: shift.shiftTemplate.breakMinutes,
      roleId: shift.roleId,
    });
    const { errors } = splitViolations(validation.violations);
    if (errors.length > 0) {
      throw new Error(
        `Claim blocked: ${errors.map((violation) => violation.message).join("; ")}`,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.shiftAssignment.create({
        data: {
          organizationId,
          scheduleId: shift.scheduleId,
          employeeId: claim.employeeId,
          shiftTemplateId: shift.shiftTemplateId,
          roleId: shift.roleId,
          date: shift.date,
          breakMinutes: shift.shiftTemplate.breakMinutes,
        },
      });
      const filledCount = shift.filledCount + 1;
      const updatedShift = await tx.openShift.update({
        where: { id: shift.id },
        data: {
          filledCount,
          status:
            filledCount >= shift.requiredCount ? OpenShiftStatus.FILLED : OpenShiftStatus.OPEN,
        },
        include: { shiftTemplate: true },
      });
      const updatedClaim = await tx.openShiftClaim.update({
        where: { id },
        data: {
          status: ClaimStatus.APPROVED,
          assignmentId: assignment.id,
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });
      return { assignment, updatedShift, updatedClaim };
    });

    await historyService.record({
      organizationId,
      scheduleId: shift.scheduleId,
      assignmentId: result.assignment.id,
      changeType: ScheduleChangeType.CREATED,
      date: shift.date,
      newEmployeeId: claim.employeeId,
      changedById: userId,
      metadata: { openShiftId: shift.id, claimId: id },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "OPEN_SHIFT_CLAIM_APPROVED",
      entity: "OpenShiftClaim",
      entityId: id,
      meta: {
        openShiftId: shift.id,
        employeeId: claim.employeeId,
        assignmentId: result.assignment.id,
      },
    });
    eventBus.emit(
      "openShift.claimApproved",
      this.claimPayload(result.updatedClaim, shift, userId, result.assignment.id),
    );
    await realtimeService.publishScheduleUpdate({
      organizationId,
      scheduleId: shift.scheduleId,
      kind: ScheduleUpdateKind.ASSIGNMENT_CREATED,
      assignmentIds: [result.assignment.id],
      actorId: userId,
    });
    return result.updatedClaim;
  }

  async rejectClaim(organizationId: string, userId: string, id: string) {
    const claim = await this.claimById(organizationId, id);
    if (claim.status !== ClaimStatus.PENDING) throw new Error("Only pending claims can be rejected");
    const shift = await this.getById(organizationId, claim.openShiftId);
    const updated = await prisma.openShiftClaim.update({
      where: { id },
      data: { status: ClaimStatus.REJECTED, reviewedById: userId, reviewedAt: new Date() },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "OPEN_SHIFT_CLAIM_REJECTED",
      entity: "OpenShiftClaim",
      entityId: id,
      meta: { openShiftId: claim.openShiftId, employeeId: claim.employeeId },
    });
    eventBus.emit("openShift.claimRejected", this.claimPayload(updated, shift, userId));
    return updated;
  }

  private async claimById(organizationId: string, id: string) {
    const claim = await prisma.openShiftClaim.findFirst({ where: { id, organizationId } });
    if (!claim) throw new Error("Open shift claim not found");
    return claim;
  }

  /** Keeps shifts matching the employee's role, skills and weekday availability. */
  private async filterEligible<
    T extends {
      roleId: string;
      date: Date;
      shiftTemplate: { requiredSkills: { id: string }[] };
    },
  >(organizationId: string, employeeId: string, shifts: T[]): Promise<T[]> {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      include: { skills: true, availabilities: true },
    });
    if (!employee || employee.status === EmployeeStatus.DISMISSED) return [];
    const skillIds = new Set(employee.skills.map((skill) => skill.skillId));
    const unavailableDays = new Set(
      employee.availabilities
        .filter((availability) => availability.type === AvailabilityType.UNAVAILABLE)
        .map((availability) => availability.dayOfWeek),
    );
    return shifts.filter((shift) => {
      if (employee.roleId && shift.roleId !== employee.roleId) return false;
      if (unavailableDays.has(shift.date.getUTCDay())) return false;
      return shift.shiftTemplate.requiredSkills.every((skill) => skillIds.has(skill.id));
    });
  }

  private async shiftPayload(
    shift: OpenShiftWithTemplate,
    actorId: string,
  ): Promise<OpenShiftEventPayload> {
    const eligible = await prisma.employee.findMany({
      where: {
        organizationId: shift.organizationId,
        status: { not: EmployeeStatus.DISMISSED },
        AND: [
          { OR: [{ roleId: shift.roleId }, { roleId: null }] },
          ...(shift.locationId
            ? [{ OR: [{ locationId: shift.locationId }, { locationId: null }] }]
            : []),
        ],
      },
      select: { id: true },
    });
    return {
      organizationId: shift.organizationId,
      actorId,
      openShiftId: shift.id,
      scheduleId: shift.scheduleId,
      date: toDateOnly(shift.date),
      startTime: shift.shiftTemplate.startTime,
      endTime: shift.shiftTemplate.endTime,
      roleId: shift.roleId,
      locationId: shift.locationId,
      requiredCount: shift.requiredCount,
      status: shift.status,
      eligibleEmployeeIds: eligible.map((employee) => employee.id),
    };
  }

  private claimPayload(
    claim: { id: string; openShiftId: string; employeeId: string; status: ClaimStatus },
    shift: { organizationId: string; date: Date },
    actorId: string,
    assignmentId: string | null = null,
  ): OpenShiftClaimEventPayload {
    return {
      organizationId: shift.organizationId,
      actorId,
      openShiftId: claim.openShiftId,
      claimId: claim.id,
      employeeId: claim.employeeId,
      date: toDateOnly(shift.date),
      status: claim.status,
      assignmentId,
    };
  }
}

export const openShiftService = new OpenShiftService();
