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
    assert.doesNotMatch(source, /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Highway|Hwy)\b/i);
    assert.doesNotMatch(source, /\b\d{2}-\d{2}-\d{2}-\d{3}-\d{3}\.\d{3}-\d{3}\b/);
    assert.doesNotMatch(source, /\bprivate[-_ ]?(?:residence|parcel|site)[-_ ]?(?:anchor|identifier)\b/i);
  });
}
