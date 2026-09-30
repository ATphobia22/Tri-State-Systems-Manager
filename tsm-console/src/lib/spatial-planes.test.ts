import { describe, it, expect } from 'vitest';
import {
  SPATIAL_PLANES,
  derivePlaneState,
  getPlaneLayers,
  summarizeFabric,
  type LayerRuntimeState,
  type SpatialPlane,
} from './spatial-planes';
import { MAP_LAYERS } from './map-layers';

const blank: Record<string, LayerRuntimeState> = {};

function statesFor(
  plane: SpatialPlane,
  state: LayerRuntimeState,
): Record<string, LayerRuntimeState> {
  const out: Record<string, LayerRuntimeState> = {};
  for (const layer of getPlaneLayers(plane)) out[layer.id] = state;
  return out;
}

describe('spatial-planes fabric', () => {
  it('declares 15 active planes plus the retired gauge plane', () => {
    const active = SPATIAL_PLANES.filter((p) => !p.retired);
    const retired = SPATIAL_PLANES.filter((p) => p.retired);
    expect(active).toHaveLength(15);
    expect(retired).toHaveLength(1);
    expect(retired[0].id).toBe('plane-gauge-telemetry');
    expect(retired[0].retirementNote).toMatch(/2026-09-29/);
  });

  it('every non-retired plane layer id exists in the MAP_LAYERS catalog', () => {
    const catalogIds = new Set(MAP_LAYERS.map((l) => l.id));
    for (const plane of SPATIAL_PLANES) {
      for (const id of plane.layerIds) {
        expect(catalogIds.has(id), `plane ${plane.id} references unknown layer ${id}`).toBe(true);
      }
    }
  });

  it('derives live when all layers are live', () => {
    const plane = SPATIAL_PLANES.find((p) => p.id === 'plane-fema')!;
    expect(derivePlaneState(plane, statesFor(plane, 'live'))).toBe('live');
  });

  it('derives degraded when some layers are live', () => {
    const plane = SPATIAL_PLANES.find((p) => p.id === 'plane-fema')!;
    const layers = getPlaneLayers(plane);
    const states: Record<string, LayerRuntimeState> = {
      [layers[0].id]: 'live',
      [layers[1].id]: 'source_unavailable',
    };
    expect(derivePlaneState(plane, states)).toBe('degraded');
  });

  it('derives blocked when a layer is blocked and none are live', () => {
    const plane = SPATIAL_PLANES.find((p) => p.id === 'plane-terrain')!;
    expect(derivePlaneState(plane, statesFor(plane, 'blocked'))).toBe('blocked');
  });

  it('derives loading while layers are still loading', () => {
    const plane = SPATIAL_PLANES.find((p) => p.id === 'plane-parcels')!;
    expect(derivePlaneState(plane, blank)).toBe('loading');
  });

  it('derives source_unavailable when every layer failed', () => {
    const plane = SPATIAL_PLANES.find((p) => p.id === 'plane-bafm')!;
    expect(derivePlaneState(plane, statesFor(plane, 'source_unavailable'))).toBe(
      'source_unavailable',
    );
  });

  it('derives not_configured for planes with no wired layers', () => {
    const plane = SPATIAL_PLANES.find((p) => p.id === 'plane-hecras')!;
    expect(getPlaneLayers(plane)).toHaveLength(0);
    expect(derivePlaneState(plane, blank)).toBe('not_configured');
  });

  it('derives retired for the retired gauge plane regardless of states', () => {
    const plane = SPATIAL_PLANES.find((p) => p.id === 'plane-gauge-telemetry')!;
    expect(derivePlaneState(plane, blank)).toBe('retired');
    expect(derivePlaneState(plane, statesFor(plane, 'live'))).toBe('retired');
  });

  it('summarizeFabric counts planes by derived state', () => {
    const fema = SPATIAL_PLANES.find((p) => p.id === 'plane-fema')!;
    const layers = getPlaneLayers(fema);
    const layerStates: Record<string, LayerRuntimeState> = {
      [layers[0].id]: 'live',
      [layers[1].id]: 'source_unavailable',
    };
    const summary = summarizeFabric(SPATIAL_PLANES, layerStates);
    expect(summary.total).toBe(SPATIAL_PLANES.length);
    expect(summary.degraded).toBe(1);
    expect(summary.retired).toBe(1);
    expect(summary.notConfigured).toBe(4); // hecras, bathymetry, streamstats, sec204 planes
    expect(
      summary.live +
        summary.degraded +
        summary.loading +
        summary.sourceUnavailable +
        summary.notConfigured +
        summary.blocked +
        summary.retired,
    ).toBe(summary.total);
  });
});
