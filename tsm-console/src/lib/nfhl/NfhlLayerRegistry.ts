/**
 * Canonical FEMA NFHL layer registry — TSM/UACF geospatial fabric.
 * Source inventory: hazards.fema.gov public/NFHL MapServer (2026-10-17).
 * Authority: REGULATORY_DISPLAY for effective flood products; never replaces hardcopy FIRM+FIS.
 */

export enum NfhlGeometryType {
  POINT = 'Point',
  POLYLINE = 'Polyline',
  POLYGON = 'Polygon',
}

export type NfhlAuthority = 'REGULATORY_DISPLAY' | 'CONTEXT';

export interface NfhlLayer {
  id: number;
  name: string;
  geometryType: NfhlGeometryType;
  authority: NfhlAuthority;
  /** Preferred MapLibre layer type when vectorized */
  maplibreType?: 'fill' | 'line' | 'circle' | 'symbol';
  priority?: boolean;
}

export const NFHL_MAPSERVER_URL =
  'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer' as const;

/**
 * Priority operational set for PTDT / Twin Canvas first paint.
 * Order matches docs/fabrics/nfhl-geometry-types.json priorityOperational.
 */
export const NFHL_PRIORITY_IDS: readonly number[] = [
  28, 27, 16, 23, 34, 3, 22, 32,
] as const;

export const NFHL_CAPABILITIES = [
  'geo.nfhl.layers',
  'geo.nfhl.zones',
  'geo.nfhl.boundaries',
  'geo.nfhl.lomas',
  'geo.nfhl.levees',
  'geo.nfhl.bfes',
] as const;

export type NfhlCapability = (typeof NFHL_CAPABILITIES)[number];

export const NFHL_LAYERS: readonly NfhlLayer[] = [
  // --- Polygon ---
  { id: 0, name: 'NFHL Availability', geometryType: NfhlGeometryType.POLYGON, authority: 'CONTEXT' },
  { id: 1, name: 'LOMRs', geometryType: NfhlGeometryType.POLYGON, authority: 'REGULATORY_DISPLAY', maplibreType: 'fill' },
  { id: 3, name: 'FIRM Panels', geometryType: NfhlGeometryType.POLYGON, authority: 'REGULATORY_DISPLAY', maplibreType: 'line', priority: true },
  { id: 4, name: 'Base Index', geometryType: NfhlGeometryType.POLYGON, authority: 'CONTEXT' },
  { id: 5, name: 'PLSS', geometryType: NfhlGeometryType.POLYGON, authority: 'CONTEXT' },
  { id: 6, name: 'Topographic Low Confidence Areas', geometryType: NfhlGeometryType.POLYGON, authority: 'CONTEXT' },
  { id: 22, name: 'Political Jurisdictions', geometryType: NfhlGeometryType.POLYGON, authority: 'CONTEXT', priority: true },
  { id: 28, name: 'Flood Hazard Zones', geometryType: NfhlGeometryType.POLYGON, authority: 'REGULATORY_DISPLAY', maplibreType: 'fill', priority: true },
  { id: 29, name: 'Seclusion Boundaries', geometryType: NfhlGeometryType.POLYGON, authority: 'CONTEXT' },
  { id: 30, name: 'Alluvial Fans', geometryType: NfhlGeometryType.POLYGON, authority: 'REGULATORY_DISPLAY', maplibreType: 'fill' },
  { id: 31, name: 'Subbasins', geometryType: NfhlGeometryType.POLYGON, authority: 'CONTEXT' },
  { id: 32, name: 'Water Areas', geometryType: NfhlGeometryType.POLYGON, authority: 'CONTEXT', maplibreType: 'fill', priority: true },
  // --- Polyline ---
  { id: 14, name: 'Cross-Sections', geometryType: NfhlGeometryType.POLYLINE, authority: 'CONTEXT', maplibreType: 'line' },
  { id: 15, name: 'Coastal Transects', geometryType: NfhlGeometryType.POLYLINE, authority: 'CONTEXT', maplibreType: 'line' },
  { id: 16, name: 'Base Flood Elevations', geometryType: NfhlGeometryType.POLYLINE, authority: 'REGULATORY_DISPLAY', maplibreType: 'line', priority: true },
  { id: 17, name: 'Profile Baselines', geometryType: NfhlGeometryType.POLYLINE, authority: 'CONTEXT', maplibreType: 'line' },
  { id: 18, name: 'Transect Baselines', geometryType: NfhlGeometryType.POLYLINE, authority: 'CONTEXT', maplibreType: 'line' },
  { id: 19, name: 'Limit of Moderate Wave Action', geometryType: NfhlGeometryType.POLYLINE, authority: 'REGULATORY_DISPLAY', maplibreType: 'line' },
  { id: 20, name: 'Water Lines', geometryType: NfhlGeometryType.POLYLINE, authority: 'CONTEXT', maplibreType: 'line' },
  { id: 23, name: 'Levees', geometryType: NfhlGeometryType.POLYLINE, authority: 'REGULATORY_DISPLAY', maplibreType: 'line', priority: true },
  { id: 24, name: 'General Structures', geometryType: NfhlGeometryType.POLYLINE, authority: 'CONTEXT', maplibreType: 'line' },
  { id: 25, name: 'Primary Frontal Dunes', geometryType: NfhlGeometryType.POLYLINE, authority: 'CONTEXT', maplibreType: 'line' },
  { id: 26, name: 'Hydrologic Reaches', geometryType: NfhlGeometryType.POLYLINE, authority: 'CONTEXT', maplibreType: 'line' },
  { id: 27, name: 'Flood Hazard Boundaries', geometryType: NfhlGeometryType.POLYLINE, authority: 'REGULATORY_DISPLAY', maplibreType: 'line', priority: true },
  // --- Point ---
  { id: 7, name: 'River Mile Markers', geometryType: NfhlGeometryType.POINT, authority: 'CONTEXT', maplibreType: 'circle' },
  { id: 8, name: 'Datum Conversion Points', geometryType: NfhlGeometryType.POINT, authority: 'CONTEXT', maplibreType: 'circle' },
  { id: 9, name: 'Coastal Gages', geometryType: NfhlGeometryType.POINT, authority: 'CONTEXT', maplibreType: 'circle' },
  { id: 10, name: 'Gages', geometryType: NfhlGeometryType.POINT, authority: 'CONTEXT', maplibreType: 'circle' },
  { id: 11, name: 'Nodes', geometryType: NfhlGeometryType.POINT, authority: 'CONTEXT', maplibreType: 'circle' },
  { id: 12, name: 'High Water Marks', geometryType: NfhlGeometryType.POINT, authority: 'CONTEXT', maplibreType: 'circle' },
  { id: 13, name: 'Station Start Points', geometryType: NfhlGeometryType.POINT, authority: 'CONTEXT', maplibreType: 'circle' },
  { id: 34, name: 'LOMAs', geometryType: NfhlGeometryType.POINT, authority: 'REGULATORY_DISPLAY', maplibreType: 'circle', priority: true },
] as const;

const byId = new Map(NFHL_LAYERS.map((l) => [l.id, l]));

export function getNfhlLayer(id: number): NfhlLayer | undefined {
  return byId.get(id);
}

export function nfhlLayersByGeometry(geometryType: NfhlGeometryType): NfhlLayer[] {
  return NFHL_LAYERS.filter((l) => l.geometryType === geometryType);
}

export function nfhlPriorityLayers(): NfhlLayer[] {
  // Preserve canonical paint order from NFHL_PRIORITY_IDS
  return NFHL_PRIORITY_IDS.map((id) => byId.get(id)).filter(
    (l): l is NfhlLayer => l != null,
  );
}

/** MapServer export `layers=show:` list for priority operational paint */
export function nfhlPriorityShowParam(): string {
  return NFHL_PRIORITY_IDS.join(',');
}

export function capabilityForLayer(id: number): NfhlCapability | 'geo.nfhl.layers' {
  switch (id) {
    case 28:
      return 'geo.nfhl.zones';
    case 27:
      return 'geo.nfhl.boundaries';
    case 34:
      return 'geo.nfhl.lomas';
    case 23:
      return 'geo.nfhl.levees';
    case 16:
      return 'geo.nfhl.bfes';
    default:
      return 'geo.nfhl.layers';
  }
}

/** Unreal Runtime geometry binding hints */
export const NFHL_UNREAL_BINDING: Record<NfhlGeometryType, string> = {
  [NfhlGeometryType.POLYGON]: 'ProceduralMeshComponent overlay',
  [NfhlGeometryType.POLYLINE]: 'SplineComponent (+ optional text labels for BFE)',
  [NfhlGeometryType.POINT]: 'Actor instances / billboard markers',
};
