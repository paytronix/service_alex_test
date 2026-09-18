import { DEFAULT_ROLE_COLOR } from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import {
  assertNonNegative,
  assertPositive,
  assertValidColor,
  assertValidName,
  withUniqueName,
} from "../utils/catalog";
import { AuditService } from "./audit.service";

interface CreateRoleInput {
  name: string;
  color?: string;
  description?: string;
  maxLoad?: number;
  hourlyRate?: number;
}

type UpdateRoleInput = Partial<CreateRoleInput>;

const auditService = new AuditService();

export class RoleService {
  async list(organizationId: string) {
    return prisma.role.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const role = await prisma.role.findFirst({ where: { id, organizationId } });
    if (!role) throw new Error("Role not found");
    return role;
  }

  async create(organizationId: string, userId: string, input: CreateRoleInput) {
    const role = await withUniqueName("Role", () =>
      prisma.role.create({
        data: {
          organizationId,
          name: assertValidName(input.name),
          color: assertValidColor(input.color ?? DEFAULT_ROLE_COLOR),
          description: input.description?.trim() || null,
          maxLoad: input.maxLoad === undefined ? null : assertPositive("maxLoad", input.maxLoad),
          hourlyRate:
            input.hourlyRate === undefined
              ? null
              : assertNonNegative("hourlyRate", input.hourlyRate),
        },
      }),
    );

    await auditService.log({
      userId,
      organizationId,
      action: "ROLE_CREATED",
      entity: "Role",
      entityId: role.id,
      meta: { name: role.name },
    });

    return role;
  }

  async update(organizationId: string, userId: string, id: string, input: UpdateRoleInput) {
    await this.getById(organizationId, id);

    const role = await withUniqueName("Role", () =>
      prisma.role.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: assertValidName(input.name) }),
          ...(input.color !== undefined && { color: assertValidColor(input.color) }),
          ...(input.description !== undefined && {
            description: input.description.trim() || null,
          }),
          ...(input.maxLoad !== undefined && {
            maxLoad: assertPositive("maxLoad", input.maxLoad),
          }),
          ...(input.hourlyRate !== undefined && {
            hourlyRate: assertNonNegative("hourlyRate", input.hourlyRate),
          }),
        },
      }),
    );

    await auditService.log({
      userId,
      organizationId,
      action: "ROLE_UPDATED",
      entity: "Role",
      entityId: role.id,
      meta: { name: role.name },
    });

    return role;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const role = await this.getById(organizationId, id);
    await prisma.role.delete({ where: { id } });

    await auditService.log({
      userId,
      organizationId,
      action: "ROLE_DELETED",
      entity: "Role",
      entityId: id,
      meta: { name: role.name },
    });

    return true;
  }
}
