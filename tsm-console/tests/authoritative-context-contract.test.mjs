/**
 * Contract: authoritative context exposes gaps without inventing regulatory values.
 * Run: node --test tsm-console/tests/authoritative-context-contract.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/lib/authoritative-context.ts'), 'utf8');
const stage = readFileSync(join(root, 'src/lib/stage.ts'), 'utf8');
const fabricReg = readFileSync(join(root, 'src/lib/data-fabric-registry.ts'), 'utf8');

describe('authoritative context', () => {
  it('defines getAuthoritativeContextSnapshot and REALTIME_FABRIC_REFS', () => {
    assert.match(src, /export function getAuthoritativeContextSnapshot/);
    assert.match(src, /REALTIME_FABRIC_REFS/);
    assert.match(src, /blocking_for_regulatory/);
  });
  it('does not invent gage-zero conversion', () => {
    assert.match(src, /GAGE_DATUM/);
    assert.match(src, /conversionPublished/);
  });
  it('stage wires formatContextGapsForUi on unavailable path', () => {
    assert.match(stage, /formatContextGapsForUi/);
    assert.match(stage, /missing_live_stage/);
  });
  it('fabric registry has assertFabricRegistryComplete', () => {
    assert.match(fabricReg, /assertFabricRegistryComplete/);
    assert.match(fabricReg, /listMissingDataFabrics/);
  });
});
