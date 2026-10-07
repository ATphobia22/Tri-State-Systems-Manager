export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface JobDefinition {
  id: string;
  name: string;
  payload: Record<string, unknown>;
  maxAttempts: number;
  createdAt: string;
}

export interface JobRecord extends JobDefinition {
  status: JobStatus;
  attempts: number;
  lastError?: string;
  updatedAt: string;
}

export type JobHandler = (job: JobRecord) => Promise<void>;

export class JobRunner {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly handlers = new Map<string, JobHandler>();
  private counter = 0;

  public on(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  public enqueue(name: string, payload: Record<string, unknown> = {}, maxAttempts = 3): JobRecord {
    const now = new Date().toISOString();
    const job: JobRecord = {
      id: `job-${++this.counter}`,
      name,
      payload,
      maxAttempts,
      createdAt: now,
      status: "queued",
      attempts: 0,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  public async run(id: string): Promise<JobRecord> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Unknown job: ${id}`);
    const handler = this.handlers.get(job.name);
    if (!handler) throw new Error(`No handler for job: ${job.name}`);
    job.status = "running";
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    try {
      await handler(job);
      job.status = "succeeded";
    } catch (error) {
      job.status = job.attempts >= job.maxAttempts ? "failed" : "queued";
      job.lastError = error instanceof Error ? error.message : String(error);
    }
    job.updatedAt = new Date().toISOString();
    return job;
  }

  public get(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }
}
