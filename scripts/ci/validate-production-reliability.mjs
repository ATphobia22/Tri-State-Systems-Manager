import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const contractPath = path.join(root, 'tsm-console/server/reliability/production-reliability-contract.json');
const required = [
  'tsm-console/server/reliability/rate-limiter.mjs',
  'tsm-console/server/reliability/dead-letter-queue.mjs',
  'tsm-console/server/reliability/circuit-breaker.mjs',
  'tsm-console/server/reliability/retry-policy.mjs',
  'tsm-console/server/ingestion/http-client.mjs',
  'tsm-console/server/token-proxy.mjs',
];

const failures = [];
if (!fs.existsSync(contractPath)) failures.push('production reliability contract missing');
else {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  for (const control of Object.values(contract.controls).flat()) {
    if (typeof control !== 'string' || control.length === 0) failures.push('invalid reliability control declaration');
  }
}
for (const relative of required) if (!fs.existsSync(path.join(root, relative))) failures.push(`missing reliability implementation: ${relative}`);

const tokenProxy = fs.readFileSync(path.join(root, 'tsm-console/server/token-proxy.mjs'), 'utf8');
const httpClient = fs.readFileSync(path.join(root, 'tsm-console/server/ingestion/http-client.mjs'), 'utf8');
if (!tokenProxy.includes('/health') || !tokenProxy.includes('/ready')) failures.push('API health/readiness endpoints missing');
if (!tokenProxy.includes('RateLimitError') || !tokenProxy.includes('Retry-After')) failures.push('API rate-limit enforcement missing');
if (!tokenProxy.includes('SIGTERM') || !tokenProxy.includes('server.close')) failures.push('graceful shutdown missing');
if (!httpClient.includes('AbortController')) failures.push('request timeout controller missing');
if (!httpClient.includes('jitterMs')) failures.push('retry jitter not wired');

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}
console.log('Production reliability contract: PASS');
