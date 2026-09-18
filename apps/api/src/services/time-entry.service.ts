import { Prisma, TimeEntrySource, TimeEntryStatus } from "@prisma/client";
import {
  lateMinutes,
  minutesBetween,
  overtimeMinutes,
  paidMinutes,
  roundHours,
  shiftInterval,
  toDateOnly,
  type TimeEntryEventPayload,
  type TimesheetDto,
  type TimesheetRowDto,
  TimeEntryStatus as SharedTimeEntryStatus,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { eventBus } from "../events";
import { AuditService } from "./audit.service";

export interface TimeEntryFilter {
  employeeId?: string | null;
  from?: string | null;
  to?: string | null;
  status?: TimeEntryStatus | null;
  skip?: number | null;
  take?: number | null;
}

export interface TimesheetFilter {
  from: string;
  to: string;
  employeeId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
}

export interface ClockInInput {
  employeeId: string;
  shiftAssignmentId?: string | null;
  source?: TimeEntrySource | null;
  note?: string | null;
  at?: Date | null;
}

export interface AdjustTimeEntryInput {
  clockInAt?: Date | null;
  clockOutAt?: Date | null;
  shiftAssignmentId?: string | null;
  note?: string | null;
}

const auditService = new AuditService();

type AssignmentWithTemplate = Prisma.ShiftAssignmentGetPayload<{
  include: { shiftTemplate: true };
}>;

/** Planned interval of an assignment, resolving template defaults and midnight crossing. */
function plannedInterval(assignment: AssignmentWithTemplate): { start: Date; end: Date } {
  return shiftInterval(
    toDateOnly(assignment.date),
    assignment.startTime ?? assignment.shiftTemplate.startTime,
    assignment.endTime ?? assignment.shiftTemplate.endTime,
  );
}

function plannedMinutesOf(assignment: AssignmentWithTemplate): number {
  return paidMinutes(
    assignment.startTime ?? assignment.shiftTemplate.startTime,
    assignment.endTime ?? assignment.shiftTemplate.endTime,
    assignment.breakMinutes,
  );
}

function dayStart(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function dayEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999Z`);
}

/**
 * Clock-in/out tracking with plan-vs-actual reconciliation. Entries store
 * absolute timestamps, so shifts crossing midnight need no special casing.
 */
export class TimeEntryService {
  async list(organizationId: string, filter: TimeEntryFilter = {}) {
    return prisma.timeEntry.findMany({
      where: {
        organizationId,
        ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.from || filter.to
          ? {
              clockInAt: {
                ...(filter.from ? { gte: dayStart(filter.from) } : {}),
                ...(filter.to ? { lte: dayEnd(filter.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { clockInAt: "desc" },
      skip: filter.skip ?? 0,
      take: Math.min(filter.take ?? 100, 500),
    });
  }

  async getById(organizationId: string, id: string) {
    const entry = await prisma.timeEntry.findFirst({ where: { id, organizationId } });
    if (!entry) throw new Error("Time entry not found");
    return entry;
  }

  /** The employee's still-running entry, if any. */
  async openEntry(organizationId: string, employeeId: string) {
    return prisma.timeEntry.findFirst({
      where: { organizationId, employeeId, status: TimeEntryStatus.OPEN },
      orderBy: { clockInAt: "desc" },
    });
  }

  async clockIn(organizationId: string, userId: string, input: ClockInInput) {
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, organizationId },
    });
    if (!employee) throw new Error("Employee not found");
    const running = await this.openEntry(organizationId, employee.id);
    if (running) throw new Error("There is already an open time entry for this employee");

    const at = input.at ?? new Date();
    const assignmentId =
      input.shiftAssignmentId ?? (await this.matchAssignment(organizationId, employee.id, at));

    const entry = await prisma.timeEntry.create({
      data: {
        organizationId,
        employeeId: employee.id,
        shiftAssignmentId: assignmentId,
        clockInAt: at,
        source: input.source ?? TimeEntrySource.WEB,
        status: TimeEntryStatus.OPEN,
        note: input.note?.trim() || null,
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "TIME_ENTRY_CLOCKED_IN",
      entity: "TimeEntry",
      entityId: entry.id,
      meta: { employeeId: employee.id, shiftAssignmentId: assignmentId },
    });
    eventBus.emit("timeEntry.clockedIn", this.eventPayload(entry, userId));
    return entry;
  }

  async clockOut(
    organizationId: string,
    userId: string,
    input: { employeeId: string; timeEntryId?: string | null; note?: string | null; at?: Date | null },
  ) {
    const entry = input.timeEntryId
      ? await this.getById(organizationId, input.timeEntryId)
      : await this.openEntry(organizationId, input.employeeId);
    if (!entry) throw new Error("No open time entry to close");
    if (entry.employeeId !== input.employeeId) {
      throw new Error("Time entry belongs to another employee");
    }
    if (entry.status !== TimeEntryStatus.OPEN) throw new Error("Time entry is already closed");

    const at = input.at ?? new Date();
    if (at.getTime() <= entry.clockInAt.getTime()) {
      throw new Error("Clock-out must be after clock-in");
    }
    const closed = await prisma.timeEntry.update({
      where: { id: entry.id },
      data: {
        clockOutAt: at,
        status: TimeEntryStatus.CLOSED,
        ...(input.note ? { note: input.note.trim() } : {}),
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "TIME_ENTRY_CLOCKED_OUT",
      entity: "TimeEntry",
      entityId: closed.id,
      meta: { employeeId: closed.employeeId, minutes: minutesBetween(closed.clockInAt, at) },
    });
    eventBus.emit("timeEntry.closed", this.eventPayload(closed, userId));
    return closed;
  }

  async adjust(
    organizationId: string,
    userId: string,
    id: string,
    input: AdjustTimeEntryInput,
  ) {
    const entry = await this.getById(organizationId, id);
    const clockInAt = input.clockInAt ?? entry.clockInAt;
    const clockOutAt = input.clockOutAt ?? entry.clockOutAt;
    if (clockOutAt && clockOutAt.getTime() <= clockInAt.getTime()) {
      throw new Error("Clock-out must be after clock-in");
    }
    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        clockInAt,
        clockOutAt,
        status: TimeEntryStatus.ADJUSTED,
        ...(input.shiftAssignmentId !== undefined
          ? { shiftAssignmentId: input.shiftAssignmentId }
          : {}),
        ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "TIME_ENTRY_ADJUSTED",
      entity: "TimeEntry",
      entityId: id,
      meta: {
        previousClockInAt: entry.clockInAt.toISOString(),
        previousClockOutAt: entry.clockOutAt?.toISOString() ?? null,
        clockInAt: clockInAt.toISOString(),
        clockOutAt: clockOutAt?.toISOString() ?? null,
      },
    });
    eventBus.emit("timeEntry.adjusted", this.eventPayload(updated, userId));
    return updated;
  }

  async approve(organizationId: string, userId: string, id: string) {
    const entry = await this.getById(organizationId, id);
    if (entry.status === TimeEntryStatus.OPEN) {
      throw new Error("An open time entry cannot be approved");
    }
    const approved = await prisma.timeEntry.update({
      where: { id },
      data: { approvedById: userId, approvedAt: new Date() },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "TIME_ENTRY_APPROVED",
      entity: "TimeEntry",
      entityId: id,
      meta: { employeeId: approved.employeeId },
    });
    eventBus.emit("timeEntry.approved", this.eventPayload(approved, userId));
    return approved;
  }

  /** Plan vs. fact table for a period; unplanned entries and missing shifts are flagged. */
  async timesheet(organizationId: string, filter: TimesheetFilter): Promise<TimesheetDto> {
    const from = dayStart(filter.from);
    const to = dayEnd(filter.to);
    const employees = await prisma.employee.findMany({
      where: {
        organizationId,
        ...(filter.employeeId ? { id: filter.employeeId } : {}),
        ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
        ...(filter.locationId ? { locationId: filter.locationId } : {}),
      },
      select: { id: true, firstName: true, lastName: true },
    });
    const employeeIds = employees.map((employee) => employee.id);
    const names = new Map(
      employees.map((employee) => [
        employee.id,
        `${employee.firstName} ${employee.lastName}`.trim(),
      ]),
    );
    if (employeeIds.length === 0) {
      return { from: filter.from, to: filter.to, rows: [], plannedHours: 0, actualHours: 0, overtimeHours: 0 };
    }

    const [assignments, entries] = await Promise.all([
      prisma.shiftAssignment.findMany({
        where: {
          organizationId,
          employeeId: { in: employeeIds },
          date: { gte: from, lte: to },
        },
        include: { shiftTemplate: true },
        orderBy: { date: "asc" },
      }),
      prisma.timeEntry.findMany({
        where: {
          organizationId,
          employeeId: { in: employeeIds },
          clockInAt: { gte: from, lte: to },
        },
        orderBy: { clockInAt: "asc" },
      }),
    ]);

    const entriesByAssignment = new Map<string, (typeof entries)[number]>();
    const looseEntries: typeof entries = [];
    for (const entry of entries) {
      if (entry.shiftAssignmentId) entriesByAssignment.set(entry.shiftAssignmentId, entry);
      else looseEntries.push(entry);
    }

    const rows: TimesheetRowDto[] = [];
    for (const assignment of assignments) {
      const planned = plannedInterval(assignment);
      const plannedMinutes = plannedMinutesOf(assignment);
      const entry = entriesByAssignment.get(assignment.id);
      const actualMinutes = entry
        ? minutesBetween(entry.clockInAt, entry.clockOutAt ?? planned.end)
        : 0;
      rows.push({
        employeeId: assignment.employeeId,
        employeeName: names.get(assignment.employeeId) ?? assignment.employeeId,
        date: toDateOnly(assignment.date),
        shiftAssignmentId: assignment.id,
        timeEntryId: entry?.id ?? null,
        plannedStartAt: planned.start.toISOString(),
        plannedEndAt: planned.end.toISOString(),
        plannedMinutes,
        actualStartAt: entry?.clockInAt.toISOString() ?? null,
        actualEndAt: entry?.clockOutAt?.toISOString() ?? null,
        actualMinutes,
        lateMinutes: lateMinutes(planned.start, entry?.clockInAt ?? null),
        earlyLeaveMinutes: entry?.clockOutAt
          ? minutesBetween(entry.clockOutAt, planned.end)
          : 0,
        overtimeMinutes: entry ? overtimeMinutes(plannedMinutes, actualMinutes) : 0,
        status: entry ? SharedTimeEntryStatus[entry.status] : null,
        approved: !!entry?.approvedAt,
        missing: !entry,
        unplanned: false,
      });
    }

    for (const entry of looseEntries) {
      const actualMinutes = minutesBetween(entry.clockInAt, entry.clockOutAt ?? new Date());
      rows.push({
        employeeId: entry.employeeId,
        employeeName: names.get(entry.employeeId) ?? entry.employeeId,
        date: toDateOnly(entry.clockInAt),
        shiftAssignmentId: null,
        timeEntryId: entry.id,
        plannedStartAt: null,
        plannedEndAt: null,
        plannedMinutes: 0,
        actualStartAt: entry.clockInAt.toISOString(),
        actualEndAt: entry.clockOutAt?.toISOString() ?? null,
        actualMinutes,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: actualMinutes,
        status: SharedTimeEntryStatus[entry.status],
        approved: !!entry.approvedAt,
        missing: false,
        unplanned: true,
      });
    }

    rows.sort(
      (a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName),
    );
    return {
      from: filter.from,
      to: filter.to,
      rows,
      plannedHours: roundHours(rows.reduce((sum, row) => sum + row.plannedMinutes, 0)),
      actualHours: roundHours(rows.reduce((sum, row) => sum + row.actualMinutes, 0)),
      overtimeHours: roundHours(rows.reduce((sum, row) => sum + row.overtimeMinutes, 0)),
    };
  }

  /** Finds the assignment whose planned interval contains (or is nearest to) `at`. */
  private async matchAssignment(
    organizationId: string,
    employeeId: string,
    at: Date,
  ): Promise<string | null> {
    const date = toDateOnly(at);
    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        organizationId,
        employeeId,
        date: { gte: new Date(`${date}T00:00:00.000Z`), lte: new Date(`${date}T00:00:00.000Z`) },
      },
      include: { shiftTemplate: true },
    });
    if (assignments.length === 0) return null;
    let best: { id: string; distance: number } | null = null;
    for (const assignment of assignments) {
      const planned = plannedInterval(assignment);
      const distance =
        at >= planned.start && at <= planned.end
          ? 0
          : Math.min(
              Math.abs(at.getTime() - planned.start.getTime()),
              Math.abs(at.getTime() - planned.end.getTime()),
            );
      if (!best || distance < best.distance) best = { id: assignment.id, distance };
    }
    return best?.id ?? null;
  }

  private eventPayload(
    entry: {
      id: string;
      organizationId: string;
      employeeId: string;
      shiftAssignmentId: string | null;
      clockInAt: Date;
      clockOutAt: Date | null;
      status: TimeEntryStatus;
      source: TimeEntrySource;
    },
    actorId: string,
  ): TimeEntryEventPayload {
    return {
      organizationId: entry.organizationId,
      actorId,
      timeEntryId: entry.id,
      employeeId: entry.employeeId,
      shiftAssignmentId: entry.shiftAssignmentId,
      clockInAt: entry.clockInAt.toISOString(),
      clockOutAt: entry.clockOutAt?.toISOString() ?? null,
      status: entry.status,
      source: entry.source,
      minutesWorked: entry.clockOutAt
        ? minutesBetween(entry.clockInAt, entry.clockOutAt)
        : 0,
    };
  }
}

export const timeEntryService = new TimeEntryService();
