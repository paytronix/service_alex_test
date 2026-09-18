import { prisma } from "../utils/prisma";
import { Prisma } from "@prisma/client";

export interface AuditFilter {
  actorId?: string | null;
  action?: string | null;
  entity?: string | null;
  entityId?: string | null;
  from?: Date | null;
  to?: Date | null;
  skip?: number | null;
  take?: number | null;
}

const USER_SELECT = {
  select: { id: true, email: true, firstName: true, lastName: true, emailVerified: true },
} as const;

export class AuditService {
  async log(entry: Prisma.AuditLogUncheckedCreateInput) {
    return prisma.auditLog.create({ data: entry });
  }

  /** Convenience form: `log(actor, action, entity, metadata)`. */
  async record(
    actor: { userId?: string | null; organizationId: string },
    action: string,
    entity: { type: string; id?: string | null },
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.log({
      userId: actor.userId ?? null,
      organizationId: actor.organizationId,
      action,
      entity: entity.type,
      entityId: entity.id ?? null,
      ...(metadata !== undefined && { meta: metadata }),
    });
  }

  async getByOrganization(organizationId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: USER_SELECT },
    });
  }

  async list(organizationId: string, filter: AuditFilter = {}) {
    return prisma.auditLog.findMany({
      where: this.where(organizationId, filter),
      orderBy: { createdAt: "desc" },
      skip: filter.skip ?? 0,
      take: Math.min(filter.take ?? 50, 200),
      include: { user: USER_SELECT },
    });
  }

  async count(organizationId: string, filter: AuditFilter = {}) {
    return prisma.auditLog.count({ where: this.where(organizationId, filter) });
  }

  private where(organizationId: string, filter: AuditFilter): Prisma.AuditLogWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filter.from) createdAt.gte = filter.from;
    if (filter.to) createdAt.lte = filter.to;
    return {
      organizationId,
      ...(filter.actorId && { userId: filter.actorId }),
      ...(filter.action && { action: filter.action }),
      ...(filter.entity && { entity: filter.entity }),
      ...(filter.entityId && { entityId: filter.entityId }),
      ...(Object.keys(createdAt).length > 0 && { createdAt }),
    };
  }
}

export const auditService = new AuditService();
