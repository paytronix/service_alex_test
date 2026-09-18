import { ScheduleChangeType, ScheduleStatus } from "@prisma/client";
import {
  CandidateAssignment,
  ScheduleChangeType as SharedScheduleChangeType,
  ScheduleUpdateKind,
  toDateOnly,
  Violation,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { eventBus } from "../events";
import { AuditService } from "./audit.service";
import { realtimeService } from "./realtime.service";
import { ScheduleHistoryService } from "./schedule-history.service";
import { ScheduleValidationService } from "./schedule-validation.service";

export interface ShiftInput {
  scheduleId: string;
  employeeId: string;
  shiftTemplateId: string;
  date: Date;
  roleId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  breakMinutes?: number | null;
  notes?: string | null;
}

export interface ShiftUpdateInput {
  employeeId?: string;
  shiftTemplateId?: string;
  date?: Date;
  roleId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  breakMinutes?: number | null;
  notes?: string | null;
}

export interface ShiftMutationResult {
  assignment: Awaited<ReturnType<ShiftAssignmentService["getById"]>>;
  violations: Violation[];
}

const auditService = new AuditService();
const validationService = new ScheduleValidationService();
const historyService = new ScheduleHistoryService();

function changeTypeFor(previousEmployeeId: string, newEmployeeId: string): ScheduleChangeType {
  return previousEmployeeId === newEmployeeId
    ? ScheduleChangeType.MOVED
    : ScheduleChangeType.REPLACED;
}

export class ShiftAssignmentService {
  async getById(organizationId: string, id: string) {
    const assignment = await prisma.shiftAssignment.findFirst({
      where: { organizationId, id },
      include: { shiftTemplate: true },
    });
    if (!assignment) throw new Error("Shift assignment not found");
    return assignment;
  }

  async assign(organizationId: string, userId: string, input: ShiftInput): Promise<ShiftMutationResult> {
    const references = await this.assertReferences(organizationId, input);
    this.assertDraft(references.schedule.status);
    const values = this.values(input, references.template);
    const validation = await this.validate(organizationId, input.scheduleId, null, {
      ...values,
      employeeId: input.employeeId,
      roleId: values.roleId,
      requiredSkillIds: [],
      shiftTemplateId: input.shiftTemplateId,
    });
    this.assertNoErrors(validation.violations);
    const assignment = await prisma.shiftAssignment.create({
      data: {
        scheduleId: input.scheduleId,
        organizationId,
        employeeId: input.employeeId,
        shiftTemplateId: input.shiftTemplateId,
        roleId: values.roleId,
        date: values.date,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        breakMinutes: values.breakMinutes,
        notes: input.notes ?? null,
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "SHIFT_ASSIGNED",
      entity: "ShiftAssignment",
      entityId: assignment.id,
      meta: { employeeId: assignment.employeeId, date: toDateOnly(assignment.date) },
    });
    await historyService.record({
      organizationId,
      scheduleId: assignment.scheduleId,
      assignmentId: assignment.id,
      changeType: ScheduleChangeType.CREATED,
      date: assignment.date,
      newEmployeeId: assignment.employeeId,
      changedById: userId,
    });
    eventBus.emit("shift.assigned", {
      organizationId,
      actorId: userId,
      scheduleId: assignment.scheduleId,
      scheduleName: toDateOnly(references.schedule.weekStartDate),
      scheduleStatus: references.schedule.status,
      scheduleVersion: references.schedule.version,
      assignmentId: assignment.id,
      date: toDateOnly(assignment.date),
      startTime: assignment.startTime ?? values.startTime,
      endTime: assignment.endTime ?? values.endTime,
      changeType: SharedScheduleChangeType.CREATED,
      employeeId: assignment.employeeId,
      previousEmployeeId: null,
    });
    await realtimeService.publishScheduleUpdate({
      organizationId,
      scheduleId: assignment.scheduleId,
      kind: ScheduleUpdateKind.ASSIGNMENT_CREATED,
      assignmentIds: [assignment.id],
      actorId: userId,
    });
    await realtimeService.publishAssignmentChange({
      organizationId,
      scheduleId: assignment.scheduleId,
      assignmentId: assignment.id,
      kind: ScheduleUpdateKind.ASSIGNMENT_CREATED,
      employeeId: assignment.employeeId,
      date: assignment.date,
      actorId: userId,
    });
    return { assignment: await this.getById(organizationId, assignment.id), violations: validation.violations };
  }

  async move(
    organizationId: string,
    userId: string,
    id: string,
    input: ShiftUpdateInput,
  ): Promise<ShiftMutationResult> {
    return this.updateExisting(organizationId, userId, id, input, "SHIFT_MOVED");
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    input: ShiftUpdateInput,
  ): Promise<ShiftMutationResult> {
    return this.updateExisting(organizationId, userId, id, input, "SHIFT_UPDATED");
  }

  async copy(
    organizationId: string,
    userId: string,
    id: string,
    date: Date,
    employeeId?: string,
  ): Promise<ShiftMutationResult> {
    const source = await this.getById(organizationId, id);
    const result = await this.assign(organizationId, userId, {
      scheduleId: source.scheduleId,
      employeeId: employeeId ?? source.employeeId,
      shiftTemplateId: source.shiftTemplateId,
      date,
      roleId: source.roleId,
      startTime: source.startTime,
      endTime: source.endTime,
      breakMinutes: source.breakMinutes,
      notes: source.notes,
    });
    const copied = await result.assignment;
    await auditService.log({
      userId,
      organizationId,
      action: "SHIFT_COPIED",
      entity: "ShiftAssignment",
      entityId: copied.id,
      meta: { sourceId: id, employeeId: employeeId ?? source.employeeId, date: toDateOnly(date) },
    });
    return result;
  }

  async remove(organizationId: string, userId: string, id: string): Promise<boolean> {
    const assignment = await this.getById(organizationId, id);
    const schedule = await prisma.schedule.findFirst({ where: { id: assignment.scheduleId, organizationId } });
    if (!schedule) throw new Error("Schedule not found");
    this.assertDraft(schedule.status);
    await prisma.shiftAssignment.delete({ where: { id } });
    await auditService.log({
      userId,
      organizationId,
      action: "SHIFT_REMOVED",
      entity: "ShiftAssignment",
      entityId: id,
      meta: { employeeId: assignment.employeeId, date: toDateOnly(assignment.date) },
    });
    await historyService.record({
      organizationId,
      scheduleId: assignment.scheduleId,
      assignmentId: id,
      changeType: ScheduleChangeType.REMOVED,
      date: assignment.date,
      previousEmployeeId: assignment.employeeId,
      changedById: userId,
    });
    eventBus.emit("shift.changed", {
      organizationId,
      actorId: userId,
      scheduleId: assignment.scheduleId,
      scheduleName: toDateOnly(schedule.weekStartDate),
      scheduleStatus: schedule.status,
      scheduleVersion: schedule.version,
      assignmentId: id,
      date: toDateOnly(assignment.date),
      startTime: assignment.startTime ?? assignment.shiftTemplate.startTime,
      endTime: assignment.endTime ?? assignment.shiftTemplate.endTime,
      changeType: SharedScheduleChangeType.REMOVED,
      employeeId: null,
      previousEmployeeId: assignment.employeeId,
    });
    await realtimeService.publishScheduleUpdate({
      organizationId,
      scheduleId: assignment.scheduleId,
      kind: ScheduleUpdateKind.ASSIGNMENT_REMOVED,
      assignmentIds: [id],
      actorId: userId,
    });
    await realtimeService.publishAssignmentChange({
      organizationId,
      scheduleId: assignment.scheduleId,
      assignmentId: id,
      kind: ScheduleUpdateKind.ASSIGNMENT_REMOVED,
      employeeId: assignment.employeeId,
      date: assignment.date,
      actorId: userId,
    });
    return true;
  }

  private async updateExisting(
    organizationId: string,
    userId: string,
    id: string,
    input: ShiftUpdateInput,
    action: "SHIFT_MOVED" | "SHIFT_UPDATED",
  ): Promise<ShiftMutationResult> {
    const existing = await this.getById(organizationId, id);
    const schedule = await prisma.schedule.findFirst({ where: { id: existing.scheduleId, organizationId } });
    if (!schedule) throw new Error("Schedule not found");
    this.assertDraft(schedule.status);
    const values = await this.resolveValues(organizationId, existing, input);
    const validation = await this.validate(organizationId, existing.scheduleId, id, {
      ...values,
      employeeId: values.employeeId,
      roleId: values.roleId,
      requiredSkillIds: [],
      shiftTemplateId: values.shiftTemplateId,
    });
    this.assertNoErrors(validation.violations);
    const assignment = await prisma.shiftAssignment.update({
      where: { id },
      data: {
        employeeId: values.employeeId,
        shiftTemplateId: values.shiftTemplateId,
        roleId: values.roleId,
        date: values.date,
        startTime: input.startTime === undefined ? existing.startTime : input.startTime,
        endTime: input.endTime === undefined ? existing.endTime : input.endTime,
        breakMinutes: values.breakMinutes,
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action,
      entity: "ShiftAssignment",
      entityId: id,
      meta: { employeeId: assignment.employeeId, date: toDateOnly(assignment.date) },
    });
    const changeType = changeTypeFor(existing.employeeId, assignment.employeeId);
    await historyService.record({
      organizationId,
      scheduleId: assignment.scheduleId,
      assignmentId: id,
      changeType,
      date: assignment.date,
      previousEmployeeId: existing.employeeId,
      newEmployeeId: assignment.employeeId,
      changedById: userId,
      metadata: {
        previousDate: toDateOnly(existing.date),
        newDate: toDateOnly(assignment.date),
      },
    });
    eventBus.emit("shift.changed", {
      organizationId,
      actorId: userId,
      scheduleId: assignment.scheduleId,
      scheduleName: toDateOnly(schedule.weekStartDate),
      scheduleStatus: schedule.status,
      scheduleVersion: schedule.version,
      assignmentId: id,
      date: toDateOnly(assignment.date),
      startTime: assignment.startTime ?? values.startTime,
      endTime: assignment.endTime ?? values.endTime,
      changeType: changeType as SharedScheduleChangeType,
      employeeId: assignment.employeeId,
      previousEmployeeId: existing.employeeId,
    });
    const updateKind =
      action === "SHIFT_MOVED"
        ? ScheduleUpdateKind.ASSIGNMENT_MOVED
        : ScheduleUpdateKind.ASSIGNMENT_UPDATED;
    await realtimeService.publishScheduleUpdate({
      organizationId,
      scheduleId: assignment.scheduleId,
      kind: updateKind,
      assignmentIds: [id],
      actorId: userId,
    });
    await realtimeService.publishAssignmentChange({
      organizationId,
      scheduleId: assignment.scheduleId,
      assignmentId: id,
      kind: updateKind,
      employeeId: assignment.employeeId,
      date: assignment.date,
      actorId: userId,
    });
    return { assignment: await this.getById(organizationId, id), violations: validation.violations };
  }

  private async validate(
    organizationId: string,
    scheduleId: string,
    id: string | null,
    values: {
      employeeId: string;
      date: Date;
      startTime: string;
      endTime: string;
      breakMinutes: number;
      roleId: string | null;
      requiredSkillIds: string[];
      shiftTemplateId: string;
    },
  ) {
    const candidate: CandidateAssignment & { scheduleId: string; shiftTemplateId: string } = {
      id,
      ...values,
      date: toDateOnly(values.date),
      scheduleId,
      shiftTemplateId: values.shiftTemplateId,
    };
    return validationService.validate(organizationId, candidate);
  }

  private values(input: ShiftInput, template: { roleId: string | null; startTime: string; endTime: string; breakMinutes: number }) {
    return {
      date: new Date(`${toDateOnly(input.date)}T00:00:00.000Z`),
      startTime: input.startTime ?? template.startTime,
      endTime: input.endTime ?? template.endTime,
      breakMinutes: input.breakMinutes ?? template.breakMinutes,
      roleId: input.roleId === undefined ? template.roleId : input.roleId,
    };
  }

  private async resolveValues(
    organizationId: string,
    existing: {
      employeeId: string;
      shiftTemplateId: string;
      roleId: string | null;
      date: Date;
      startTime: string | null;
      endTime: string | null;
      breakMinutes: number;
      shiftTemplate: { roleId: string | null; startTime: string; endTime: string; breakMinutes: number };
    },
    input: ShiftUpdateInput,
  ) {
    const templateId = input.shiftTemplateId ?? existing.shiftTemplateId;
    const [template, employee] = await Promise.all([
      prisma.shiftTemplate.findFirst({ where: { id: templateId, organizationId } }),
      prisma.employee.findFirst({ where: { id: input.employeeId ?? existing.employeeId, organizationId } }),
    ]);
    if (!template) throw new Error("Shift template not found");
    if (!employee) throw new Error("Employee not found");
    if (input.roleId) {
      const role = await prisma.role.findFirst({ where: { id: input.roleId, organizationId } });
      if (!role) throw new Error("Role not found");
    }
    return {
      employeeId: input.employeeId ?? existing.employeeId,
      shiftTemplateId: templateId,
      date: new Date(`${toDateOnly(input.date ?? existing.date)}T00:00:00.000Z`),
      startTime: input.startTime ?? existing.startTime ?? template.startTime,
      endTime: input.endTime ?? existing.endTime ?? template.endTime,
      breakMinutes: input.breakMinutes ?? existing.breakMinutes ?? template.breakMinutes,
      roleId: input.roleId === undefined ? existing.roleId ?? template.roleId : input.roleId,
    };
  }

  private async assertReferences(organizationId: string, input: ShiftInput) {
    const [schedule, employee, template] = await Promise.all([
      prisma.schedule.findFirst({ where: { id: input.scheduleId, organizationId } }),
      prisma.employee.findFirst({ where: { id: input.employeeId, organizationId } }),
      prisma.shiftTemplate.findFirst({ where: { id: input.shiftTemplateId, organizationId } }),
    ]);
    if (!schedule) throw new Error("Schedule not found");
    if (!employee) throw new Error("Employee not found");
    if (!template) throw new Error("Shift template not found");
    if (input.roleId) {
      const role = await prisma.role.findFirst({ where: { id: input.roleId, organizationId } });
      if (!role) throw new Error("Role not found");
    }
    return { schedule, employee, template };
  }

  private assertDraft(status: ScheduleStatus): void {
    if (status !== ScheduleStatus.DRAFT) throw new Error("Published schedules cannot be changed");
  }

  private assertNoErrors(violations: Violation[]): void {

    const errors = violations.filter((violation) => violation.level === "ERROR");
    if (errors.length > 0) {
      throw new Error(`Assignment blocked: ${errors.map((violation) => violation.message).join("; ")}`);
    }
  }
}
