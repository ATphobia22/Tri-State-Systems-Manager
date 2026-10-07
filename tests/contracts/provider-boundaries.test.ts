import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalCapabilityProvider } from '../../providers/local/src/index.ts';

test('local provider is deterministic and network-free', async () => {
  const provider = new LocalCapabilityProvider();
  const result = await provider.execute({
    capability: 'system.local.generate',
    input: { input: 'hello' },
    context: { requestId: 'req-local-1', permissions: { allow: [] } },
    options: { deterministic: true, seed: 11 },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.output, { chunks: [{ type: 'complete', input: 'hello' }] });
  assert.equal(result.provider.providerId, 'provider.local');
});

import { DelegatingBrowserProvider } from '../../providers/browser/src/index.ts';
import { DelegatingSearchProvider } from '../../providers/search/src/index.ts';

class DelegatedProvider implements CapabilityProvider {
  readonly id = 'delegate';
  readonly version = '1.0.0';
  readonly capabilities = [
    { ...({
      id: 'browser.open',
      name: 'browser.open',
      description: 'browser',
      version: '1.0.0',
      inputSchema: {},
      outputSchema: {},
      permissions: [],
      tags: [],
    } as CapabilityDefinition),
    { ...({
      id: 'web.search',
      name: 'web.search',
      description: 'search',
      version: '1.0.0',
      inputSchema: {},
      outputSchema: {},
      permissions: [],
      tags: [],
    } as CapabilityDefinition),
  ];

  async health() { return { healthy: true, lastChecked: new Date().toISOString() }; }
  async supports(capability: CapabilityDefinition['id']) { return { supported: this.capabilities.some((item) => item.id === capability) }; }
  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    return {
      success: true,
      output: request.input,
      provenance: [],
      citations: [],
      usage: {},
      events: [],
      provider: { providerId: this.id, version: this.version, attempt: 1, startedAt: new Date().toISOString() },
      traceId: request.context.requestId,
    };
  }
}

test('search and browser boundaries expose only their namespaces', () => {
  const delegate = new DelegatedProvider();
  assert.deepEqual(new DelegatingSearchProvider(delegate).capabilities.map((item) => item.id), ['web.search']);
  assert.deepEqual(new DelegatingBrowserProvider(delegate).capabilities.map((item) => item.id), ['browser.open']);
});
