import { builder } from "../builder";
import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();

export const SCHEDULE_UPDATED = "SCHEDULE_UPDATED";

function toAsyncIterable<T>(asyncIterator: AsyncIterator<T>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      return asyncIterator;
    },
  };
}

builder.subscriptionField("scheduleUpdated", (t) =>
  t.string({
    args: {
      organizationId: t.arg.string({ required: true }),
    },
    subscribe: (_root, args) =>
      toAsyncIterable(
        pubsub.asyncIterator(`${SCHEDULE_UPDATED}_${args.organizationId}`),
      ),
    resolve: (payload: string) => payload,
  }),
);
