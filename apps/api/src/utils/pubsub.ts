import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();

export const SCHEDULE_UPDATED = "SCHEDULE_UPDATED";
export const NOTIFICATION_RECEIVED = "NOTIFICATION_RECEIVED";

export function notificationTopic(organizationId: string, recipientId: string): string {
  return `${NOTIFICATION_RECEIVED}_${organizationId}_${recipientId}`;
}

export function toAsyncIterable<T>(asyncIterator: AsyncIterator<T>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      return asyncIterator;
    },
  };
}
