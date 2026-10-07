import assert from 'node:assert/strict';
import test from 'node:test';
import { CapabilityRegistry } from '../../packages/registry/src/CapabilityRegistry.ts';
import { StaticPolicyEngine } from '../../packages/policy/src/PolicyEngine.ts';
import { CapabilityRouter } from '../../packages/router/src/CapabilityRouter.ts';
import { UniversalCapabilityFabric } from '../../packages/core/src/UniversalCapabilityFabric.ts';
import { AgentRuntime } from '../../packages/agent-runtime/src/AgentRuntime.ts';
import type { CapabilityDefinition, CapabilityProvider, CapabilityRequest, CapabilityResult } from '../../packages/contracts/src/index.ts';

const definition: CapabilityDefinition = {
  id: 'test.agent-runtime',
  name: 'Agent runtime test',
  description: 'Deterministic runtime contract test',
  version: '1.0.0',
  inputSchema: {},
  outputSchema: {},
  permissions: [],
  tags: ['test'],
};

class Provider implements CapabilityProvider {
  readonly id = 'agent-runtime-test';
  readonly version = '1.0.0';
  readonly capabilities = [definition];

  async health() {
    return { healthy: true, latencyMs: 1, lastChecked: new Date().toISOString() };
  }

  async supports(capability: CapabilityDefinition['id']) {
    return { supported: capability === definition.id };
  }

  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    return {
      success: true,
      output: request.input,
      provenance: [],
      citations: [],
      usage: {},
      events: [],
      provider: {
        providerId: this.id,
        version: this.version,
        attempt: 1,
        startedAt: new Date().toISOString(),
      },
      traceId: request.context.requestId,
    };
  }
}

function runtime(policy = [{ capability: '*', allow: true }]) {
  const registry = new CapabilityRegistry();
  registry.register(new Provider());
  const fabric = new UniversalCapabilityFabric(
    new CapabilityRouter(registry, new StaticPolicyEngine(policy)),
  );
  return new AgentRuntime(fabric);
}

test('executes a capability through the existing fabric', async () => {
  const result = await runtime().execute({
    capability: definition.id,
    input: { value: 42 },
    context: { requestId: 'req-agent-1', permissions: { allow: [] } },
    options: { deterministic: true, seed: 7 },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.output, { value: 42 });
  assert.equal(result.traceId, 'req-agent-1');
});

test('preserves policy denial instead of bypassing the fabric', async () => {
  const result = await runtime([{ capability: definition.id, allow: false }]).execute({
    capability: definition.id,
    input: 'blocked',
    context: { requestId: 'req-agent-2', permissions: { allow: [] } },
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'POLICY_DENIED');
});
