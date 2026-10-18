import { TSM_STRUCTURAL_PIPELINE_FABRIC, type StructuralPipelineLayer } from './structural-pipeline-fabric';

export type MapPlaneLayerKind = 'raster' | 'raster-dem' | 'arcgis-feature' | 'geojson-local' | 'api' | 'presentation' | 'vector-style';

export interface MapPlaneLayer {
  readonly index: StructuralPipelineLayer['index'];
  readonly id: string;
  readonly title: string;
  readonly authority: string;
  readonly kind: MapPlaneLayerKind;
  readonly endpoint: string;
  readonly defaultVisible: boolean;
  readonly notes: string;
  readonly mapRenderable: boolean;
  readonly sourceLayerId?: number;
}

const sourceLayerIds: Partial<Record<StructuralPipelineLayer['id'], number>> = {
  'fema-nfhl': 28,
  'indiana-bafm': 104,
};

const DEFAULT_VISIBLE_LAYER_IDS = new Set<StructuralPipelineLayer['id']>([
  'terrain-rgb',
  'indiana-parcels',
  'indiana-roads',
  'posey-cslf',
  'usgs-3dep-elevation',
]);

function toMapPlaneLayer(layer: StructuralPipelineLayer): MapPlaneLayer {
  const kind: MapPlaneLayerKind =
    layer.kind === 'terrain' ? 'raster-dem' :
    layer.kind === 'feature' ? 'arcgis-feature' :
    layer.kind;

  return {
    index: layer.index,
    id: layer.id,
    title: layer.name,
    authority: layer.sourceAuthority,
    kind,
    endpoint: layer.endpoint,
    defaultVisible: DEFAULT_VISIBLE_LAYER_IDS.has(layer.id),
    notes: layer.notes,
    mapRenderable: layer.mapRenderable,
    sourceLayerId: sourceLayerIds[layer.id],
  };
}

export const MAP_PLANE_FABRIC: readonly MapPlaneLayer[] = TSM_STRUCTURAL_PIPELINE_FABRIC.map(toMapPlaneLayer);
export const MAP_PLANE_VISIBLE_LAYERS = MAP_PLANE_FABRIC.filter((item) => item.defaultVisible);

export function getMapPlaneLayer(id: string): MapPlaneLayer | undefined {
  return MAP_PLANE_FABRIC.find((item) => item.id === id);
}
