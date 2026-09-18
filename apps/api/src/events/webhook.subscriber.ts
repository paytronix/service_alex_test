import { WebhookEvent } from "@shiftflow/shared";
import { webhookService, WebhookService } from "../services/webhook.service";
import type { EventBus } from "./event-bus";
import type { DomainEventPayloads } from "@shiftflow/shared";

/** Domain events that are forwarded to subscribed webhooks. */
const EVENT_MAP: Partial<Record<keyof DomainEventPayloads, WebhookEvent>> = {
  "shift.assigned": WebhookEvent.SHIFT_ASSIGNED,
  "shift.changed": WebhookEvent.SHIFT_CHANGED,
  "schedule.published": WebhookEvent.SCHEDULE_PUBLISHED,
  "leaveRequest.approved": WebhookEvent.LEAVE_REQUEST_APPROVED,
  "leaveRequest.rejected": WebhookEvent.LEAVE_REQUEST_REJECTED,
  "timeEntry.closed": WebhookEvent.TIME_ENTRY_CLOSED,
  "timeEntry.adjusted": WebhookEvent.TIME_ENTRY_ADJUSTED,
  "openShift.published": WebhookEvent.OPEN_SHIFT_PUBLISHED,
  "openShift.claimed": WebhookEvent.OPEN_SHIFT_CLAIMED,
  "openShift.claimApproved": WebhookEvent.OPEN_SHIFT_CLAIM_APPROVED,
  "certification.expiring": WebhookEvent.CERTIFICATION_EXPIRING,
  "subscription.updated": WebhookEvent.SUBSCRIPTION_UPDATED,
};

export function registerWebhookSubscribers(
  bus: EventBus,
  service: WebhookService = webhookService,
): void {
  for (const [domainEvent, webhookEvent] of Object.entries(EVENT_MAP) as [
    keyof DomainEventPayloads,
    WebhookEvent,
  ][]) {
    bus.on(domainEvent, async (payload) => {
      await service.dispatch(
        payload.organizationId,
        webhookEvent,
        payload as unknown as Record<string, unknown>,
      );
    });
  }
}
