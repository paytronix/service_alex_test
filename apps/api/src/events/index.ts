import { eventBus } from "./event-bus";
import { registerNotificationSubscribers } from "./notification.subscriber";

registerNotificationSubscribers(eventBus);

export { eventBus };
export { EventBus } from "./event-bus";
export { registerNotificationSubscribers } from "./notification.subscriber";
