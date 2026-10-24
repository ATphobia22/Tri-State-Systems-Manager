export type NotificationSeverity = "info" | "warning" | "critical";
export type NotificationChannel = "in_app" | "email" | "webhook" | "log";

export interface Notification {
  readonly id: string;
  readonly severity: NotificationSeverity;
  readonly channel: NotificationChannel;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly recipient?: string;
  readonly metadata?: Record<string, string>;
}

export interface NotificationSink {
  send(n: Notification): Promise<void>;
}

export class MemoryNotificationSink implements NotificationSink {
  readonly sent: Notification[] = [];
  async send(n: Notification): Promise<void> {
    this.sent.push(n);
  }
}

export function createNotification(
  severity: NotificationSeverity,
  title: string,
  body: string,
  channel: NotificationChannel = "in_app",
  recipient?: string,
): Notification {
  return {
    id: `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    severity,
    channel,
    title,
    body,
    createdAt: new Date().toISOString(),
    recipient,
  };
}

export async function notify(
  sink: NotificationSink,
  severity: NotificationSeverity,
  title: string,
  body: string,
  channel: NotificationChannel = "in_app",
  recipient?: string,
): Promise<Notification> {
  const n = createNotification(severity, title, body, channel, recipient);
  await sink.send(n);
  return n;
}

export const NOTIFICATIONS_PACKAGE_VERSION = "1.0.0" as const;
