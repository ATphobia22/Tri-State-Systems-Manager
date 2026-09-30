import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';

const port = 8791;
const child: ChildProcess = spawn(
  process.execPath,
  ['src/server.ts'],
  {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, UACF_HOST: '127.0.0.1', UACF_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let output = '';
child.stdout?.on('data', (chunk: Buffer) => {
  output += chunk.toString();
});

async function waitForGateway(): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Gateway did not become ready. Output: ${output}`);
}

try {
  await waitForGateway();

  const health = await fetch(`http://127.0.0.1:${port}/v1/health`).then((response) => response.json());
  assert.equal(health.status, 'ok');

  const capabilities = await fetch(`http://127.0.0.1:${port}/v1/capabilities`).then((response) => response.json());
  assert.ok(capabilities.capabilities.some((capability: { id: string }) => capability.id === 'test.echo'));

  const execution = await fetch(`http://127.0.0.1:${port}/v1/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ capability: 'test.echo', input: 'gateway-smoke' }),
  }).then((response) => response.json());

  assert.equal(execution.success, true);
  assert.equal(execution.output, 'gateway-smoke');
} finally {
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
  if (!exited) {
    child.kill('SIGKILL');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));
  }
}
