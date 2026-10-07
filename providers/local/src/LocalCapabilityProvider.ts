import type { CapabilityDefinition, CapabilityId, CapabilityProvider, CapabilityRequest, CapabilityResult, ProviderHealth, SupportDecision } from '../../../packages/contracts/src/index.ts';
import { LocalModelAdapter } from '../../../packages/model-runtime/src/index.ts';

const definition: CapabilityDefinition = {
  id: 'model.local.generate',
  name: 'Local model generation',
  description: 'Deterministic local-reference model capability with no network dependency.',
  version: '1.0.0',
  inputSchema: { type: 'object', properties: { input: {} }, required: ['input'] },
  outputSchema: { type: 'object' },
  permissions: [],
  tags: ['model', 'local', 'offline'],
};

export class LocalCapabilityProvider implements CapabilityProvider {
  readonly id = 'provider.local';
  readonly version = '1.0.0';
  readonly capabilities = [definition];
  private readonly adapter: LocalModelAdapter;

  constructor(model = 'local-reference') {
    this.adapter = new LocalModelAdapter(model);
  }

  async health(): Promise<ProviderHealth> {
    return { healthy: true, latencyMs: 0, errorRate: 0, lastChecked: new Date().toISOString() };
  }

  async supports(capability: CapabilityId, input: unknown): Promise<SupportDecision> {
    return { supported: capability === definition.id && typeof input === 'object' && input !== null && 'input' in input };
  }

  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    const input = request.input as { input: unknown };
    const chunks: unknown[] = [];
    for await (const chunk of this.adapter.generate(input.input, { deterministic: request.options?.deterministic, seed: request.options?.seed })) {
      chunks.push(chunk);
    }
    return {
      success: true,
      output: { chunks },
      provenance: [{ sourceType: 'provider', sourceId: this.id, provider: this.id, version: this.version, timestamp: new Date().toISOString() }],
      citations: [],
      usage: { chunks: chunks.length },
      events: [],
      provider: { providerId: this.id, version: this.version, attempt: 1, startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
      traceId: request.context.requestId,
    };
  }
}
