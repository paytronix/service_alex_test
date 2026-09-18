import { prisma } from "../utils/prisma";
import { assertValidName, withUniqueName } from "../utils/catalog";
import { AuditService } from "./audit.service";

export interface CreateLocationInput {
  name: string;
  timezone?: string;
  address?: string | null;
  isDefault?: boolean;
}

export type UpdateLocationInput = Partial<CreateLocationInput>;

const auditService = new AuditService();

export class LocationService {
  async list(organizationId: string) {
    return prisma.location.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async getById(organizationId: string, id: string) {
    const location = await prisma.location.findFirst({ where: { id, organizationId } });
    if (!location) throw new Error("Location not found");
    return location;
  }

  /** Resolves the organization default location, used when no location is given. */
  async getDefault(organizationId: string) {
    return prisma.location.findFirst({
      where: { organizationId, isDefault: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(organizationId: string, userId: string, input: CreateLocationInput) {
    const location = await withUniqueName("Location", () =>
      prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.location.updateMany({ where: { organizationId }, data: { isDefault: false } });
        }
        return tx.location.create({
          data: {
            organizationId,
            name: assertValidName(input.name),
            timezone: input.timezone?.trim() || "UTC",
            address: input.address?.trim() || null,
            isDefault: input.isDefault ?? (await tx.location.count({ where: { organizationId } })) === 0,
          },
        });
      }),
    );
    await auditService.log({
      userId,
      organizationId,
      action: "LOCATION_CREATED",
      entity: "Location",
      entityId: location.id,
      meta: { name: location.name },
    });
    return location;
  }

  async update(organizationId: string, userId: string, id: string, input: UpdateLocationInput) {
    await this.getById(organizationId, id);
    const location = await withUniqueName("Location", () =>
      prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.location.updateMany({ where: { organizationId }, data: { isDefault: false } });
        }
        return tx.location.update({
          where: { id },
          data: {
            ...(input.name !== undefined && { name: assertValidName(input.name) }),
            ...(input.timezone !== undefined && { timezone: input.timezone.trim() || "UTC" }),
            ...(input.address !== undefined && { address: input.address?.trim() || null }),
            ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
          },
        });
      }),
    );
    await auditService.log({
      userId,
      organizationId,
      action: "LOCATION_UPDATED",
      entity: "Location",
      entityId: id,
      meta: { name: location.name },
    });
    return location;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const location = await this.getById(organizationId, id);
    await prisma.location.delete({ where: { id } });
    await auditService.log({
      userId,
      organizationId,
      action: "LOCATION_DELETED",
      entity: "Location",
      entityId: id,
      meta: { name: location.name },
    });
    return true;
  }

  /** Throws when the location belongs to another organization. */
  async assertBelongs(organizationId: string, locationId?: string | null) {
    if (!locationId) return;
    await this.getById(organizationId, locationId);
  }
}

export const locationService = new LocationService();
