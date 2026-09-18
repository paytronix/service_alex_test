import { crossesMidnight } from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import {
  assertNonNegative,
  assertPositive,
  assertValidColor,
  assertValidName,
  assertValidTime,
  withUniqueName,
} from "../utils/catalog";
import { AuditService } from "./audit.service";

interface CreateShiftTemplateInput {
  name: string;
  startTime: string;
  endTime: string;
  roleId?: string;
  breakMinutes?: number;
  minEmployees?: number;
  maxEmployees?: number;
  color?: string;
}

type UpdateShiftTemplateInput = Partial<CreateShiftTemplateInput>;

const auditService = new AuditService();

export class ShiftTemplateService {
  async list(organizationId: string) {
    return prisma.shiftTemplate.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const template = await prisma.shiftTemplate.findFirst({ where: { id, organizationId } });
    if (!template) throw new Error("Shift template not found");
    return template;
  }

  private async assertRoleBelongsToOrganization(organizationId: string, roleId: string) {
    const role = await prisma.role.findFirst({ where: { id: roleId, organizationId } });
    if (!role) throw new Error("Role not found");
  }

  private assertEmployeeRange(min: number, max: number) {
    if (max < min) throw new Error("maxEmployees must be greater than or equal to minEmployees");
  }

  async create(organizationId: string, userId: string, input: CreateShiftTemplateInput) {
    const startTime = assertValidTime("startTime", input.startTime);
    const endTime = assertValidTime("endTime", input.endTime);
    const minEmployees = assertPositive("minEmployees", input.minEmployees ?? 1);
    const maxEmployees = assertPositive("maxEmployees", input.maxEmployees ?? minEmployees);
    this.assertEmployeeRange(minEmployees, maxEmployees);

    if (input.roleId) {
      await this.assertRoleBelongsToOrganization(organizationId, input.roleId);
    }

    const template = await withUniqueName("Shift template", () =>
      prisma.shiftTemplate.create({
        data: {
          organizationId,
          name: assertValidName(input.name),
          startTime,
          endTime,
          crossesMidnight: crossesMidnight(startTime, endTime),
          breakMinutes: assertNonNegative("breakMinutes", input.breakMinutes ?? 0),
          minEmployees,
          maxEmployees,
          roleId: input.roleId ?? null,
          color: input.color === undefined ? null : assertValidColor(input.color),
        },
      }),
    );

    await auditService.log({
      userId,
      organizationId,
      action: "SHIFT_TEMPLATE_CREATED",
      entity: "ShiftTemplate",
      entityId: template.id,
      meta: { name: template.name, startTime, endTime },
    });

    return template;
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    input: UpdateShiftTemplateInput,
  ) {
    const existing = await this.getById(organizationId, id);

    const startTime =
      input.startTime === undefined
        ? existing.startTime
        : assertValidTime("startTime", input.startTime);
    const endTime =
      input.endTime === undefined ? existing.endTime : assertValidTime("endTime", input.endTime);
    const minEmployees =
      input.minEmployees === undefined
        ? existing.minEmployees
        : assertPositive("minEmployees", input.minEmployees);
    const maxEmployees =
      input.maxEmployees === undefined
        ? existing.maxEmployees
        : assertPositive("maxEmployees", input.maxEmployees);
    this.assertEmployeeRange(minEmployees, maxEmployees);

    if (input.roleId) {
      await this.assertRoleBelongsToOrganization(organizationId, input.roleId);
    }

    const template = await withUniqueName("Shift template", () =>
      prisma.shiftTemplate.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: assertValidName(input.name) }),
          startTime,
          endTime,
          crossesMidnight: crossesMidnight(startTime, endTime),
          minEmployees,
          maxEmployees,
          ...(input.breakMinutes !== undefined && {
            breakMinutes: assertNonNegative("breakMinutes", input.breakMinutes),
          }),
          ...(input.roleId !== undefined && { roleId: input.roleId || null }),
          ...(input.color !== undefined && {
            color: input.color ? assertValidColor(input.color) : null,
          }),
        },
      }),
    );

    await auditService.log({
      userId,
      organizationId,
      action: "SHIFT_TEMPLATE_UPDATED",
      entity: "ShiftTemplate",
      entityId: template.id,
      meta: { name: template.name, startTime, endTime },
    });

    return template;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const template = await this.getById(organizationId, id);
    await prisma.shiftTemplate.delete({ where: { id } });

    await auditService.log({
      userId,
      organizationId,
      action: "SHIFT_TEMPLATE_DELETED",
      entity: "ShiftTemplate",
      entityId: id,
      meta: { name: template.name },
    });

    return true;
  }
}
