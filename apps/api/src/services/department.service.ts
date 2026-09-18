import { prisma } from "../utils/prisma";
import { assertValidName, withUniqueName } from "../utils/catalog";
import { AuditService } from "./audit.service";

interface DepartmentInput {
  name: string;
}

const auditService = new AuditService();

export class DepartmentService {
  async list(organizationId: string) {
    return prisma.department.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const department = await prisma.department.findFirst({
      where: { id, organizationId },
    });
    if (!department) throw new Error("Department not found");
    return department;
  }

  async create(organizationId: string, userId: string, input: DepartmentInput) {
    const name = assertValidName(input.name);

    const department = await withUniqueName("Department", () =>
      prisma.department.create({ data: { name, organizationId } }),
    );

    await auditService.log({
      userId,
      organizationId,
      action: "DEPARTMENT_CREATED",
      entity: "Department",
      entityId: department.id,
      meta: { name: department.name },
    });

    return department;
  }

  async update(organizationId: string, userId: string, id: string, input: DepartmentInput) {
    await this.getById(organizationId, id);
    const name = assertValidName(input.name);

    const department = await withUniqueName("Department", () =>
      prisma.department.update({ where: { id }, data: { name } }),
    );

    await auditService.log({
      userId,
      organizationId,
      action: "DEPARTMENT_UPDATED",
      entity: "Department",
      entityId: department.id,
      meta: { name: department.name },
    });

    return department;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const department = await this.getById(organizationId, id);
    await prisma.department.delete({ where: { id } });

    await auditService.log({
      userId,
      organizationId,
      action: "DEPARTMENT_DELETED",
      entity: "Department",
      entityId: id,
      meta: { name: department.name },
    });

    return true;
  }
}
