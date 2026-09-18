import { eventBus } from "./event-bus";
import { registerNotificationSubscribers } from "./notification.subscriber";
import { registerWebhookSubscribers } from "./webhook.subscriber";

registerNotificationSubscribers(eventBus);
registerWebhookSubscribers(eventBus);

export { eventBus };
export { EventBus } from "./event-bus";
export { registerNotificationSubscribers } from "./notification.subscriber";
export { registerWebhookSubscribers } from "./webhook.subscriber";
