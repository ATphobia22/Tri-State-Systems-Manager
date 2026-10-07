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
