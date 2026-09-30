import type {
  CapabilityDefinition,
  CapabilityId,
  CapabilityProvider,
  CapabilityRequest,
  CapabilityResult,
  ProviderHealth,
  SupportDecision,
} from '../../contracts/src/index.ts';

const ECHO_CAPABILITY: CapabilityDefinition = {
  id: 'test.echo' as CapabilityId,
  name: 'Echo',
  description: 'Deterministically returns the supplied input.',
  version: '1.0.0',
  inputSchema: {},
  outputSchema: {},
  permissions: [],
  tags: ['test', 'deterministic'],
};

export class EchoProvider implements CapabilityProvider {
  public readonly id = 'echo';
  public readonly version = '1.0.0';
  public readonly capabilities = [ECHO_CAPABILITY] as const;

  public async health(): Promise<ProviderHealth> {
    return { healthy: true, latencyMs: 0, errorRate: 0, lastChecked: new Date().toISOString() };
  }

  public async supports(capability: CapabilityId): Promise<SupportDecision> {
    return capability === ECHO_CAPABILITY.id
      ? { supported: true }
      : { supported: false, reason: 'Capability is not implemented by echo provider.' };
  }

  public async execute<TInput = unknown, TOutput = TInput>(
    request: CapabilityRequest<TInput>,
  ): Promise<CapabilityResult<TOutput>> {
    const now = new Date().toISOString();
    return {
      success: true,
      output: request.input as unknown as TOutput,
      provider: { providerId: this.id, version: this.version, attempt: 1, startedAt: now, completedAt: now },
      traceId: request.context.requestId,
      provenance: [],
      citations: [],
      usage: {},
      events: [{ type: 'capability.completed', traceId: request.context.requestId, timestamp: now, capability: request.capability }],
    };
  }
}
