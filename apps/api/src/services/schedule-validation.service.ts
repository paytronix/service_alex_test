import {
  EmployeeStatus as PrismaEmployeeStatus,
  LeaveStatus as PrismaLeaveStatus,
  LeaveType as PrismaLeaveType,
} from "@prisma/client";
import {
  AvailabilityType,
  CandidateAssignment,
  EmployeeStatus,
  LeaveStatus,
  LeaveType,
  EmployeeConstraints,
  LeaveWindow,
  ValidationResult,
  validateAssignment,
  toDateOnly,
  startOfWeek,
  addDays,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";

export interface AssignmentValidationInput extends CandidateAssignment {
  scheduleId: string;
  shiftTemplateId: string;
}

export class ScheduleValidationService {
  async validate(
    organizationId: string,
    input: AssignmentValidationInput,
  ): Promise<ValidationResult> {
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, organizationId },
      include: { skills: true, availabilities: true },
    });
    if (!employee) throw new Error("Employee not found");

    const [organization, template, leaves, schedule] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.shiftTemplate.findFirst({
        where: { id: input.shiftTemplateId, organizationId },
        include: { requiredSkills: { select: { id: true } } },
      }),
      prisma.leaveRequest.findMany({
        where: { organizationId, employeeId: input.employeeId, status: LeaveStatus.APPROVED },
        select: { startDate: true, endDate: true, status: true, type: true },
      }),
      prisma.schedule.findFirst({ where: { id: input.scheduleId, organizationId } }),
    ]);
    if (!organization) throw new Error("Organization not found");
    if (!schedule) throw new Error("Schedule not found");
    if (!template) throw new Error("Shift template not found");
    const weekStart = startOfWeek(input.date);
    const rangeStart = addDays(weekStart, -1);
    const rangeEnd = addDays(weekStart, 7);
    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        organizationId,
        employeeId: input.employeeId,
        date: { gte: rangeStart, lte: rangeEnd },
        ...(input.id ? { id: { not: input.id } } : {}),
      },
      include: { shiftTemplate: true },
    });

    const existingAssignments = assignments.map((assignment) => ({
      id: assignment.id,
      employeeId: assignment.employeeId,
      date: toDateOnly(assignment.date),
      startTime: assignment.startTime ?? assignment.shiftTemplate.startTime,
      endTime: assignment.endTime ?? assignment.shiftTemplate.endTime,
      breakMinutes: assignment.breakMinutes,
    }));
    const constraints: EmployeeConstraints = {
      employeeId: employee.id,
      status: employee.status === PrismaEmployeeStatus.DISMISSED
        ? EmployeeStatus.DISMISSED
        : employee.status === PrismaEmployeeStatus.VACATION
          ? EmployeeStatus.VACATION
          : employee.status === PrismaEmployeeStatus.SICK
            ? EmployeeStatus.SICK
            : EmployeeStatus.WORKING,
      roleId: employee.roleId,
      skillIds: employee.skills.map((skill) => skill.skillId),
      maxHoursPerWeek: employee.maxHoursPerWeek,
      maxConsecutiveShifts: employee.maxConsecutiveShifts,
      minRestHours: employee.minRestHours,
    };
    const leaveWindows: LeaveWindow[] = leaves.map((leave) => ({
      startDate: toDateOnly(leave.startDate),
      endDate: toDateOnly(leave.endDate),
      status: leave.status === PrismaLeaveStatus.APPROVED ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
      type: leave.type === PrismaLeaveType.VACATION
        ? LeaveType.VACATION
        : leave.type === PrismaLeaveType.DAY_OFF
          ? LeaveType.DAY_OFF
          : leave.type === PrismaLeaveType.SICK
            ? LeaveType.SICK
            : leave.type === PrismaLeaveType.UNPAID
              ? LeaveType.UNPAID
              : LeaveType.OTHER,
    }));

    return validateAssignment(
      {
        ...input,
        requiredSkillIds: template.requiredSkills.map((skill) => skill.id),
      },
      {
      employee: constraints,
      organizationDefaults: {
        maxWeeklyHours: organization.maxWeeklyHours,
        minRestHours: organization.minRestHours,
      },
      existingAssignments,
      availability: employee.availabilities.map((availability) => ({
        id: availability.id,
        employeeId: availability.employeeId,
        dayOfWeek: availability.dayOfWeek,
        type: availability.type === "UNAVAILABLE"
          ? AvailabilityType.UNAVAILABLE
          : availability.type === "AVAILABLE_AFTER"
            ? AvailabilityType.AVAILABLE_AFTER
            : AvailabilityType.AVAILABLE,
        availableFrom: availability.availableFrom,
      })),
      leaves: leaveWindows,
      },
    );
  }

  async validateSchedule(organizationId: string, scheduleId: string): Promise<number> {
    const assignments = await prisma.shiftAssignment.findMany({
      where: { organizationId, scheduleId },
      include: { shiftTemplate: { include: { requiredSkills: { select: { id: true } } } } },
    });
    let errors = 0;
    for (const assignment of assignments) {
      const result = await this.validate(organizationId, {
        scheduleId,
        id: assignment.id,
        employeeId: assignment.employeeId,
        date: toDateOnly(assignment.date),
        startTime: assignment.startTime ?? assignment.shiftTemplate.startTime,
        endTime: assignment.endTime ?? assignment.shiftTemplate.endTime,
        breakMinutes: assignment.breakMinutes,
        roleId: assignment.roleId ?? assignment.shiftTemplate.roleId,
        requiredSkillIds: assignment.shiftTemplate.requiredSkills.map((skill) => skill.id),
        shiftTemplateId: assignment.shiftTemplateId,
      });
      if (result.hasErrors) errors += 1;
    }
    return errors;
  }
}
