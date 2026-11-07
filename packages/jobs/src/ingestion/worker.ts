/**
 * Ingestion worker: executes a registered {@link AssetAdapter} against an
 * input, and optionally wires the outcome into the existing jobs framework
 * (`JobSpec` / `JobRecord`).
 *
 * Resilience rule: an unknown adapter, an adapter validation failure, or an
 * unexpected adapter throw all become an UNAVAILABLE / REJECTED
 * {@link IngestionResult} with a reason — the worker never throws
 * by-default. Missing required adapter configuration is the exception: an
 * adapter constructor throws loudly, before any work starts.
 */
import type {
  IngestionInput,
  IngestionResult,
} from '../../../contracts/src/IngestionManifest.js';
import type { JobRecord, JobSpec } from '../index.js';
import type { AdapterRegistry } from './registry.js';

export class IngestionWorker {
  readonly #registry: AdapterRegistry;

  constructor(registry: AdapterRegistry) {
    this.#registry = registry;
  }

  adapters(): readonly string[] {
    return this.#registry.names();
  }

  async execute(adapterName: string, input: IngestionInput): Promise<IngestionResult> {
    const adapter = this.#registry.get(adapterName);
    if (!adapter) {
      return {
        status: 'UNAVAILABLE',
        reason: `Unknown ingestion adapter: ${adapterName} (registered: ${this.#registry.names().join(', ') || 'none'})`,
      };
    }
    try {
      return await adapter.ingest(input);
    } catch (error) {
      return {
        status: 'UNAVAILABLE',
        reason: `Adapter ${adapterName} failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Run a job spec through an adapter. The adapter name comes from
   * `job.payload.adapter` (string); the job is marked succeeded only when
   * the adapter reports INGESTED. The manifest checksum is recorded as the
   * job's resultRef so the run is traceable to exact bytes.
   */
  async runJob(spec: JobSpec, input: IngestionInput): Promise<{ job: JobRecord; result: IngestionResult }> {
    const startedAt = new Date().toISOString();
    const adapterName = typeof spec.payload.adapter === 'string' ? spec.payload.adapter : '';
    const result = await this.execute(adapterName, input);
    const finishedAt = new Date().toISOString();
    const job: JobRecord = {
      ...spec,
      status: result.status === 'INGESTED' ? 'succeeded' : 'failed',
      startedAt,
      finishedAt,
      error: result.status === 'INGESTED' ? undefined : result.reason,
      resultRef: result.manifest?.checksumSha256,
    };
    return { job, result };
  }
}
