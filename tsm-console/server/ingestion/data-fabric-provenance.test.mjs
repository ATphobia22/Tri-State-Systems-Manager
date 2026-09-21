import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProvenanceManifest, buildPublicTransparencyManifest, validateProvenanceContract } from './data-fabric-provenance.mjs';

const provenance = {
  source_org: 'USGS',
  source_uri: 'https://example.gov/data/1',
  published_date: '2026-09-20T00:00:00Z',
  coordinate_system: 'EPSG:4326',
  license_type: 'Source-published public-use terms',
  uncertainty: 'Source-specific uncertainty; consult original metadata.',
  authority_class: 'AUTHORITATIVE',
  governance_status: 'public',
};

test('provenance contract rejects missing mandatory fields', () => {
  assert.throws(
    () => validateProvenanceContract({ ...provenance, license_type: '' }),
    /license_type.*required/,
  );
});

test('provenance manifest is deterministic for identical input', () => {
  const a = buildProvenanceManifest({ datasetId: 'usgs-example', payload: { value: 1 }, provenance: { ...provenance, retrieved_at: '2026-09-20T12:00:00Z' } });
  const b = buildProvenanceManifest({ datasetId: 'usgs-example', payload: { value: 1 }, provenance: { ...provenance, retrieved_at: '2026-09-20T12:00:00Z' } });
  assert.equal(a.content_hash_sha256, b.content_hash_sha256);
});

test('public manifest exposes lineage, CRS, license and limitations without credentials', () => {
  const manifest = buildPublicTransparencyManifest({ datasetId: 'usgs-example', payload: { value: 1 }, provenance });
  assert.equal(manifest.spatial_reference, 'EPSG:4326');
  assert.equal(manifest.legal_terms, provenance.license_type);
  assert.equal(manifest.authority_class, 'AUTHORITATIVE');
  assert.equal(manifest.lineage.length, 3);
});
