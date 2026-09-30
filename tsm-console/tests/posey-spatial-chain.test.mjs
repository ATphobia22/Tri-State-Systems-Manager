import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePoseyParcelId } from '../server/ingestion/posey-xsoft-parcels.mjs';
import { polygonCentroid, buildPoseySpatialChain } from '../server/ingestion/posey-spatial-chain.mjs';

test('Posey StateCombi normalization is deterministic', () => {
  assert.equal(normalizePoseyParcelId('65-27-08-130-051.600-018'), '652708130051600018');
  assert.throws(() => normalizePoseyParcelId('123'), /18 digits/);
});

test('polygon centroid is deterministic', () => {
  assert.deepEqual(polygonCentroid({ type: 'Polygon', coordinates: [[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]] }), [0,0]);
});

test('spatial chain preserves separate authority planes', async () => {
  const polygon = { type: 'Polygon', coordinates: [[[-87.9,37.9],[-87.8,37.9],[-87.8,38],[-87.9,38],[-87.9,37.9]]] };
  const request = async (url) => {
    const value = String(url);
    if (value.includes('/query') && value.includes('services6.arcgis.com')) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { StateCombi: '652708130051600018' }, geometry: polygon }] };
    if (value.includes('hazards.fema.gov') && value.includes('/3/query')) return { type: 'FeatureCollection', features: [] };
    if (value.includes('hazards.fema.gov') && value.includes('/28/query')) return { type: 'FeatureCollection', features: [] };
    if (value.includes('gisdata.in.gov')) return { features: [{ attributes: { fld_zone: 'X' } }] };
    if (value.includes('epqs.nationalmap.gov')) return { value: 393.4, units: 'Feet' };
    throw new Error('unexpected URL: ' + value);
  };
  const result = await buildPoseySpatialChain('65-27-08-130-051.600-018', { request });
  assert.equal(result.parcel.parcelId, '652708130051600018');
  assert.equal(result.flood.indianaBestAvailable.features[0].attributes.fld_zone, 'X');
  assert.equal(result.terrain.usgs3depEpqs.value, 393.4);
  assert.equal(result.engineering.hydraulicModelStatus, 'NOT_ATTACHED');
});
