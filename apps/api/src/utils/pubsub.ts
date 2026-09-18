import { PubSub } from "graphql-subscriptions";
import type { PubSubEngine } from "graphql-subscriptions";
import { RedisPubSub } from "graphql-redis-subscriptions";
import Redis from "ioredis";

/**
 * In-memory PubSub is used by default; setting REDIS_URL switches the engine to
 * Redis so subscriptions work across multiple API instances.
 */
function createEngine(): PubSubEngine {
  const url = process.env.REDIS_URL;
  if (!url) return new PubSub();
  const options = { lazyConnect: false, maxRetriesPerRequest: null };
  return new RedisPubSub({
    publisher: new Redis(url, options),
    subscriber: new Redis(url, options),
  });
}

export const pubsub: PubSubEngine = createEngine();

export const SCHEDULE_UPDATED = "SCHEDULE_UPDATED";
export const SHIFT_ASSIGNMENT_CHANGED = "SHIFT_ASSIGNMENT_CHANGED";
export const NOTIFICATION_RECEIVED = "NOTIFICATION_RECEIVED";

export function notificationTopic(organizationId: string, recipientId: string): string {
  return `${NOTIFICATION_RECEIVED}_${organizationId}_${recipientId}`;
}

/** Organization-wide schedule topic; subscribers filter by schedule/week/location. */
export function scheduleTopic(organizationId: string): string {
  return `${SCHEDULE_UPDATED}_${organizationId}`;
}

export function assignmentTopic(organizationId: string): string {
  return `${SHIFT_ASSIGNMENT_CHANGED}_${organizationId}`;
}

export function toAsyncIterable<T>(asyncIterator: AsyncIterator<T>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      return asyncIterator;
    },
  };
}

/** Filters a subscription stream, keeping only payloads matching the predicate. */
export function filterAsyncIterable<T>(
  source: AsyncIterable<T>,
  predicate: (payload: T) => boolean,
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const payload of source) {
        if (predicate(payload)) yield payload;
      }
    },
  };
}
