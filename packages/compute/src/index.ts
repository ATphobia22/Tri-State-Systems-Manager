export type ComputeStatus = "pending" | "running" | "succeeded" | "failed";

export interface ComputeTask<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  input: TInput;
  status: ComputeStatus;
  output?: TOutput;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export type ComputeFn<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

export class ComputePool {
  private readonly tasks = new Map<string, ComputeTask>();
  private counter = 0;

  public async submit<TInput, TOutput>(
    name: string,
    input: TInput,
    fn: ComputeFn<TInput, TOutput>,
  ): Promise<ComputeTask<TInput, TOutput>> {
    const task: ComputeTask<TInput, TOutput> = {
      id: `compute-${++this.counter}`,
      name,
      input,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task as ComputeTask);
    try {
      task.output = await fn(input);
      task.status = "succeeded";
    } catch (error) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : String(error);
    }
    task.finishedAt = new Date().toISOString();
    return task;
  }

  public get(id: string): ComputeTask | undefined {
    return this.tasks.get(id);
  }
}
