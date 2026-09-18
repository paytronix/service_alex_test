import { NotificationChannel } from "@prisma/client";

export interface OutgoingNotification {
  id: string;
  organizationId: string;
  recipientId: string;
  recipientEmail: string | null;
  type: string;
  title: string;
  body: string;
  payload: unknown;
}

export interface NotificationChannelSender {
  readonly channel: NotificationChannel;
  send(notification: OutgoingNotification): Promise<void>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailTransport {
  sendMail(message: EmailMessage): Promise<void>;
}

/**
 * Default development transport: prints the email instead of sending it.
 * A real transport (Nodemailer/Mailhog/SES) can be injected with
 * `setEmailTransport()` during application bootstrap.
 */
export class ConsoleEmailTransport implements EmailTransport {
  async sendMail(message: EmailMessage): Promise<void> {
    console.log(`[email] to=${message.to} subject=${message.subject}\n${message.text}`);
  }
}

let transport: EmailTransport = new ConsoleEmailTransport();

export function setEmailTransport(next: EmailTransport): void {
  transport = next;
}

export function getEmailTransport(): EmailTransport {
  return transport;
}

export class EmailChannel implements NotificationChannelSender {
  readonly channel = NotificationChannel.EMAIL;

  constructor(private readonly resolveTransport: () => EmailTransport = getEmailTransport) {}

  async send(notification: OutgoingNotification): Promise<void> {
    if (!notification.recipientEmail) {
      throw new Error("Recipient has no email address");
    }
    await this.resolveTransport().sendMail({
      to: notification.recipientEmail,
      subject: notification.title,
      text: notification.body,
    });
  }
}

/**
 * In-app delivery is the database row itself; the channel only publishes the
 * real-time event so connected clients receive it immediately.
 */
export class InAppChannel implements NotificationChannelSender {
  readonly channel = NotificationChannel.IN_APP;

  constructor(private readonly publish: (notification: OutgoingNotification) => void | Promise<void>) {}

  async send(notification: OutgoingNotification): Promise<void> {
    await this.publish(notification);
  }
}

/** Configuration resolved per organization from `IntegrationConnection`. */
export interface ChatIntegrationConfig {
  active: boolean;
  config: Record<string, unknown>;
}

export type ChatIntegrationResolver = (
  organizationId: string,
) => Promise<ChatIntegrationConfig | null>;

async function postJson(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Chat delivery failed with HTTP ${response.status}`);
  }
}

/**
 * Telegram delivery through the Bot API. The bot token comes from the
 * organization connection, falling back to `TELEGRAM_BOT_TOKEN`; the chat id is
 * taken from the connection (`chatId`) so notifications land in a shared chat.
 */
export class TelegramChannel implements NotificationChannelSender {
  readonly channel = NotificationChannel.TELEGRAM;

  constructor(private readonly resolve: ChatIntegrationResolver) {}

  async send(notification: OutgoingNotification): Promise<void> {
    const connection = await this.resolve(notification.organizationId);
    if (!connection?.active) throw new Error("Telegram integration is not connected");
    const botToken =
      (connection.config.botToken as string | undefined) || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = connection.config.chatId as string | undefined;
    if (!botToken || !chatId) throw new Error("Telegram integration is missing botToken or chatId");
    await postJson(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: `*${notification.title}*\n${notification.body}`,
      parse_mode: "Markdown",
    });
  }
}

/** Slack delivery through an incoming webhook URL stored on the connection. */
export class SlackChannel implements NotificationChannelSender {
  readonly channel = NotificationChannel.SLACK;

  constructor(private readonly resolve: ChatIntegrationResolver) {}

  async send(notification: OutgoingNotification): Promise<void> {
    const connection = await this.resolve(notification.organizationId);
    if (!connection?.active) throw new Error("Slack integration is not connected");
    const webhookUrl =
      (connection.config.webhookUrl as string | undefined) || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) throw new Error("Slack integration is missing webhookUrl");
    await postJson(webhookUrl, {
      text: `*${notification.title}*\n${notification.body}`,
      ...(connection.config.channel ? { channel: connection.config.channel } : {}),
    });
  }
}
