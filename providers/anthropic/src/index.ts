// @tsm/provider-anthropic — UACF provider stub (v0.1.0).
// Declares the provider interface only. NOT a working integration: no API
// keys are read, no network calls are made, and execute() always throws
// fail-closed until an operator configures the provider explicitly.

import type { CapabilityId, CapabilityProvider, CapabilityRequest, CapabilityResult, ProviderHealth, SupportDecision } from '../../../packages/contracts/src/index.ts';

function notConfigured(): never {
  throw new Error('@tsm/provider-anthropic: provider is not configured — refusing to execute (fail-closed). No credentials are read and no request is sent.');
}

export class StubCapabilityProvider implements CapabilityProvider {
  readonly id = 'provider.anthropic';
  readonly version = '0.1.0';
  readonly capabilities = [] as const;

  async health(): Promise<ProviderHealth> {
    return { healthy: false, latencyMs: 0, errorRate: 1, lastChecked: new Date().toISOString() };
  }

  async supports(_capability: CapabilityId, _input: unknown): Promise<SupportDecision> {
    return { supported: false };
  }

  async execute(_request: CapabilityRequest): Promise<CapabilityResult> {
    return notConfigured();
  }
}

export default StubCapabilityProvider;
