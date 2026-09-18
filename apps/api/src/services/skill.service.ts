import { prisma } from "../utils/prisma";
import { assertValidName, withUniqueName } from "../utils/catalog";
import { AuditService } from "./audit.service";

interface SkillInput {
  name: string;
}

const auditService = new AuditService();

export class SkillService {
  async list(organizationId: string) {
    return prisma.skill.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const skill = await prisma.skill.findFirst({ where: { id, organizationId } });
    if (!skill) throw new Error("Skill not found");
    return skill;
  }

  async create(organizationId: string, userId: string, input: SkillInput) {
    const name = assertValidName(input.name);

    const skill = await withUniqueName("Skill", () =>
      prisma.skill.create({ data: { name, organizationId } }),
    );

    await auditService.log({
      userId,
      organizationId,
      action: "SKILL_CREATED",
      entity: "Skill",
      entityId: skill.id,
      meta: { name: skill.name },
    });

    return skill;
  }

  async update(organizationId: string, userId: string, id: string, input: SkillInput) {
    await this.getById(organizationId, id);
    const name = assertValidName(input.name);

    const skill = await withUniqueName("Skill", () =>
      prisma.skill.update({ where: { id }, data: { name } }),
    );

    await auditService.log({
      userId,
      organizationId,
      action: "SKILL_UPDATED",
      entity: "Skill",
      entityId: skill.id,
      meta: { name: skill.name },
    });

    return skill;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const skill = await this.getById(organizationId, id);
    await prisma.skill.delete({ where: { id } });

    await auditService.log({
      userId,
      organizationId,
      action: "SKILL_DELETED",
      entity: "Skill",
      entityId: id,
      meta: { name: skill.name },
    });

    return true;
  }
}
