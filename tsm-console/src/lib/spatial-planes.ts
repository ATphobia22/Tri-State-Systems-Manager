/**
 * 12-plane spatial fabric for the Tri-State Systems Manager web console.
 *
 * Every plane maps to entries in the MAP_LAYERS catalog (lib/map-layers.ts) —
 * the repository's verified source registry. Planes with no configured
 * endpoint are reported as NOT_CONFIGURED; nothing is ever synthesized to
 * fill a gap.
 *
 * Live gauge telemetry was retired by owner decision on 2026-09-29
 * ("drop login and live river data"). The retired plane documents that
 * decision in the UI instead of silently disappearing.
 *
 * Runtime states are derived from real MapLibre source events by the
 * TriStateRiverValleyMap component; the derivation helpers here are pure
 * and covered by spatial-planes.test.ts.
 */
import { MAP_LAYERS, type MapLayerSpec } from './map-layers';

export type LayerRuntimeState =
  | 'loading'
  | 'live'
  | 'source_unavailable'
  | 'not_configured'
  | 'blocked'
  | 'retired';

export type PlaneRuntimeState =
  | 'loading'
  | 'live'
  | 'degraded'
  | 'source_unavailable'
  | 'not_configured'
  | 'blocked'
  | 'retired';

export interface SpatialPlane {
  id: string;
  name: string;
  description: string;
  /** MAP_LAYERS ids. Empty = no endpoint configured (honest gap). */
  layerIds: string[];
  retired?: boolean;
  retirementNote?: string;
}

export const SPATIAL_PLANES: SpatialPlane[] = [
  {
    id: 'plane-terrain',
    name: 'Terrain Mesh',
    description:
      'USGS 3DEP Terrain-RGB elevation mesh for MapLibre 3D terrain. Fail-closed: enabled only with a provenance-controlled VITE_TSM_TERRAIN_RGB_URL_TEMPLATE.',
    layerIds: ['indiana-terrain-rgb'],
  },
  {
    id: 'plane-imagery',
    name: 'Base Imagery',
    description:
      'Indiana current orthoimagery (IGIO ImageServer). OpenStreetMap raster is the offline-tolerant context fallback.',
    layerIds: ['indiana-imagery', 'osm-base'],
  },
  {
    id: 'plane-fema',
    name: 'FEMA NFHL — Effective',
    description:
      'FEMA National Flood Hazard Layer: effective SFHA zones, BFEs, FIRM panels, LOMA/LOMR products. Regulatory/insurance plane — display only, never merged with planning layers.',
    layerIds: ['fema-nfhl', 'fema-firm-panels'],
  },
  {
    id: 'plane-bafm',
    name: 'Indiana BAFM — Planning',
    description:
      'Indiana DNR Best Available Flood Hazard Layer. Planning/construction context under the Indiana Flood Control Act. NOT flood insurance — never collapsed with FEMA NFHL.',
    layerIds: ['indiana-bafm'],
  },
  {
    id: 'plane-parcels',
    name: 'Parcel Boundaries',
    description:
      'Indiana current parcel boundaries (IGIO harvest). Reference geometry only — not a survey product; county accuracy varies.',
    layerIds: ['in-parcels-current'],
  },
  {
    id: 'plane-roads',
    name: 'Road Centerlines',
    description: 'Indiana current road centerlines (IGIO harvest). Context plane.',
    layerIds: ['in-roads-current'],
  },
  {
    id: 'plane-buildings',
    name: 'Building Footprints',
    description:
      'Indiana 2016–2020 lidar-derived building footprints. Reference only — do not treat as current survey geometry.',
    layerIds: ['indiana-building-footprints-2016-2020'],
  },
  {
    id: 'plane-plss',
    name: 'PLSS / Admin Bounds',
    description: 'Indiana PLSS state boundary (IGIO/DNR). Administrative context plane.',
    layerIds: ['in-plss'],
  },
  {
    id: 'plane-addresses',
    name: 'Address Points',
    description: 'Indiana current address points (IGIO harvest). Context plane.',
    layerIds: ['in-addresses-current'],
  },
  {
    id: 'plane-cslf',
    name: 'Posey CSLF — Pending',
    description:
      'Posey County Changes Since Last FIRM (Feb 2025). Preliminary/pending map-change evidence — not equivalent to effective NFHL.',
    layerIds: ['posey-cslf'],
  },
  {
    id: 'plane-elev-index',
    name: '3DEP Elevation Index',
    description: 'USGS 3DEP elevation data index. Observation context plane.',
    layerIds: ['usgs-3dep-index'],
  },
  {
    id: 'plane-hecras',
    name: 'HEC-RAS 2D — Operator Import',
    description:
      'Operator-imported HEC-RAS 2D model outputs (inundation rasters as evidence artifacts). No live endpoint is wired; outputs arrive through the engineering workbench, never as a silent live layer.',
    layerIds: [],
  },
  {
    id: 'plane-gauge-telemetry',
    name: 'Live Gauge Telemetry',
    description: 'USGS NWIS live river gauges.',
    layerIds: [],
    retired: true,
    retirementNote:
      'Retired by owner decision 2026-09-29: live river data dropped. Use operator-imported observations instead.',
  },
];

/** Resolve a plane's layer ids against the MAP_LAYERS catalog. Unknown ids are dropped. */
export function getPlaneLayers(plane: SpatialPlane): MapLayerSpec[] {
  return plane.layerIds
    .map((id) => MAP_LAYERS.find((layer) => layer.id === id))
    .filter((layer): layer is MapLayerSpec => layer !== undefined);
}

/**
 * Derive a plane's runtime state from its layers' states.
 * Missing entries in layerStates are treated as 'loading'.
 */
export function derivePlaneState(
  plane: SpatialPlane,
  layerStates: Record<string, LayerRuntimeState>,
): PlaneRuntimeState {
  if (plane.retired) return 'retired';
  const layers = getPlaneLayers(plane);
  if (layers.length === 0) return 'not_configured';
  const states = layers.map((layer) => layerStates[layer.id] ?? 'loading');
  if (states.every((s) => s === 'live')) return 'live';
  if (states.some((s) => s === 'live')) return 'degraded';
  if (states.some((s) => s === 'blocked')) return 'blocked';
  if (states.some((s) => s === 'loading')) return 'loading';
  if (states.every((s) => s === 'not_configured')) return 'not_configured';
  return 'source_unavailable';
}

export interface FabricSummary {
  total: number;
  live: number;
  degraded: number;
  loading: number;
  sourceUnavailable: number;
  notConfigured: number;
  blocked: number;
  retired: number;
}

/** Count planes by derived runtime state. */
export function summarizeFabric(
  planes: SpatialPlane[],
  layerStates: Record<string, LayerRuntimeState>,
): FabricSummary {
  const summary: FabricSummary = {
    total: planes.length,
    live: 0,
    degraded: 0,
    loading: 0,
    sourceUnavailable: 0,
    notConfigured: 0,
    blocked: 0,
    retired: 0,
  };
  for (const plane of planes) {
    const state = derivePlaneState(plane, layerStates);
    switch (state) {
      case 'live': summary.live += 1; break;
      case 'degraded': summary.degraded += 1; break;
      case 'loading': summary.loading += 1; break;
      case 'source_unavailable': summary.sourceUnavailable += 1; break;
      case 'not_configured': summary.notConfigured += 1; break;
      case 'blocked': summary.blocked += 1; break;
      case 'retired': summary.retired += 1; break;
    }
  }
  return summary;
}
