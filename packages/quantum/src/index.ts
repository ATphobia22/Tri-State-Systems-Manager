export interface QuantumJob {
  id: string;
  circuit: string;
  shots: number;
  status: "queued" | "running" | "completed" | "failed";
  result?: Record<string, number>;
}

export interface QuantumBackend {
  readonly name: string;
  readonly maxQubits: number;
  submit(circuit: string, shots?: number): Promise<QuantumJob>;
  status(jobId: string): Promise<QuantumJob>;
}

export class SimulatedQuantumBackend implements QuantumBackend {
  public readonly name = "simulated";
  public readonly maxQubits = 32;
  private readonly jobs = new Map<string, QuantumJob>();
  private counter = 0;

  public async submit(circuit: string, shots = 1024): Promise<QuantumJob> {
    const job: QuantumJob = {
      id: `qjob-${++this.counter}`,
      circuit,
      shots,
      status: "completed",
      result: this.simulate(circuit, shots),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  public async status(jobId: string): Promise<QuantumJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Unknown quantum job: ${jobId}`);
    return job;
  }

  private simulate(circuit: string, shots: number): Record<string, number> {
    let hash = 0;
    for (const ch of circuit) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const outcomes = ["00", "01", "10", "11"];
    const result: Record<string, number> = {};
    let remaining = shots;
    outcomes.forEach((outcome, i) => {
      const count = i === outcomes.length - 1 ? remaining : Math.floor((shots * ((hash >> (i * 8)) & 0xff)) / 1020);
      result[outcome] = count;
      remaining -= count;
    });
    return result;
  }
}
