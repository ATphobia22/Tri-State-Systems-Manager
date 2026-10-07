export type NotificationChannel = "email" | "sms" | "push" | "webhook" | "in-app";

export interface NotificationInput {
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  body: string;
}

export interface Notification extends NotificationInput {
  id: string;
  createdAt: string;
}

export interface NotificationSender {
  send(input: NotificationInput): Promise<Notification>;
}

export class InMemoryNotificationSender implements NotificationSender {
  private readonly sent: Notification[] = [];
  private counter = 0;

  public async send(input: NotificationInput): Promise<Notification> {
    const notification: Notification = {
      ...input,
      id: `notif-${++this.counter}`,
      createdAt: new Date().toISOString(),
    };
    this.sent.push(notification);
    return notification;
  }

  public history(): readonly Notification[] {
    return this.sent;
  }
}
