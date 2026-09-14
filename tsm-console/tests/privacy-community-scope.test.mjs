import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publicRuntimeFiles = [
  '../src/lib/siteConstants.ts',
  '../src/types/site.ts',
  '../src/lib/viewport-config.ts',
  '../src/routes/CinematicHudView.tsx',
  '../src/components/RiverGaugeBoard.tsx',
  '../src/lib/river-gauges.ts',
  '../src/lib/riverInfluence.ts',
];

for (const relativePath of publicRuntimeFiles) {
  test(`public runtime scope excludes private residence identifiers: ${relativePath}`, async () => {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /13101\s+Bonebank/i);
    assert.doesNotMatch(source, /65-19-08-100-008\.001-010/);
    assert.doesNotMatch(source, /BONEBANK_SITE|BONEBANK_LOOKUP/);
  });
}
