import { ScheduleStatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AuditService } from "./audit.service";

const auditService = new AuditService();

export class ShiftRequirementService {
  async list(organizationId: string, scheduleId: string) {
    return prisma.shiftRequirement.findMany({
      where: { organizationId, scheduleId },
      orderBy: [{ date: "asc" }, { shiftTemplateId: "asc" }],
    });
  }

  async coverage(organizationId: string, scheduleId: string) {
    const [requirements, assignments] = await Promise.all([
      prisma.shiftRequirement.findMany({ where: { organizationId, scheduleId } }),
      prisma.shiftAssignment.findMany({
        where: { organizationId, scheduleId },
        select: { date: true, shiftTemplateId: true, roleId: true },
      }),
    ]);
    return requirements.map((requirement) => ({
      date: requirement.date,
      shiftTemplateId: requirement.shiftTemplateId,
      roleId: requirement.roleId,
      requiredCount: requirement.requiredCount,
      assignedCount: assignments.filter(
        (assignment) =>
          assignment.date.getTime() === requirement.date.getTime() &&
          assignment.shiftTemplateId === requirement.shiftTemplateId &&
          assignment.roleId === requirement.roleId,
      ).length,
    }));
  }

  async set(
    organizationId: string,
    userId: string,
    scheduleId: string,
    date: Date,
    shiftTemplateId: string,
    roleId: string,
    requiredCount: number,
  ) {
    if (requiredCount < 0) throw new Error("requiredCount must be greater than or equal to 0");
    const [schedule, template, role] = await Promise.all([
      prisma.schedule.findFirst({ where: { id: scheduleId, organizationId } }),
      prisma.shiftTemplate.findFirst({ where: { id: shiftTemplateId, organizationId } }),
      prisma.role.findFirst({ where: { id: roleId, organizationId } }),
    ]);
    if (!schedule) throw new Error("Schedule not found");
    if (schedule.status !== ScheduleStatus.DRAFT) throw new Error("Published schedules cannot be changed");
    if (!template) throw new Error("Shift template not found");
    if (!role) throw new Error("Role not found");
    const normalizedDate = new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const key = { scheduleId, date: normalizedDate, shiftTemplateId, roleId };
    if (requiredCount === 0) {
      await prisma.shiftRequirement.deleteMany({ where: { organizationId, ...key } });
      await auditService.log({
        userId,
        organizationId,
        action: "SHIFT_REQUIREMENT_REMOVED",
        entity: "ShiftRequirement",
        meta: { scheduleId, date: normalizedDate.toISOString().slice(0, 10), shiftTemplateId, roleId },
      });
      throw new Error("Shift requirement deleted");
    }
    const requirement = await prisma.shiftRequirement.upsert({
      where: { scheduleId_date_shiftTemplateId_roleId: key },
      update: { organizationId, requiredCount },
      create: { organizationId, ...key, requiredCount },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "SHIFT_REQUIREMENT_SET",
      entity: "ShiftRequirement",
      entityId: requirement.id,
      meta: { scheduleId, date: normalizedDate.toISOString().slice(0, 10), shiftTemplateId, roleId, requiredCount },
    });
    return requirement;
  }

  async remove(organizationId: string, userId: string, id: string) {
    const requirement = await prisma.shiftRequirement.findFirst({ where: { id, organizationId } });
    if (!requirement) throw new Error("Shift requirement not found");
    const schedule = await prisma.schedule.findFirst({
      where: { id: requirement.scheduleId, organizationId },
      select: { status: true },
    });
    if (!schedule) throw new Error("Schedule not found");
    if (schedule.status !== ScheduleStatus.DRAFT) throw new Error("Published schedules cannot be changed");
    await prisma.shiftRequirement.delete({ where: { id } });
    await auditService.log({
      userId,
      organizationId,
      action: "SHIFT_REQUIREMENT_REMOVED",
      entity: "ShiftRequirement",
      entityId: id,
      meta: { scheduleId: requirement.scheduleId },
    });
    return true;
  }
}
