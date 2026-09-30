import { MAPLIBRE_FABRIC_LAYERS, type MapLibreFabricLayer } from './maplibre-layer-fabric';

export type MapPlaneLayerKind = 'raster' | 'raster-dem' | 'arcgis-feature';

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

const idAliases: Record<string, string> = {
  'terrain-rgb': 'indiana-terrain-rgb',
  'fema-effective': 'fema-nfhl',
  'indiana-parcels': 'in-parcels-current',
  'indiana-roads': 'in-roads-current',
  'indiana-buildings': 'indiana-building-footprints-2016-2020',
  'indiana-plss': 'in-plss',
  'usgs-3dep-elevation': 'usgs-3dep-elevation',
};

const notesById: Record<string, string> = {
  terrain: 'Self-hosted/provenance-controlled Terrain-RGB. Runtime template remains fail-closed.',
  'fema-effective': 'Effective FEMA authority plane; never merged with Indiana BAFM.',
  'indiana-bafm': 'Planning/context source; not NFIP insurance evidence.',
  'indiana-buildings': 'Reference footprints; extrusion is visualization, not survey structure height.',
  'posey-cslf': 'Preliminary/context evidence; not equivalent to effective NFHL.',
};

function asMapPlaneLayer(source: MapLibreFabricLayer, index: number): MapPlaneLayer {
  const id = idAliases[source.id] ?? source.id;
  const kind: MapPlaneLayerKind = source.kind === 'terrain' ? 'raster-dem' : source.kind === 'feature' ? 'arcgis-feature' : 'raster';
  return {
    index,
    id,
    title: source.title,
    authority: source.attribution,
    kind,
    endpoint: source.endpoint,
    defaultVisible: source.defaultVisible,
    notes: notesById[source.id] ?? 'Registered public geospatial source.',
    sourceLayerId: source.arcgisLayerIds?.[0],
  };
}

export const MAP_PLANE_FABRIC: readonly MapPlaneLayer[] = MAPLIBRE_FABRIC_LAYERS.map(asMapPlaneLayer);

export const MAP_PLANE_VISIBLE_LAYERS = MAP_PLANE_FABRIC.filter((item) => item.defaultVisible);

export function getMapPlaneLayer(id: string): MapPlaneLayer | undefined {
  return MAP_PLANE_FABRIC.find((item) => item.id === id);
}
