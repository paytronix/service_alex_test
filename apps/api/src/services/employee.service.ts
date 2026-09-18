import { EmployeeStatus, Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import {
  assertPositiveLimit,
  assertValidEmail,
  assertValidPersonName,
  assertValidPhone,
  withUniqueEmail,
} from "../utils/employee";
import { AuditService } from "./audit.service";

export interface EmployeeFilter {
  departmentId?: string;
  roleId?: string;
  status?: EmployeeStatus;
  search?: string;
  skip?: number;
  take?: number;
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  roleId?: string | null;
  departmentId?: string | null;
  userId?: string | null;
  hireDate?: Date | null;
  status?: EmployeeStatus;
  maxHoursPerWeek?: number | null;
  maxConsecutiveShifts?: number | null;
  minRestHours?: number | null;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const auditService = new AuditService();

export class EmployeeService {
  async list(organizationId: string, filter: EmployeeFilter = {}) {
    const take = Math.min(filter.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const where: Prisma.EmployeeWhereInput = {
      organizationId,
      ...(filter.departmentId && { departmentId: filter.departmentId }),
      ...(filter.roleId && { roleId: filter.roleId }),
      ...(filter.status && { status: filter.status }),
      ...(filter.search && {
        OR: [
          { firstName: { contains: filter.search, mode: "insensitive" } },
          { lastName: { contains: filter.search, mode: "insensitive" } },
          { email: { contains: filter.search, mode: "insensitive" } },
        ],
      }),
    };

    return prisma.employee.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: filter.skip ?? 0,
      take,
    });
  }

  async count(organizationId: string) {
    return prisma.employee.count({ where: { organizationId } });
  }

  async getById(organizationId: string, id: string) {
    const employee = await prisma.employee.findFirst({ where: { id, organizationId } });
    if (!employee) throw new Error("Employee not found");
    return employee;
  }

  async findByUser(organizationId: string, userId: string) {
    return prisma.employee.findFirst({ where: { organizationId, userId } });
  }

  async create(organizationId: string, userId: string, input: CreateEmployeeInput) {
    await this.assertReferencesBelongToOrganization(organizationId, input);

    const employee = await withUniqueEmail(() =>
      prisma.employee.create({
        data: {
          organizationId,
          firstName: assertValidPersonName("firstName", input.firstName),
          lastName: assertValidPersonName("lastName", input.lastName),
          email: assertValidEmail(input.email),
          phone: input.phone === undefined ? null : assertValidPhone(input.phone),
          photoUrl: input.photoUrl?.trim() || null,
          roleId: input.roleId ?? null,
          departmentId: input.departmentId ?? null,
          userId: input.userId ?? null,
          hireDate: input.hireDate ?? null,
          status: input.status ?? EmployeeStatus.WORKING,
          maxHoursPerWeek: normalizeLimit("maxHoursPerWeek", input.maxHoursPerWeek),
          maxConsecutiveShifts: normalizeLimit(
            "maxConsecutiveShifts",
            input.maxConsecutiveShifts,
          ),
          minRestHours: normalizeLimit("minRestHours", input.minRestHours),
        },
      }),
    );

    await auditService.log({
      userId,
      organizationId,
      action: "EMPLOYEE_CREATED",
      entity: "Employee",
      entityId: employee.id,
      meta: { email: employee.email },
    });

    return employee;
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    input: UpdateEmployeeInput,
  ) {
    await this.getById(organizationId, id);
    await this.assertReferencesBelongToOrganization(organizationId, input);

    const employee = await withUniqueEmail(() =>
      prisma.employee.update({
        where: { id },
        data: {
          ...(input.firstName !== undefined && {
            firstName: assertValidPersonName("firstName", input.firstName),
          }),
          ...(input.lastName !== undefined && {
            lastName: assertValidPersonName("lastName", input.lastName),
          }),
          ...(input.email !== undefined && { email: assertValidEmail(input.email) }),
          ...(input.phone !== undefined && { phone: assertValidPhone(input.phone ?? "") }),
          ...(input.photoUrl !== undefined && { photoUrl: input.photoUrl?.trim() || null }),
          ...(input.roleId !== undefined && { roleId: input.roleId }),
          ...(input.departmentId !== undefined && { departmentId: input.departmentId }),
          ...(input.userId !== undefined && { userId: input.userId }),
          ...(input.hireDate !== undefined && { hireDate: input.hireDate }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.maxHoursPerWeek !== undefined && {
            maxHoursPerWeek: normalizeLimit("maxHoursPerWeek", input.maxHoursPerWeek),
          }),
          ...(input.maxConsecutiveShifts !== undefined && {
            maxConsecutiveShifts: normalizeLimit(
              "maxConsecutiveShifts",
              input.maxConsecutiveShifts,
            ),
          }),
          ...(input.minRestHours !== undefined && {
            minRestHours: normalizeLimit("minRestHours", input.minRestHours),
          }),
        },
      }),
    );

    await auditService.log({
      userId,
      organizationId,
      action: "EMPLOYEE_UPDATED",
      entity: "Employee",
      entityId: employee.id,
      meta: { email: employee.email },
    });

    return employee;
  }

  /** Soft delete: keeps history intact and marks the employee as dismissed. */
  async dismiss(organizationId: string, userId: string, id: string) {
    await this.getById(organizationId, id);
    const employee = await prisma.employee.update({
      where: { id },
      data: { status: EmployeeStatus.DISMISSED },
    });

    await auditService.log({
      userId,
      organizationId,
      action: "EMPLOYEE_DISMISSED",
      entity: "Employee",
      entityId: id,
      meta: { email: employee.email },
    });

    return employee;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const employee = await this.getById(organizationId, id);
    await prisma.employee.delete({ where: { id } });

    await auditService.log({
      userId,
      organizationId,
      action: "EMPLOYEE_DELETED",
      entity: "Employee",
      entityId: id,
      meta: { email: employee.email },
    });

    return true;
  }

  async setSkills(organizationId: string, userId: string, employeeId: string, skillIds: string[]) {
    await this.getById(organizationId, employeeId);
    const unique = [...new Set(skillIds)];
    await this.assertSkillsBelongToOrganization(organizationId, unique);

    await prisma.$transaction([
      prisma.employeeSkill.deleteMany({
        where: unique.length === 0 ? { employeeId } : { employeeId, skillId: { notIn: unique } },
      }),
      ...unique.map((skillId) =>
        prisma.employeeSkill.upsert({
          where: { employeeId_skillId: { employeeId, skillId } },
          create: { employeeId, skillId },
          update: {},
        }),
      ),
    ]);

    await auditService.log({
      userId,
      organizationId,
      action: "EMPLOYEE_SKILLS_UPDATED",
      entity: "Employee",
      entityId: employeeId,
      meta: { skillIds: unique },
    });

    return this.listSkills(employeeId);
  }

  async assignSkill(
    organizationId: string,
    userId: string,
    employeeId: string,
    skillId: string,
    level?: number,
  ) {
    await this.getById(organizationId, employeeId);
    await this.assertSkillsBelongToOrganization(organizationId, [skillId]);

    const employeeSkill = await prisma.employeeSkill.upsert({
      where: { employeeId_skillId: { employeeId, skillId } },
      create: { employeeId, skillId, ...(level !== undefined && { level }) },
      update: { ...(level !== undefined && { level }) },
    });

    await auditService.log({
      userId,
      organizationId,
      action: "EMPLOYEE_SKILL_ASSIGNED",
      entity: "Employee",
      entityId: employeeId,
      meta: { skillId },
    });

    return employeeSkill;
  }

  async removeSkill(organizationId: string, userId: string, employeeId: string, skillId: string) {
    await this.getById(organizationId, employeeId);
    const deleted = await prisma.employeeSkill.deleteMany({ where: { employeeId, skillId } });
    if (deleted.count === 0) throw new Error("Employee does not have this skill");

    await auditService.log({
      userId,
      organizationId,
      action: "EMPLOYEE_SKILL_REMOVED",
      entity: "Employee",
      entityId: employeeId,
      meta: { skillId },
    });

    return true;
  }

  async listSkills(employeeId: string) {
    return prisma.employeeSkill.findMany({ where: { employeeId }, orderBy: { createdAt: "asc" } });
  }

  private async assertReferencesBelongToOrganization(
    organizationId: string,
    input: UpdateEmployeeInput,
  ) {
    if (input.roleId) {
      const role = await prisma.role.findFirst({
        where: { id: input.roleId, organizationId },
        select: { id: true },
      });
      if (!role) throw new Error("Role does not belong to this organization");
    }
    if (input.departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: input.departmentId, organizationId },
        select: { id: true },
      });
      if (!department) throw new Error("Department does not belong to this organization");
    }
    if (input.userId) {
      const membership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId } },
        select: { id: true },
      });
      if (!membership) throw new Error("User is not a member of this organization");
    }
  }

  private async assertSkillsBelongToOrganization(organizationId: string, skillIds: string[]) {
    if (skillIds.length === 0) return;
    const found = await prisma.skill.count({
      where: { id: { in: skillIds }, organizationId },
    });
    if (found !== skillIds.length) {
      throw new Error("One or more skills do not belong to this organization");
    }
  }
}

function normalizeLimit(label: string, value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  return assertPositiveLimit(label, value);
}
