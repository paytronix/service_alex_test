import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Prisma, WebhookDeliveryStatus } from "@prisma/client";
import {
  isWebhookEvent,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_SIGNATURE_HEADER,
  type WebhookEvent,
  type WebhookPayload,
} from "@shiftflow/shared";
import { prisma } from "../utils/prisma";
import { AuditService } from "./audit.service";

export interface WebhookInput {
  url: string;
  events: string[];
  description?: string | null;
  active?: boolean | null;
}

const auditService = new AuditService();

function retryDelayMs(attempts: number): number {
  const base = Number(process.env.WEBHOOK_RETRY_BASE_SECONDS ?? 60);
  return base * 1000 * 2 ** Math.max(0, attempts - 1);
}

export function signWebhookBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Constant-time signature comparison for inbound verification helpers. */
export function verifyWebhookSignature(body: string, secret: string, signature: string): boolean {
  const expected = Buffer.from(signWebhookBody(body, secret), "utf8");
  const received = Buffer.from(signature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Outbound webhooks: CRUD, HMAC-signed delivery, delivery log and retries. */
export class WebhookService {
  async list(organizationId: string) {
    return prisma.webhook.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  }

  async getById(organizationId: string, id: string) {
    const webhook = await prisma.webhook.findFirst({ where: { id, organizationId } });
    if (!webhook) throw new Error("Webhook not found");
    return webhook;
  }

  async deliveries(organizationId: string, filter: { webhookId?: string | null; take?: number | null } = {}) {
    return prisma.webhookDelivery.findMany({
      where: { organizationId, ...(filter.webhookId ? { webhookId: filter.webhookId } : {}) },
      orderBy: { createdAt: "desc" },
      take: Math.min(filter.take ?? 50, 200),
    });
  }

  async create(organizationId: string, userId: string, input: WebhookInput) {
    const events = this.normalizeEvents(input.events);
    const webhook = await prisma.webhook.create({
      data: {
        organizationId,
        url: this.normalizeUrl(input.url),
        events,
        secret: randomBytes(24).toString("hex"),
        description: input.description?.trim() || null,
        active: input.active ?? true,
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "WEBHOOK_CREATED",
      entity: "Webhook",
      entityId: webhook.id,
      meta: { url: webhook.url, events },
    });
    return webhook;
  }

  async update(organizationId: string, userId: string, id: string, input: Partial<WebhookInput>) {
    await this.getById(organizationId, id);
    const webhook = await prisma.webhook.update({
      where: { id },
      data: {
        ...(input.url !== undefined ? { url: this.normalizeUrl(input.url) } : {}),
        ...(input.events !== undefined ? { events: this.normalizeEvents(input.events) } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.active !== undefined && input.active !== null ? { active: input.active } : {}),
      },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "WEBHOOK_UPDATED",
      entity: "Webhook",
      entityId: id,
      meta: { url: webhook.url, events: webhook.events, active: webhook.active },
    });
    return webhook;
  }

  async rotateSecret(organizationId: string, userId: string, id: string) {
    await this.getById(organizationId, id);
    const webhook = await prisma.webhook.update({
      where: { id },
      data: { secret: randomBytes(24).toString("hex") },
    });
    await auditService.log({
      userId,
      organizationId,
      action: "WEBHOOK_SECRET_ROTATED",
      entity: "Webhook",
      entityId: id,
    });
    return webhook;
  }

  async delete(organizationId: string, userId: string, id: string) {
    await this.getById(organizationId, id);
    await prisma.webhook.delete({ where: { id } });
    await auditService.log({
      userId,
      organizationId,
      action: "WEBHOOK_DELETED",
      entity: "Webhook",
      entityId: id,
    });
    return true;
  }

  /** Queues and attempts a delivery to every active webhook subscribed to `event`. */
  async dispatch(
    organizationId: string,
    event: WebhookEvent,
    data: Record<string, unknown>,
  ): Promise<void> {
    const webhooks = await prisma.webhook.findMany({
      where: { organizationId, active: true, events: { has: event } },
    });
    for (const webhook of webhooks) {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          organizationId,
          webhookId: webhook.id,
          event,
          payload: data as Prisma.InputJsonValue,
        },
      });
      await this.attempt(delivery.id);
    }
  }

  /** Re-attempts pending deliveries whose backoff has elapsed (scheduled job). */
  async retryPending(now: Date = new Date()): Promise<number> {
    const pending = await prisma.webhookDelivery.findMany({
      where: {
        status: WebhookDeliveryStatus.PENDING,
        attempts: { lt: WEBHOOK_MAX_ATTEMPTS },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      take: 50,
    });
    for (const delivery of pending) await this.attempt(delivery.id);
    return pending.length;
  }

  async attempt(deliveryId: string): Promise<void> {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });
    if (!delivery || delivery.status === WebhookDeliveryStatus.SUCCESS) return;

    const payload: WebhookPayload = {
      id: delivery.id,
      event: delivery.event as WebhookEvent,
      organizationId: delivery.organizationId,
      createdAt: delivery.createdAt.toISOString(),
      data: (delivery.payload ?? {}) as Record<string, unknown>,
    };
    const body = JSON.stringify(payload);
    const attempts = delivery.attempts + 1;

    try {
      const response = await fetch(delivery.webhook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [WEBHOOK_SIGNATURE_HEADER]: signWebhookBody(body, delivery.webhook.secret),
          [WEBHOOK_EVENT_HEADER]: delivery.event,
        },
        body,
        signal: AbortSignal.timeout(Number(process.env.WEBHOOK_TIMEOUT_MS ?? 10000)),
      });
      const succeeded = response.ok;
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts,
          responseCode: response.status,
          status: succeeded
            ? WebhookDeliveryStatus.SUCCESS
            : attempts >= WEBHOOK_MAX_ATTEMPTS
              ? WebhookDeliveryStatus.FAILED
              : WebhookDeliveryStatus.PENDING,
          error: succeeded ? null : `HTTP ${response.status}`,
          deliveredAt: succeeded ? new Date() : null,
          nextAttemptAt:
            succeeded || attempts >= WEBHOOK_MAX_ATTEMPTS
              ? null
              : new Date(Date.now() + retryDelayMs(attempts)),
        },
      });
    } catch (error) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts,
          status:
            attempts >= WEBHOOK_MAX_ATTEMPTS
              ? WebhookDeliveryStatus.FAILED
              : WebhookDeliveryStatus.PENDING,
          error: error instanceof Error ? error.message : String(error),
          nextAttemptAt:
            attempts >= WEBHOOK_MAX_ATTEMPTS
              ? null
              : new Date(Date.now() + retryDelayMs(attempts)),
        },
      });
    }
  }

  private normalizeEvents(events: string[]): string[] {
    const unique = [...new Set(events.map((event) => event.trim()))];
    const invalid = unique.filter((event) => !isWebhookEvent(event));
    if (invalid.length > 0) throw new Error(`Unknown webhook events: ${invalid.join(", ")}`);
    if (unique.length === 0) throw new Error("At least one event must be selected");
    return unique;
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Webhook URL must use http(s)");
    }
    return parsed.toString();
  }
}

export const webhookService = new WebhookService();
