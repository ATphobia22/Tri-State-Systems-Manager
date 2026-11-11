import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../artifacts/tsm-geobim-source-evaluation-v1.json', import.meta.url), 'utf8'));
test('GeoBIM candidates are explicitly non-integrated reference records', () => {
  assert.equal(manifest.schema, 'tsm.geobim.source-evaluation.v1');
  assert.equal(manifest.authorityClass, 'REFERENCE_ONLY');
  assert.equal(manifest.repositories.length, 7);
  const forks = new Set();
  for (const repo of manifest.repositories) {
    assert.match(repo.fork, /^ATphobia22\/[A-Za-z0-9-]+$/);
    assert.match(repo.upstream, /^[\w.-]+\/[\w.-]+$/);
    assert.ok(repo.reportedLicense && repo.role && repo.disposition && repo.note);
    assert.equal(repo.integrated, false);
    assert.equal(repo.releaseVerified, false);
    assert.equal(repo.licenseReviewed, false);
    assert.equal(repo.revision, null);
    assert.equal(repo.checksumSha256, null);
    assert.ok(!forks.has(repo.fork), 'duplicate fork');
    forks.add(repo.fork);
  }
  assert.ok(manifest.adoptionGates.includes('IFC-georeference-and-vertical-datum-validation'));
});
