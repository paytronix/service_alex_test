import { ScheduleChangeType, ScheduleStatus } from "@prisma/client";
import {
  BulkOperation,
  ScheduleUpdateKind,
  toDateOnly,
  type BulkItemResultDto,
  type BulkResultDto,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { AuditService } from "./audit.service";
import { realtimeService } from "./realtime.service";
import { ScheduleHistoryService } from "./schedule-history.service";
import { ScheduleValidationService } from "./schedule-validation.service";

export interface BulkAssignItem {
  scheduleId: string;
  employeeId: string;
  shiftTemplateId: string;
  date: Date;
  roleId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  breakMinutes?: number | null;
  notes?: string | null;
  calendarId?: string | null;
}

export interface BulkCopyItem {
  assignmentId: string;
  date: Date;
  employeeId?: string | null;
}

export interface BulkMoveItem {
  assignmentId: string;
  date?: Date | null;
  employeeId?: string | null;
}

const auditService = new AuditService();
const historyService = new ScheduleHistoryService();
const validationService = new ScheduleValidationService();

function dateOnlyUtc(date: Date): Date {
  return new Date(`${toDateOnly(date)}T00:00:00.000Z`);
}

/**
 * Bulk scheduler edits. Every item is validated through the shared conflict
 * engine; valid items are written in a single transaction and invalid ones are
 * reported back per item, so a partial failure never leaves half-written rows.
 */
export class BulkShiftService {
  async bulkAssign(
    organizationId: string,
    userId: string,
    items: BulkAssignItem[],
  ): Promise<BulkResultDto> {
    const results: BulkItemResultDto[] = [];
    const accepted: Array<{ index: number; data: Parameters<typeof prisma.shiftAssignment.create>[0]["data"] }> = [];
    const scheduleIds = new Set<string>();

    for (const [index, item] of items.entries()) {
      try {
        const [schedule, employee, template] = await Promise.all([
          prisma.schedule.findFirst({ where: { id: item.scheduleId, organizationId } }),
          prisma.employee.findFirst({ where: { id: item.employeeId, organizationId } }),
          prisma.shiftTemplate.findFirst({ where: { id: item.shiftTemplateId, organizationId } }),
        ]);
        if (!schedule) throw new Error("Schedule not found");
        if (schedule.status !== ScheduleStatus.DRAFT) throw new Error("Published schedules cannot be changed");
        if (!employee) throw new Error("Employee not found");
        if (!template) throw new Error("Shift template not found");

        const date = dateOnlyUtc(item.date);
        const roleId = item.roleId === undefined ? template.roleId : item.roleId;
        const startTime = item.startTime ?? template.startTime;
        const endTime = item.endTime ?? template.endTime;
        const breakMinutes = item.breakMinutes ?? template.breakMinutes;
        const validation = await validationService.validate(organizationId, {
          id: null,
          scheduleId: item.scheduleId,
          shiftTemplateId: item.shiftTemplateId,
          employeeId: item.employeeId,
          date: toDateOnly(date),
          startTime,
          endTime,
          breakMinutes,
          roleId: roleId ?? null,
        });
        if (validation.hasErrors) {
          results.push({
            index,
            success: false,
            errors: validation.violations.filter((violation) => violation.level === "ERROR"),
            message: "Conflicts prevent this assignment",
          });
          continue;
        }
        accepted.push({
          index,
          data: {
            organizationId,
            scheduleId: item.scheduleId,
            employeeId: item.employeeId,
            shiftTemplateId: item.shiftTemplateId,
            roleId: roleId ?? null,
            calendarId: item.calendarId ?? schedule.calendarId,
            date,
            startTime: item.startTime ?? null,
            endTime: item.endTime ?? null,
            breakMinutes,
            notes: item.notes ?? null,
          },
        });
        scheduleIds.add(item.scheduleId);
        results.push({ index, success: true, errors: [] });
      } catch (error) {
        results.push({ index, success: false, errors: [], message: (error as Error).message });
      }
    }

    const created = await prisma.$transaction(
      accepted.map((entry) => prisma.shiftAssignment.create({ data: entry.data })),
    );
    created.forEach((assignment, position) => {
      const result = results.find((item) => item.index === accepted[position].index);
      if (result) result.assignmentId = assignment.id;
    });

    for (const assignment of created) {
      await historyService.record({
        organizationId,
        scheduleId: assignment.scheduleId,
        assignmentId: assignment.id,
        changeType: ScheduleChangeType.CREATED,
        date: assignment.date,
        newEmployeeId: assignment.employeeId,
        changedById: userId,
      });
    }
    return this.finish(organizationId, userId, BulkOperation.ASSIGN, results, scheduleIds);
  }

  async bulkRemove(
    organizationId: string,
    userId: string,
    assignmentIds: string[],
  ): Promise<BulkResultDto> {
    const results: BulkItemResultDto[] = [];
    const removable: Array<{ index: number; id: string; scheduleId: string; employeeId: string; date: Date }> = [];
    const scheduleIds = new Set<string>();

    for (const [index, id] of assignmentIds.entries()) {
      const assignment = await prisma.shiftAssignment.findFirst({
        where: { id, organizationId },
        include: { schedule: { select: { status: true } } },
      });
      if (!assignment) {
        results.push({ index, success: false, errors: [], message: "Shift assignment not found" });
        continue;
      }
      if (assignment.schedule.status !== ScheduleStatus.DRAFT) {
        results.push({
          index,
          success: false,
          errors: [],
          message: "Published schedules cannot be changed",
        });
        continue;
      }
      removable.push({
        index,
        id,
        scheduleId: assignment.scheduleId,
        employeeId: assignment.employeeId,
        date: assignment.date,
      });
      scheduleIds.add(assignment.scheduleId);
      results.push({ index, success: true, assignmentId: id, errors: [] });
    }

    if (removable.length > 0) {
      await prisma.$transaction(
        removable.map((entry) => prisma.shiftAssignment.delete({ where: { id: entry.id } })),
      );
      for (const entry of removable) {
        await historyService.record({
          organizationId,
          scheduleId: entry.scheduleId,
          assignmentId: entry.id,
          changeType: ScheduleChangeType.REMOVED,
          date: entry.date,
          previousEmployeeId: entry.employeeId,
          changedById: userId,
        });
      }
    }
    return this.finish(organizationId, userId, BulkOperation.REMOVE, results, scheduleIds);
  }

  async bulkCopy(
    organizationId: string,
    userId: string,
    items: BulkCopyItem[],
  ): Promise<BulkResultDto> {
    const assignItems: BulkAssignItem[] = [];
    const failures: BulkItemResultDto[] = [];
    const indexMap: number[] = [];

    for (const [index, item] of items.entries()) {
      const source = await prisma.shiftAssignment.findFirst({
        where: { id: item.assignmentId, organizationId },
      });
      if (!source) {
        failures.push({ index, success: false, errors: [], message: "Shift assignment not found" });
        continue;
      }
      indexMap.push(index);
      assignItems.push({
        scheduleId: source.scheduleId,
        employeeId: item.employeeId ?? source.employeeId,
        shiftTemplateId: source.shiftTemplateId,
        date: item.date,
        roleId: source.roleId,
        startTime: source.startTime,
        endTime: source.endTime,
        breakMinutes: source.breakMinutes,
        notes: source.notes,
        calendarId: source.calendarId,
      });
    }

    const assigned = await this.bulkAssign(organizationId, userId, assignItems);
    const results = [
      ...failures,
      ...assigned.results.map((result) => ({ ...result, index: indexMap[result.index] })),
    ].sort((left, right) => left.index - right.index);
    return {
      operation: BulkOperation.COPY,
      successCount: results.filter((result) => result.success).length,
      failureCount: results.filter((result) => !result.success).length,
      results,
    };
  }

  async bulkMove(
    organizationId: string,
    userId: string,
    items: BulkMoveItem[],
  ): Promise<BulkResultDto> {
    const results: BulkItemResultDto[] = [];
    const updates: Array<{
      index: number;
      id: string;
      scheduleId: string;
      previousEmployeeId: string;
      employeeId: string;
      date: Date;
    }> = [];
    const scheduleIds = new Set<string>();

    for (const [index, item] of items.entries()) {
      try {
        const existing = await prisma.shiftAssignment.findFirst({
          where: { id: item.assignmentId, organizationId },
          include: { shiftTemplate: true, schedule: { select: { status: true } } },
        });
        if (!existing) throw new Error("Shift assignment not found");
        if (existing.schedule.status !== ScheduleStatus.DRAFT) {
          throw new Error("Published schedules cannot be changed");
        }
        const employeeId = item.employeeId ?? existing.employeeId;
        if (item.employeeId) {
          const employee = await prisma.employee.findFirst({
            where: { id: item.employeeId, organizationId },
          });
          if (!employee) throw new Error("Employee not found");
        }
        const date = dateOnlyUtc(item.date ?? existing.date);
        const validation = await validationService.validate(organizationId, {
          id: existing.id,
          scheduleId: existing.scheduleId,
          shiftTemplateId: existing.shiftTemplateId,
          employeeId,
          date: toDateOnly(date),
          startTime: existing.startTime ?? existing.shiftTemplate.startTime,
          endTime: existing.endTime ?? existing.shiftTemplate.endTime,
          breakMinutes: existing.breakMinutes,
          roleId: existing.roleId,
        });
        if (validation.hasErrors) {
          results.push({
            index,
            success: false,
            assignmentId: existing.id,
            errors: validation.violations.filter((violation) => violation.level === "ERROR"),
            message: "Conflicts prevent this move",
          });
          continue;
        }
        updates.push({
          index,
          id: existing.id,
          scheduleId: existing.scheduleId,
          previousEmployeeId: existing.employeeId,
          employeeId,
          date,
        });
        scheduleIds.add(existing.scheduleId);
        results.push({ index, success: true, assignmentId: existing.id, errors: [] });
      } catch (error) {
        results.push({ index, success: false, errors: [], message: (error as Error).message });
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((entry) =>
          prisma.shiftAssignment.update({
            where: { id: entry.id },
            data: { employeeId: entry.employeeId, date: entry.date },
          }),
        ),
      );
      for (const entry of updates) {
        await historyService.record({
          organizationId,
          scheduleId: entry.scheduleId,
          assignmentId: entry.id,
          changeType:
            entry.previousEmployeeId === entry.employeeId
              ? ScheduleChangeType.MOVED
              : ScheduleChangeType.REPLACED,
          date: entry.date,
          previousEmployeeId: entry.previousEmployeeId,
          newEmployeeId: entry.employeeId,
          changedById: userId,
        });
      }
    }
    return this.finish(organizationId, userId, BulkOperation.MOVE, results, scheduleIds);
  }

  private async finish(
    organizationId: string,
    userId: string,
    operation: BulkOperation,
    results: BulkItemResultDto[],
    scheduleIds: Set<string>,
  ): Promise<BulkResultDto> {
    const successCount = results.filter((result) => result.success).length;
    const failureCount = results.length - successCount;
    if (successCount > 0) {
      await auditService.log({
        userId,
        organizationId,
        action: "SHIFTS_BULK_UPDATED",
        entity: "ShiftAssignment",
        meta: { operation, successCount, failureCount },
      });
      for (const scheduleId of scheduleIds) {
        await realtimeService.publishScheduleUpdate({
          organizationId,
          scheduleId,
          kind: ScheduleUpdateKind.BULK_CHANGE,
          assignmentIds: results
            .filter((result) => result.success && result.assignmentId)
            .map((result) => result.assignmentId as string),
          actorId: userId,
        });
      }
    }
    return { operation, successCount, failureCount, results };
  }
}

export const bulkShiftService = new BulkShiftService();
