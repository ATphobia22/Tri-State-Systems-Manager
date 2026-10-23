import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const snapshotPath = new URL('../docs/gov-data-downloads/fema-hmgp-program-page.html', import.meta.url);
const manifestPath = new URL('../docs/gov-data-downloads/manifest.json', import.meta.url);
const snapshot = readFileSync(snapshotPath, 'utf8');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

test('government HTML snapshots do not store live Drupal contextual tokens', () => {
  assert.doesNotMatch(snapshot, /data-contextual-token\s*=\s*["'][^"']+["']/i);
  assert.match(snapshot, /Hazard Mitigation Grant Program/i);
  assert.match(snapshot, /https:\/\/www\.fema\.gov\/grants\/mitigation\/learn\/hazard-mitigation/);
});

test('manifest identifies the canonical FEMA snapshot and its sanitization', () => {
  const item = manifest.items.find((entry) => entry.file === 'fema-hmgp-program-page.html');
  assert.ok(item);
  assert.equal(item.url, 'https://www.fema.gov/grants/mitigation/learn/hazard-mitigation');
  assert.match(item.description, /contextual-token attributes removed/i);
});
