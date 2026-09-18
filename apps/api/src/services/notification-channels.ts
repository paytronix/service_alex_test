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
