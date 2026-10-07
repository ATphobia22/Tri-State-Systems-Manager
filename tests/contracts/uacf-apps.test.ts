import assert from 'node:assert/strict';
import test from 'node:test';
import { createDashboardServer } from '../../apps/dashboard/src/server.ts';
import { createDocsServer } from '../../apps/docs/src/server.ts';

test('dashboard reports gateway unavailability instead of crashing', async () => {
  const server = createDashboardServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  assert.equal(response.status, 503);
  server.close();
});

test('docs server serves the reference surface', async () => {
  const server = createDocsServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Universal Agent Capability Fabric/);
  server.close();
});
