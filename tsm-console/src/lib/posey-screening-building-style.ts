import type { FillExtrusionLayerSpecification } from 'maplibre-gl';

/**
 * Accept only prevalidated, externally checksum-pinned screening records.
 * This visual layer knows NOTHING about absolute NAVD88 ground elevations.
 * MapLibre fill-extrusion height and base are in metres above the map surface.
 * It cannot establish LoD2 roof shape, survey accuracy or regulatory status.
 */
export function createPoseyScreeningExtrusionLayer(
  sourceId: string,
  layerId = 'posey-screening-buildings-extrusion',
): FillExtrusionLayerSpecification {
  if (!sourceId.trim() || !layerId.trim()) throw new Error('Building source/layer identifier missing');
  return {
    id: layerId,
    type: 'fill-extrusion',
    source: sourceId,
    minzoom: 12,
    // Never read a generic third-party height_m. Only sanitized properties
    // from prepare_posey_screening_extrusions.py can enter this layer.
    filter: [
      'all',
      ['==', ['get', 'tsm_visual_mode'], 'SCREENING_ONLY'],
      ['==', ['get', 'tsm_geometry_lod'], 'LoD1_ESTIMATED'],
      ['==', ['get', 'tsm_engineering_approved'], false],
      ['has', 'tsm_visual_height_m'],
    ],
    layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': [
        'match',
        ['get', 'tsm_height_evidence'],
        'ESTIMATED_DEFAULT', '#c98a36',
        'ESTIMATED_THIRD_PARTY', '#5a9bb1',
        '#65758a',
      ],
      'fill-extrusion-height': [
        'interpolate', ['linear'], ['zoom'],
        12, 0, 13, ['get', 'tsm_visual_height_m'],
      ],
      'fill-extrusion-base': ['get', 'tsm_visual_base_m'],
      'fill-extrusion-opacity': 0.7,
      'fill-extrusion-vertical-gradient': true,
    },
  };
}
