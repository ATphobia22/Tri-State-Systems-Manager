import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeoJsonFeatureCollection, discoverFemaLayers } from './fema-nfhl.mjs';
import { normalizeIndianaFeatureCollection } from './indiana-gis.mjs';

test('preserves native CRS and rejects silent CRS conversion', () => {
  const normalized = normalizeGeoJsonFeatureCollection({ type: 'FeatureCollection', features: [] }, { sourceId: 'FEMA-NFHL', crs: 'EPSG:4269', retrievedAt: '2026-09-07T12:00:00Z' });
  assert.equal(normalized.crs, 'EPSG:4269');
  assert.throws(() => normalizeIndianaFeatureCollection({ type: 'FeatureCollection', features: [] }, { sourceId: 'INDIANA-GIS', retrievedAt: '2026-09-07T12:00:00Z' }), /CRS/i);
});

test('rejects FEMA layer discovery without service metadata', () => {
  assert.throws(() => discoverFemaLayers({ notLayers: [] }), /layers/i);
});


test('FEMA flood results carry mandatory federation provenance', async () => {
  const { normalizeGeoJsonFeatureCollection } = await import('./fema-nfhl.mjs');
  const normalized = normalizeGeoJsonFeatureCollection(
    { type: 'FeatureCollection', features: [] },
    {
      sourceId: 'FEMA-NFHL-LAYER-28',
      crs: 'EPSG:4269',
      retrievedAt: '2026-09-28T02:00:00Z',
      sourceVersion: 'NFHL-layer-28',
    },
  );
  assert.equal(normalized.floodProvenance.source_authority, 'FEMA');
  assert.equal(normalized.floodProvenance.regulatory_status, 'FEMA_EFFECTIVE');
  assert.equal(normalized.floodProvenance.insurance_determination_eligible, true);
  assert.match(normalized.floodProvenance.provenance_hash_sha256, /^[a-f0-9]{64}$/);
});

test('Indiana flood results can opt into the federation without changing generic GIS semantics', async () => {
  const { normalizeIndianaFeatureCollection } = await import('./indiana-gis.mjs');
  const normalized = normalizeIndianaFeatureCollection(
    { type: 'FeatureCollection', features: [] },
    {
      sourceId: 'INDIANA-GIS-LAYER-438',
      crs: 'EPSG:26916',
      retrievedAt: '2026-09-28T02:00:00Z',
      floodProvenance: {
        result_id: 'IDNR-BAFL-438',
        dataset_id: 'IDNR-BAFL',
        source_authority: 'Indiana DNR Division of Water',
        source_uri: 'https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer/438',
        source_version: 'BAFL-layer-438',
        retrieved_at: '2026-09-28T02:00:00Z',
        regulatory_status: 'IDNR_BEST_AVAILABLE',
        authority_class: 'STATE_BEST_AVAILABLE',
        horizontal_crs: 'EPSG:26916',
        vertical_datum: 'NOT_APPLICABLE_FOR_HAZARD_POLYGON',
        model_lineage: [],
        software_version: 'tsm-flood-federation@1.0.0',
        uncertainty: {
          status: 'qualitative',
          method: 'source-published limitations',
          notes: 'Best Available data is not FEMA insurance authority.',
        },
        insurance_determination_eligible: false,
        human_review_required: true,
      },
    },
  );
  assert.equal(normalized.floodProvenance.regulatory_status, 'IDNR_BEST_AVAILABLE');
  assert.equal(normalized.floodProvenance.insurance_determination_eligible, false);
});
