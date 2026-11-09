import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { validateMountVernonScene, verifySceneBytes } from '../src/lib/mount-vernon-city-scene';

const sourceSha = 'b'.repeat(64);
function specimen() {
  return {
    schema: 'tsm.mount-vernon-city-scene.v1', crs: 'EPSG:4326', sources: {},
    buildings: { type: 'FeatureCollection', features: [
      { type: 'Feature', id: 'IGIO:building:19', geometry: {
          type: 'Polygon', coordinates: [[[-87.9, 37.92], [-87.89, 37.92], [-87.89, 37.93], [-87.9, 37.92]]],
        }, properties: { kind: 'building', source_objectid: 19, tsm_id: 'IGIO:building:19',
          source_feature_sha256: sourceSha, engineering_approved: false, height_m: null } },
    ] },
    roads: { type: 'FeatureCollection', features: [] },
  };
}
describe('Mount Vernon scene provenance contract', () => {
  it('accepts real-keyed reference geometry with no fabricated height', () => {
    expect(() => validateMountVernonScene(specimen())).not.toThrow();
  });
  it('rejects duplicate government object IDs', () => {
    const s = specimen();
    s.buildings.features.push(structuredClone(s.buildings.features[0]));
    expect(() => validateMountVernonScene(s)).toThrow('INVALID_SOURCE_FEATURE_IDENTITY');
  });
  it('rejects made-up extrusion heights and engineering approval', () => {
    const s = specimen();
    s.buildings.features[0].properties.height_m = 6.5;
    expect(() => validateMountVernonScene(s)).toThrow('INVALID_SOURCE_FEATURE_IDENTITY');
    s.buildings.features[0].properties.height_m = null;
    s.buildings.features[0].properties.engineering_approved = true;
    expect(() => validateMountVernonScene(s)).toThrow('INVALID_SOURCE_FEATURE_IDENTITY');
  });
  it('enforces official identity and explicit EPSG:4326, not projected feet', () => {
    const s = specimen();
    s.buildings.features[0].properties.tsm_id = 'invented-id';
    expect(() => validateMountVernonScene(s)).toThrow('INVALID_SOURCE_FEATURE_IDENTITY');
    const next = specimen();
    next.crs = 'EPSG:2966';
    expect(() => validateMountVernonScene(next)).toThrow('SCENE_CRS_OR_SCHEMA_INVALID');
  });
  it('checks raw scene archive SHA-256 and bytes; refuses tampering', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(specimen()));
    const receipt = { schema: 'tsm.mount-vernon-city-receipt.v1', sha256: createHash('sha256').update(bytes).digest('hex'),
      byte_length: bytes.byteLength, review: 'NOT_EVIDENCED', regulatory_approval: false };
    expect(await verifySceneBytes(bytes, receipt)).toBe(true);
    const tampered = new Uint8Array(bytes);
    tampered[0] ^= 1;
    expect(await verifySceneBytes(tampered, receipt)).toBe(false);
    expect(await verifySceneBytes(bytes, { ...receipt, regulatory_approval: true })).toBe(false);
  });
});
