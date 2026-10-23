import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { planCsSwap } from '../src/lib/cs-resource-scheduler.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(
  readFileSync(resolve(root, 'contracts/registries/tsm-cs-resource-manifest-v1.json'), 'utf8'),
);

test('CS manifest keeps swap disabled', () => {
  assert.equal(manifest.scheduler.swap_enabled, false);
});

test('planCsSwap is plan_only when swap disabled', () => {
  const plan = planCsSwap(manifest, 'C0', 'S0');
  assert.equal(plan.action, 'plan_only');
  assert.equal(plan.selectedAssetId, null);
});
