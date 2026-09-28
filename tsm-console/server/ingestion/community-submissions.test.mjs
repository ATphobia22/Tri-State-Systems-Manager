import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate the file-backed evidence store: the dedup fail-closed guard is global
// per store file, so tests must not share the app's default .data directory.
// NOTE: evidence-store.mjs resolves TSM_EVIDENCE_DIR at module load time, and
// static imports are hoisted — so the variable must be set BEFORE the modules
// under test are imported. That is why they are imported dynamically below.
process.env.TSM_EVIDENCE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tsm-evidence-test-'));

const { validateCommunityObservation, submitCommunityObservation } = await import('./community-submissions.mjs');

test('community observations accept bounded public payloads', () => {
  const payload = validateCommunityObservation({ lat: 37.97, lon: -87.55, payload: { observed_water_level: 'bankfull' } });
  assert.equal(payload.observed_water_level, 'bankfull');
});

test('community observations reject invalid coordinates', () => {
  assert.throws(() => validateCommunityObservation({ lat: 120, lon: 0 }), /latitude out of range/);
});

test('community observations reject oversized payloads', () => {
  assert.throws(() => validateCommunityObservation({ payload: { value: 'x'.repeat(257_000) } }), /256 KB/);
});


test('community throttling is isolated per client', async () => {
  const base = { payload: { observation: 'test' }, lat: 37.97, lon: -87.55 };
  const other = { payload: { observation: 'test-b' }, lat: 37.97, lon: -87.55 };
  for (let i = 0; i < 30; i += 1) await submitCommunityObservation(base, 1700000000000 + i, 'client-a');
  await assert.rejects(() => submitCommunityObservation(base, 1700000001000, 'client-a'), /rate limit/);
  await submitCommunityObservation(other, 1700000001000, 'client-b');
});
