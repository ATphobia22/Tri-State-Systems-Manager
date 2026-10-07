export interface QueueMessage<T = unknown> {
  id: string;
  body: T;
  enqueuedAt: string;
  attempts: number;
}

export interface Queue<T = unknown> {
  readonly name: string;
  enqueue(body: T): QueueMessage<T>;
  dequeue(): QueueMessage<T> | undefined;
  size(): number;
  ack(id: string): boolean;
}

export class InMemoryQueue<T = unknown> implements Queue<T> {
  public readonly name: string;
  private readonly pending: QueueMessage<T>[] = [];
  private readonly inflight = new Map<string, QueueMessage<T>>();
  private counter = 0;

  public constructor(name: string) {
    this.name = name;
  }

  public enqueue(body: T): QueueMessage<T> {
    const message: QueueMessage<T> = {
      id: `${this.name}-${++this.counter}`,
      body,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };
    this.pending.push(message);
    return message;
  }

  public dequeue(): QueueMessage<T> | undefined {
    const message = this.pending.shift();
    if (!message) return undefined;
    message.attempts += 1;
    this.inflight.set(message.id, message);
    return message;
  }

  public size(): number {
    return this.pending.length;
  }

  public ack(id: string): boolean {
    return this.inflight.delete(id);
  }

  public requeue(id: string): boolean {
    const message = this.inflight.get(id);
    if (!message) return false;
    this.inflight.delete(id);
    this.pending.push(message);
    return true;
  }
}
