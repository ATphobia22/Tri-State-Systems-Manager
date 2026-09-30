import { MAP_LAYERS } from './map-layers';

export type MapPlaneLayerKind = 'raster' | 'raster-dem' | 'arcgis-feature' | 'api' | 'visual';

export interface MapPlaneLayer {
  index: number;
  id: string;
  title: string;
  authority: string;
  kind: MapPlaneLayerKind;
  endpoint: string;
  defaultVisible: boolean;
  notes: string;
  sourceLayerId?: number;
}

const find = (id: string) => MAP_LAYERS.find((layer) => layer.id === id);

const required = (id: string): NonNullable<ReturnType<typeof find>> => {
  const layer = find(id);
  if (!layer) throw new Error(`Map plane source is missing from MAP_LAYERS: ${id}`);
  return layer;
};

const layer = (id: string, index: number, kind: MapPlaneLayerKind, notes: string): MapPlaneLayer => {
  const source = required(id);
  return {
    index,
    id,
    title: source.title,
    authority: source.attribution ?? 'TSM source registry',
    kind,
    endpoint: source.url,
    defaultVisible: source.defaultVisible ?? false,
    notes,
    sourceLayerId: typeof source.maplibre?.arcgisLayerId === 'number' ? source.maplibre.arcgisLayerId : undefined,
  };
};

/**
 * Twelve production source planes. Terrain is intentionally runtime-configured
 * and fail-closed; all other network endpoints are explicit, public source
 * services already registered in the TSM geospatial catalog.
 */
export const MAP_PLANE_FABRIC: readonly MapPlaneLayer[] = [
  layer('indiana-terrain-rgb', 1, 'raster-dem', 'Self-hosted provenance-controlled Terrain-RGB. Requires VITE_TSM_TERRAIN_RGB_URL_TEMPLATE.'),
  layer('indiana-imagery', 2, 'raster', 'Indiana current orthophoto ImageServer. Visualization/change-detection only.'),
  layer('fema-nfhl', 3, 'raster', 'FEMA effective NFHL authority plane; never merged with BAFM.'),
  layer('indiana-bafm', 4, 'raster', 'Indiana best-available flood mapping; planning context, not NFIP evidence.'),
  layer('in-parcels-current', 5, 'arcgis-feature', 'Indiana current parcel framework; not survey geometry.'),
  layer('in-roads-current', 6, 'arcgis-feature', 'Indiana current road centerlines.'),
  layer('indiana-building-footprints-2016-2020', 7, 'arcgis-feature', 'LiDAR-derived/reference footprints; extrusion height is visualization metadata, not survey structure height.'),
  layer('usgs-3dep-index', 8, 'raster', 'USGS 3DEP elevation index for source discovery/provenance context.'),
  layer('posey-cslf', 9, 'arcgis-feature', 'Posey preliminary changes-since-last-FIRM context; not effective NFHL.'),
  layer('osm-base', 10, 'raster', 'OpenStreetMap contextual basemap with required attribution.'),
  layer('indiana-imagery', 11, 'raster', 'Independent imagery plane reserved for comparison; same authoritative service, separate visibility state.'),
  {
    index: 12,
    id: 'tsm-engineering-api',
    title: 'TSM Engineering API / HEC-RAS Result Plane',
    authority: 'Tri-State Systems Manager',
    kind: 'api',
    endpoint: `${import.meta.env.VITE_TSM_API_BASE_URL || '/api'}/api/engineering/ras-results`,
    defaultVisible: false,
    notes: 'API capability endpoint; never auto-posted by the map. Engineering/model output remains evidence-gated.',
  },
] as const;

export const MAP_PLANE_VISIBLE_LAYERS = MAP_PLANE_FABRIC.filter((item) => item.defaultVisible);

export function getMapPlaneLayer(id: string): MapPlaneLayer | undefined {
  return MAP_PLANE_FABRIC.find((item) => item.id === id);
}
