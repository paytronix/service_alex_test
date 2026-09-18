import { AvailabilityType } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { assertAvailableFrom, assertDayOfWeek } from "../utils/employee";
import { AuditService } from "./audit.service";

export interface AvailabilityEntryInput {
  dayOfWeek: number;
  type: AvailabilityType;
  availableFrom?: string | null;
}

const auditService = new AuditService();

export class AvailabilityService {
  async list(employeeId: string) {
    return prisma.availability.findMany({
      where: { employeeId },
      orderBy: { dayOfWeek: "asc" },
    });
  }

  /** Replaces the weekly availability of an employee with the provided entries. */
  async set(
    organizationId: string,
    userId: string,
    employeeId: string,
    entries: AvailabilityEntryInput[],
  ) {
    const normalized = entries.map((entry) => normalizeEntry(entry));
    const days = normalized.map((entry) => entry.dayOfWeek);
    if (new Set(days).size !== days.length) {
      throw new Error("Availability contains duplicate days of week");
    }

    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { employeeId } }),
      ...normalized.map((entry) =>
        prisma.availability.create({ data: { employeeId, ...entry } }),
      ),
    ]);

    await auditService.log({
      userId,
      organizationId,
      action: "AVAILABILITY_UPDATED",
      entity: "Employee",
      entityId: employeeId,
      meta: { days },
    });

    return this.list(employeeId);
  }
}

function normalizeEntry(entry: AvailabilityEntryInput) {
  const dayOfWeek = assertDayOfWeek(entry.dayOfWeek);
  if (entry.type === AvailabilityType.AVAILABLE_AFTER) {
    if (!entry.availableFrom) {
      throw new Error("availableFrom is required for AVAILABLE_AFTER availability");
    }
    return { dayOfWeek, type: entry.type, availableFrom: assertAvailableFrom(entry.availableFrom) };
  }
  return { dayOfWeek, type: entry.type, availableFrom: null };
}
