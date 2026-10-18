import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TSM_DATA_FABRICS } from '../src/lib/data-fabric-registry';
import { MAP_PLANE_FABRIC } from '../src/lib/map-plane-fabric';
import { TSM_STRUCTURAL_PIPELINE_FABRIC } from '../src/lib/structural-pipeline-fabric';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const tileManifest = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'artifacts/tsm-geospatial-tile-fabric-v1.json'), 'utf8'),
) as {
  schemaVersion: string;
  assets: Array<{
    id: string;
    sourceUrl: string;
    status: string;
    crs: string;
    verticalDatum: string;
    verification: { state?: string; checkedAt?: string };
  }>;
};

const liveHydrologyRegistry = JSON.parse(
  readFileSync(resolve(repositoryRoot, '../data/fabrics/live/tsm-live-hydrology-fabric-v1.json'), 'utf8'),
) as {
  sources: Array<{ id: string; status: string; retiredReason?: string }>;
};

describe('cross-fabric contract integrity', () => {
  it('keeps the map plane in one-to-one alignment with the structural layer registry', () => {
    expect(MAP_PLANE_FABRIC).toHaveLength(TSM_STRUCTURAL_PIPELINE_FABRIC.length);

    const mapIds = new Set(MAP_PLANE_FABRIC.map((layer) => layer.id));
    const mapIndexes = new Set(MAP_PLANE_FABRIC.map((layer) => layer.index));
    expect(mapIds.size).toBe(MAP_PLANE_FABRIC.length);
    expect(mapIndexes.size).toBe(MAP_PLANE_FABRIC.length);

    for (const sourceLayer of TSM_STRUCTURAL_PIPELINE_FABRIC) {
      const mapLayer = MAP_PLANE_FABRIC.find((layer) => layer.id === sourceLayer.id);
      expect(mapLayer, `missing map-plane layer: ${sourceLayer.id}`).toBeDefined();
      expect(mapLayer?.index).toBe(sourceLayer.index);
      expect(mapLayer?.title).toBe(sourceLayer.name);
      expect(mapLayer?.authority).toBe(sourceLayer.sourceAuthority);
      expect(mapLayer?.endpoint).toBe(sourceLayer.endpoint);
      expect(mapLayer?.mapRenderable).toBe(sourceLayer.mapRenderable);
    }
  });

  it('does not make non-renderable map layers visible by default', () => {
    for (const layer of MAP_PLANE_FABRIC) {
      if (layer.defaultVisible) expect(layer.mapRenderable, layer.id).toBe(true);
      if (layer.sourceLayerId !== undefined) {
        expect(Number.isInteger(layer.sourceLayerId), layer.id).toBe(true);
        expect(layer.sourceLayerId).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps the data-fabric registry uniquely identified and minimally actionable', () => {
    const ids = TSM_DATA_FABRICS.map((fabric) => fabric.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const fabric of TSM_DATA_FABRICS) {
      expect(fabric.id.trim().length, 'fabric id').toBeGreaterThan(0);
      expect(fabric.module.trim().length, fabric.id + ' module').toBeGreaterThan(0);
      expect(fabric.sources.length, fabric.id + ' sources').toBeGreaterThan(0);
      expect(fabric.output.length, fabric.id + ' outputs').toBeGreaterThan(0);
      expect(typeof fabric.implemented, fabric.id + ' implemented status').toBe('boolean');
      expect(typeof fabric.live, fabric.id + ' live status').toBe('boolean');
      expect(typeof fabric.persistenceAllowed, fabric.id + ' persistence policy').toBe('boolean');
    }
  });

  it('keeps tile assets uniquely identified and provenance metadata explicit', () => {
    expect(tileManifest.schemaVersion).toBe('1.1.0');
    expect(Array.isArray(tileManifest.assets)).toBe(true);

    const ids = tileManifest.assets.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const asset of tileManifest.assets) {
      expect(asset.id.trim().length, 'tile asset id').toBeGreaterThan(0);
      expect(asset.sourceUrl.startsWith('https://'), asset.id + ' source URL').toBe(true);
      expect(asset.crs.trim().length, asset.id + ' CRS').toBeGreaterThan(0);
      expect(asset.verticalDatum.trim().length, asset.id + ' vertical datum policy').toBeGreaterThan(0);
      expect(asset.verification, asset.id + ' verification record').toBeDefined();
      expect(asset.verification.state?.trim().length, asset.id + ' verification state').toBeGreaterThan(0);
      expect(asset.verification.checkedAt?.trim().length, asset.id + ' verification timestamp').toBeGreaterThan(0);
    }
  });

  it('requires retired live-hydrology sources to retain an explicit retirement reason', () => {
    const sourceIds = liveHydrologyRegistry.sources.map((source) => source.id);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);

    for (const source of liveHydrologyRegistry.sources) {
      expect(['active', 'retired']).toContain(source.status);
      if (source.status === 'retired') {
        expect(source.retiredReason?.trim().length, source.id + ' retirement reason').toBeGreaterThan(0);
      }
    }
  });
});
