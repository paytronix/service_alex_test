import { CertificationStatus } from "@prisma/client";
import { certificationStatusFor, toDateOnly, type CertificationEventPayload } from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { eventBus } from "../events";
import { AuditService } from "./audit.service";

export interface CertificationInput {
  employeeId: string;
  name: string;
  skillId?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
}

export interface CertificationFilter {
  employeeId?: string | null;
  status?: CertificationStatus | null;
}

const auditService = new AuditService();

function dateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${toDateOnly(value)}T00:00:00.000Z`);
}

/** Employee certifications with expiry lifecycle (VALID → EXPIRING → EXPIRED). */
export class CertificationService {
  async list(organizationId: string, filter: CertificationFilter = {}) {
    return prisma.certification.findMany({
      where: {
        organizationId,
        ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: [{ expiresAt: "asc" }, { name: "asc" }],
    });
  }

  async getById(organizationId: string, id: string) {
    const certification = await prisma.certification.findFirst({ where: { id, organizationId } });
    if (!certification) throw new Error("Certification not found");
    return certification;
  }

  async create(organizationId: string, userId: string, input: CertificationInput) {
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, organizationId },
    });
    if (!employee) throw new Error("Employee not found");
    const expiresAt = dateOrNull(input.expiresAt);
    const certification = await prisma.certification.create({
      data: {
        organizationId,
        employeeId: employee.id,
        skillId: input.skillId ?? null,
        name: input.name.trim(),
        issuedAt: dateOrNull(input.issuedAt),
        expiresAt,
        status: certificationStatusFor(expiresAt) as CertificationStatus,
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "CERTIFICATION_CREATED",
      entity: "Certification",
      entityId: certification.id,
      meta: { employeeId: employee.id, name: certification.name },
    });
    return certification;
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    input: Partial<CertificationInput>,
  ) {
    const certification = await this.getById(organizationId, id);
    const expiresAt =
      input.expiresAt === undefined ? certification.expiresAt : dateOrNull(input.expiresAt);
    const updated = await prisma.certification.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.skillId !== undefined ? { skillId: input.skillId } : {}),
        ...(input.issuedAt !== undefined ? { issuedAt: dateOrNull(input.issuedAt) } : {}),
        expiresAt,
        status: certificationStatusFor(expiresAt) as CertificationStatus,
        notifiedAt: null,
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "CERTIFICATION_UPDATED",
      entity: "Certification",
      entityId: id,
      meta: { employeeId: certification.employeeId, name: updated.name },
    });
    return updated;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const certification = await this.getById(organizationId, id);
    await prisma.certification.delete({ where: { id } });
    await auditService.log({
      userId,
      organizationId,
      action: "CERTIFICATION_DELETED",
      entity: "Certification",
      entityId: id,
      meta: { employeeId: certification.employeeId, name: certification.name },
    });
    return true;
  }

  /**
   * Recomputes statuses and emits expiry events once per transition.
   * Runs organization-wide when `organizationId` is omitted (scheduled job).
   */
  async refreshStatuses(organizationId?: string, now: Date = new Date()): Promise<number> {
    const certifications = await prisma.certification.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        expiresAt: { not: null },
      },
    });
    let changed = 0;
    for (const certification of certifications) {
      const status = certificationStatusFor(certification.expiresAt, now) as CertificationStatus;
      if (status === certification.status && certification.notifiedAt) continue;
      const shouldNotify =
        status !== CertificationStatus.VALID &&
        (status !== certification.status || !certification.notifiedAt);
      const updated = await prisma.certification.update({
        where: { id: certification.id },
        data: {
          status,
          ...(shouldNotify ? { notifiedAt: now } : {}),
        },
      });
      if (status !== certification.status) changed += 1;
      if (shouldNotify) {
        eventBus.emit(
          status === CertificationStatus.EXPIRED
            ? "certification.expired"
            : "certification.expiring",
          this.eventPayload(updated),
        );
      }
    }
    return changed;
  }

  /** Certifications required by the employee's role but missing or expired. */
  async blockingFor(organizationId: string, employeeId: string, roleId: string | null) {
    if (!roleId) return [];
    const [role, certifications] = await Promise.all([
      prisma.role.findFirst({ where: { id: roleId, organizationId } }),
      prisma.certification.findMany({ where: { organizationId, employeeId } }),
    ]);
    if (!role) return [];
    const held = new Map(
      certifications.map((certification) => [certification.name.trim().toLowerCase(), certification]),
    );
    return role.requiredCertifications
      .map((name) => ({
        name,
        certification: held.get(name.trim().toLowerCase()) ?? null,
      }))
      .filter(
        (item) =>
          !item.certification || item.certification.status === CertificationStatus.EXPIRED,
      );
  }

  private eventPayload(certification: {
    id: string;
    organizationId: string;
    employeeId: string;
    name: string;
    status: CertificationStatus;
    expiresAt: Date | null;
  }): CertificationEventPayload {
    return {
      organizationId: certification.organizationId,
      certificationId: certification.id,
      employeeId: certification.employeeId,
      name: certification.name,
      status: certification.status,
      expiresAt: certification.expiresAt ? toDateOnly(certification.expiresAt) : null,
    };
  }
}

export const certificationService = new CertificationService();
