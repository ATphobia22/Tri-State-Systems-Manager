import type { CapabilityDefinition, CapabilityId, CapabilityProvider, CapabilityRequest, CapabilityResult, ProviderHealth, SupportDecision } from '../../../packages/contracts/src/index.ts';

export class DelegatingSearchProvider implements CapabilityProvider {
  public readonly id: string;
  public readonly version: string;
  public readonly capabilities: readonly CapabilityDefinition[];

  public constructor(private readonly delegate: CapabilityProvider, id = 'provider.search') {
    this.id = id;
    this.version = delegate.version;
    this.capabilities = delegate.capabilities.filter((capability) => capability.id.startsWith('web.') || capability.id.startsWith('research.'));
  }

  public health(): Promise<ProviderHealth> { return this.delegate.health(); }

  public supports(capability: CapabilityId, input: unknown): Promise<SupportDecision> {
    if (!this.capabilities.some((item) => item.id === capability)) return Promise.resolve({ supported: false });
    return this.delegate.supports(capability, input);
  }

  public execute(request: CapabilityRequest): Promise<CapabilityResult> {
    return this.delegate.execute(request);
  }
}
