import { EventEmitter } from "events";
import type { DomainEventPayloads } from "@shiftflow/shared";

export type DomainEventHandler<K extends keyof DomainEventPayloads> = (
  payload: DomainEventPayloads[K],
) => void | Promise<void>;

/**
 * In-process domain event bus. Producers (schedule, shift and leave services)
 * publish events without knowing about notifications or auditing; subscribers
 * translate them into notifications and audit records.
 */
export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly inFlight = new Set<Promise<void>>();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  on<K extends keyof DomainEventPayloads>(event: K, handler: DomainEventHandler<K>): void {
    this.emitter.on(event as string, (payload: DomainEventPayloads[K]) => {
      const task = Promise.resolve()
        .then(() => handler(payload))
        .catch((error) => {
          console.error(`[events] handler for "${String(event)}" failed`, error);
        })
        .then(() => {
          this.inFlight.delete(task);
        });
      this.inFlight.add(task);
    });
  }

  /** Fire and forget: handlers run asynchronously so mutations are not blocked. */
  emit<K extends keyof DomainEventPayloads>(event: K, payload: DomainEventPayloads[K]): void {
    this.emitter.emit(event as string, payload);
  }

  /** Wait for all handlers triggered so far (used by tests and graceful shutdown). */
  async drain(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.all([...this.inFlight]);
    }
  }

  removeAll(): void {
    this.emitter.removeAllListeners();
  }
}

export const eventBus = new EventBus();
