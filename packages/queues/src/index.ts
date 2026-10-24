/**
 * @tsm/queues — queue abstraction.
 * Default: MemoryQueue (offline / desktop / CI).
 * Optional: BullMQ adapter when REDIS_URL is set and bullmq is installed.
 */

export interface QueueMessage<T = unknown> {
  readonly id: string;
  readonly body: T;
  readonly enqueuedAt: string;
  readonly attempts: number;
}

export interface Queue<T = unknown> {
  enqueue(body: T): Promise<QueueMessage<T>>;
  dequeue(): Promise<QueueMessage<T> | null>;
  ack(id: string): Promise<void>;
  size(): Promise<number>;
}

export class MemoryQueue<T = unknown> implements Queue<T> {
  private readonly items: QueueMessage<T>[] = [];
  private readonly acked = new Set<string>();

  async enqueue(body: T): Promise<QueueMessage<T>> {
    const msg: QueueMessage<T> = {
      id: `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      body,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };
    this.items.push(msg);
    return msg;
  }

  async dequeue(): Promise<QueueMessage<T> | null> {
    const next = this.items.find((m) => !this.acked.has(m.id));
    if (!next) return null;
    return { ...next, attempts: next.attempts + 1 };
  }

  async ack(id: string): Promise<void> {
    this.acked.add(id);
    const idx = this.items.findIndex((m) => m.id === id);
    if (idx >= 0) this.items.splice(idx, 1);
  }

  async size(): Promise<number> {
    return this.items.filter((m) => !this.acked.has(m.id)).length;
  }
}

export function createMemoryQueue<T>(): MemoryQueue<T> {
  return new MemoryQueue<T>();
}

export interface BullMqAdapterOptions {
  queueName: string;
  redisUrl: string;
}

export async function createBullMqQueue<T>(
  options: BullMqAdapterOptions,
): Promise<Queue<T>> {
  const bullmq = await import("bullmq").catch(() => {
    throw new Error(
      "bullmq is not installed. Add peer dependency bullmq to use Redis queues, or use createMemoryQueue().",
    );
  });
  const connection = { url: options.redisUrl };
  const q = new bullmq.Queue(options.queueName, { connection });

  return {
    async enqueue(body: T): Promise<QueueMessage<T>> {
      const job = await q.add("tsm-job", body as object, {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
      return {
        id: String(job.id),
        body,
        enqueuedAt: new Date().toISOString(),
        attempts: 0,
      };
    },
    async dequeue(): Promise<QueueMessage<T> | null> {
      const jobs = await q.getJobs(["waiting", "delayed"], 0, 0);
      const job = jobs[0];
      if (!job) return null;
      return {
        id: String(job.id),
        body: job.data as T,
        enqueuedAt: new Date(job.timestamp).toISOString(),
        attempts: job.attemptsMade,
      };
    },
    async ack(id: string): Promise<void> {
      const job = await q.getJob(id);
      if (job) await job.remove();
    },
    async size(): Promise<number> {
      const counts = await q.getJobCounts("waiting", "delayed", "active");
      return (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0);
    },
  };
}

export async function createDefaultQueue<T>(): Promise<Queue<T>> {
  const redisUrl = typeof process !== "undefined" ? process.env?.REDIS_URL : undefined;
  if (redisUrl) {
    return createBullMqQueue<T>({ queueName: "tsm-default", redisUrl });
  }
  return createMemoryQueue<T>();
}

export const QUEUES_PACKAGE_VERSION = "1.1.0" as const;
