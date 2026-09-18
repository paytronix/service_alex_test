import { builder } from "../builder";
import { pubsub, SCHEDULE_UPDATED, toAsyncIterable } from "../../utils/pubsub";

export { pubsub, SCHEDULE_UPDATED };

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
