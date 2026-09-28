import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

// OWNER OVERRIDE (2026-09-27): the repository owner directed that the site
// anchor remains in the public tree as accurate project information and data.
// When docs/privacy/site-anchor-public-disclosure.md exists and carries the
// SITE_ANCHOR_PUBLIC_DISCLOSURE marker, the identifier scan is skipped; the
// test instead verifies the disclosure itself is present and well-formed.
const DISCLOSURE_PATH = 'docs/privacy/site-anchor-public-disclosure.md';
const DISCLOSURE_MARKER = 'SITE_ANCHOR_PUBLIC_DISCLOSURE';

const disclosureActive = async () => {
  try {
    const text = await readFile(DISCLOSURE_PATH, 'utf8');
    return text.includes(DISCLOSURE_MARKER);
  } catch {
    return false;
  }
};

const PUBLIC_SOURCE_PATHS = [
  'backend',
  'data',
  'docs',
  'tsm-console',
  'scripts',
];

// Anchor-specific private identifiers. These mirror the boundary policy enforced
// by scripts/ci/validate-community-engineering-boundaries.mjs: the restricted
// site anchor (and its parcel/coordinates) must not appear in the public
// source tree. Generic street-address matching is intentionally NOT used here:
// the vendored public parcel fabric (Indiana GIO, CC0/public records) contains
// tens of thousands of third-party addresses, so a generic address pattern can
// never pass and only produces false positives.
const PRIVATE_IDENTIFIER_PATTERNS = [
  /13101\s+Bonebank\s+(?:Road|Rd)\b/i,
  /\bBonebank\s+(?:Road|Rd)\b/i,
  /\bBonebank\b/i,
  /37\.845887/,
  /-88\.005075/,
  /BONEBANK_(?:SITE|LOOKUP)/i,
  /65-19-08-100-008\.001-010/,
];

// Excluded from the scan:
// - scripts/ci/validate-community-engineering-boundaries.mjs: the boundary
//   validator's own pattern sources name the anchor, so scanning it would be a
//   self-match (same precedent as its own self-exclusion from the
//   restricted-plane scan).
// - data/posey-county/parcels/posey-parcels-2025.geojson: vendored third-party
//   public parcel fabric (Indiana GIO). It carries public road names as
//   attribute values; it is reference data, not project-authored identifiers.
// - data/evidence/: the restricted evidence plane. Case evidence is
//   operator-retained and is permitted to name the anchor; the boundary
//   policy only bars the anchor from the public/runtime tree.
const EXCLUDED_FILES = new Set([
  'scripts/ci/validate-community-engineering-boundaries.mjs',
  'data/posey-county/parcels/posey-parcels-2025.geojson',
]);
const EXCLUDED_PREFIXES = ['data/evidence/'];

const listGitFiles = async () => {
  const { stdout } = await new Promise((resolve, reject) => {
    const child = spawn('git', ['ls-files', ...PUBLIC_SOURCE_PATHS], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr)));
  });
  return stdout.split('\n').filter(Boolean).filter((f) => !EXCLUDED_FILES.has(f) && !EXCLUDED_PREFIXES.some((p) => f.startsWith(p)));
};

test('public source tree contains no private residence anchor identifiers', async () => {
  if (await disclosureActive()) {
    const disclosure = await readFile(DISCLOSURE_PATH, 'utf8');
    assert.match(disclosure, /Effective date:.*2026-09-27/, 'disclosure must be dated');
    assert.match(disclosure, /Decision by:.*Repository owner/i, 'disclosure must name the decision maker');
    assert.match(disclosure, /13101 Bonebank Road/, 'disclosure must name the anchor it covers');
    return; // owner override active: anchor intentionally public
  }

  const files = await listGitFiles();
  const violations = [];

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    for (const pattern of PRIVATE_IDENTIFIER_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(file + ': ' + pattern);
      }
    }
  }

  assert.deepEqual(violations, [], `Private identifiers leaked into public source:\n${violations.join('\n')}`);
});
