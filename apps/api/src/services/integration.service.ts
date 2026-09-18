import { IntegrationType, Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AuditService } from "./audit.service";

export interface IntegrationConnectionInput {
  type: IntegrationType;
  config: Record<string, unknown>;
  active?: boolean | null;
}

const auditService = new AuditService();

/** Config keys that must never be echoed back to clients. */
const SECRET_KEYS = ["botToken", "token", "webhookUrl", "clientSecret", "refreshToken"];

export function redactConfig(config: Prisma.JsonValue | null): Record<string, unknown> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  return Object.fromEntries(
    Object.entries(config as Record<string, unknown>).map(([key, value]) => [
      key,
      SECRET_KEYS.includes(key) && typeof value === "string" && value.length > 0 ? "***" : value,
    ]),
  );
}

/** Telegram / Slack / Google Calendar connections stored per organization. */
export class IntegrationService {
  async list(organizationId: string) {
    return prisma.integrationConnection.findMany({
      where: { organizationId },
      orderBy: { type: "asc" },
    });
  }

  async get(organizationId: string, type: IntegrationType) {
    return prisma.integrationConnection.findFirst({ where: { organizationId, type } });
  }

  /** One connection per type: repeated calls update the existing record. */
  async upsert(organizationId: string, userId: string, input: IntegrationConnectionInput) {
    const existing = await this.get(organizationId, input.type);
    const config = { ...(existing?.config as Record<string, unknown> | null), ...input.config };
    const connection = existing
      ? await prisma.integrationConnection.update({
          where: { id: existing.id },
          data: {
            config: config as Prisma.InputJsonValue,
            ...(input.active !== undefined && input.active !== null ? { active: input.active } : {}),
          },
        })
      : await prisma.integrationConnection.create({
          data: {
            organizationId,
            type: input.type,
            config: config as Prisma.InputJsonValue,
            active: input.active ?? true,
          },
        });
    await auditService.log({
      userId,
      organizationId,
      action: existing ? "INTEGRATION_UPDATED" : "INTEGRATION_CONNECTED",
      entity: "IntegrationConnection",
      entityId: connection.id,
      meta: { type: input.type, active: connection.active },
    });
    return connection;
  }

  async disconnect(organizationId: string, userId: string, id: string) {
    const connection = await prisma.integrationConnection.findFirst({
      where: { id, organizationId },
    });
    if (!connection) throw new Error("Integration connection not found");
    await prisma.integrationConnection.delete({ where: { id } });
    await auditService.log({
      userId,
      organizationId,
      action: "INTEGRATION_DISCONNECTED",
      entity: "IntegrationConnection",
      entityId: id,
      meta: { type: connection.type },
    });
    return true;
  }
}

export const integrationService = new IntegrationService();
