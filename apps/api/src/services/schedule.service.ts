import { ScheduleStatus } from "@prisma/client";
import { addDays, ScheduleUpdateKind, startOfWeek, toDateOnly } from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { eventBus } from "../events";
import { AuditService } from "./audit.service";
import { realtimeService } from "./realtime.service";
import { ScheduleValidationService } from "./schedule-validation.service";

const auditService = new AuditService();
const validationService = new ScheduleValidationService();

/** Optional multi-location / multi-calendar scope for schedule lookups. */
export interface ScheduleScope {
  locationId?: string | null;
  calendarId?: string | null;
}

function scopeWhere(scope: ScheduleScope = {}) {
  return {
    ...(scope.locationId !== undefined && { locationId: scope.locationId }),
    ...(scope.calendarId !== undefined && { calendarId: scope.calendarId }),
  };
}

export class ScheduleService {
  async getByWeek(
    organizationId: string,
    weekStartDate: Date,
    includeDrafts = true,
    scope: ScheduleScope = {},
  ) {
    return prisma.schedule.findFirst({
      where: {
        organizationId,
        weekStartDate: startOfWeek(weekStartDate),
        ...scopeWhere(scope),
        ...(includeDrafts ? {} : { status: ScheduleStatus.PUBLISHED }),
      },
      include: { assignments: true, requirements: true },
    });
  }

  async getById(organizationId: string, id: string, includeDrafts = true) {
    return prisma.schedule.findFirst({
      where: {
        organizationId,
        id,
        ...(includeDrafts ? {} : { status: ScheduleStatus.PUBLISHED }),
      },
      include: { assignments: true, requirements: true },
    });
  }

  async list(
    organizationId: string,
    status?: ScheduleStatus,
    skip?: number,
    take?: number,
    includeDrafts = true,
    scope: ScheduleScope = {},
  ) {
    return prisma.schedule.findMany({
      where: {
        organizationId,
        ...scopeWhere(scope),
        ...(status ? { status } : {}),
        ...(includeDrafts ? {} : { status: ScheduleStatus.PUBLISHED }),
      },
      orderBy: { weekStartDate: "desc" },
      skip: skip ?? 0,
      take: Math.min(take ?? 50, 200),
      include: { assignments: true, requirements: true },
    });
  }

  async createDraft(
    organizationId: string,
    userId: string,
    weekStartDate: Date,
    scope: ScheduleScope = {},
  ) {
    const normalized = startOfWeek(weekStartDate);
    const locationId = scope.locationId ?? null;
    const calendarId = scope.calendarId ?? null;
    const existing = await prisma.schedule.findFirst({
      where: { organizationId, weekStartDate: normalized, locationId, calendarId },
      include: { assignments: true, requirements: true },
    });
    if (existing) return existing;

    const schedule = await prisma.schedule.create({
      data: { organizationId, weekStartDate: normalized, locationId, calendarId },
      include: { assignments: true, requirements: true },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "SCHEDULE_CREATED",
      entity: "Schedule",
      entityId: schedule.id,
      meta: { weekStartDate: toDateOnly(normalized), locationId, calendarId },
    });
    return schedule;
  }

  async publish(organizationId: string, userId: string, id: string) {
    const schedule = await this.getById(organizationId, id);
    if (!schedule) throw new Error("Schedule not found");
    if (schedule.status !== ScheduleStatus.DRAFT) throw new Error("Only draft schedules can be published");

    const errors = await validationService.validateSchedule(organizationId, id);
    if (errors > 0) {
      throw new Error(`Schedule cannot be published: ${errors} assignment(s) have validation errors`);
    }

    const nextVersion = schedule.version + 1;
    const publishedAt = new Date();
    const snapshot = schedule.assignments.map((assignment) => ({
      id: assignment.id,
      employeeId: assignment.employeeId,
      shiftTemplateId: assignment.shiftTemplateId,
      roleId: assignment.roleId,
      date: toDateOnly(assignment.date),
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      breakMinutes: assignment.breakMinutes,
      status: assignment.status,
      notes: assignment.notes,
    }));
    const result = await prisma.$transaction(async (tx) => {
      await tx.schedule.update({
        where: { id },
        data: {
          status: ScheduleStatus.PUBLISHED,
          version: nextVersion,
          publishedAt,
          publishedById: userId,
        },
      });
      await tx.scheduleVersion.create({
        data: {
          organizationId,
          scheduleId: id,
          version: nextVersion,
          publishedAt,
          publishedById: userId,
          snapshot,
        },
      });
      return tx.schedule.findUniqueOrThrow({
        where: { id },
        include: { assignments: true, requirements: true },
      });
    });
    await auditService.log({
      userId,
      organizationId,
      action: "SCHEDULE_PUBLISHED",
      entity: "Schedule",
      entityId: id,
      meta: { version: nextVersion, assignmentCount: snapshot.length },
    });
    eventBus.emit("schedule.published", {
      organizationId,
      actorId: userId,
      scheduleId: id,
      scheduleName: toDateOnly(schedule.weekStartDate),
      version: nextVersion,
      startDate: toDateOnly(schedule.weekStartDate),
      endDate: toDateOnly(addDays(schedule.weekStartDate, 6)),
      employeeIds: [...new Set(snapshot.map((assignment) => assignment.employeeId))],
    });
    await realtimeService.publishScheduleUpdate({
      organizationId,
      scheduleId: id,
      kind: ScheduleUpdateKind.SCHEDULE_PUBLISHED,
      assignmentIds: snapshot.map((assignment) => assignment.id),
      actorId: userId,
    });
    return result;
  }

  async reopen(organizationId: string, userId: string, id: string) {
    const schedule = await this.getById(organizationId, id);
    if (!schedule) throw new Error("Schedule not found");
    if (schedule.status !== ScheduleStatus.PUBLISHED) {
      throw new Error("Only published schedules can be reopened");
    }
    const reopened = await prisma.schedule.update({
      where: { id },
      data: { status: ScheduleStatus.DRAFT },
      include: { assignments: true, requirements: true },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "SCHEDULE_REOPENED",
      entity: "Schedule",
      entityId: id,
      meta: { version: schedule.version },
    });
    return reopened;
  }
}
