import { prisma } from "../utils/prisma";
import { Prisma } from "@prisma/client";

export class AuditService {
  async log(entry: Prisma.AuditLogUncheckedCreateInput) {
    return prisma.auditLog.create({ data: entry });
  }

  async getByOrganization(organizationId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, emailVerified: true },
        },
      },
    });
  }
}
