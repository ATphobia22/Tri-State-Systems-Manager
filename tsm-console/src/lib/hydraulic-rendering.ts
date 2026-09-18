import type {
  ExpressionSpecification,
  FillExtrusionLayerSpecification,
} from 'maplibre-gl';

export const NAVD88_FT_TO_METERS = 0.3048;

export function feetToMeters(feet: number): number {
  if (!Number.isFinite(feet)) {
    throw new Error('Elevation must be a finite number.');
  }
  return feet * NAVD88_FT_TO_METERS;
}

export function createHydraulicExtrusionLayer(
  layerId: string,
  sourceId: string,
  sourceLayer: string,
  currentWseNavd88Ft: number,
): FillExtrusionLayerSpecification {
  if (!Number.isFinite(currentWseNavd88Ft)) {
    throw new Error('currentWseNavd88Ft must be finite.');
  }

  const currentWseMeters = feetToMeters(currentWseNavd88Ft);

  const groundMeters: ExpressionSpecification = [
    '*',
    ['get', 'ground_elevation_navd88_ft'],
    NAVD88_FT_TO_METERS,
  ];

  const depthMeters: ExpressionSpecification = [
    'max',
    0,
    ['-', currentWseMeters, groundMeters],
  ];

  const waterSurfaceMeters: ExpressionSpecification = [
    '+',
    groundMeters,
    depthMeters,
  ];

  return {
    id: layerId,
    type: 'fill-extrusion',
    source: sourceId,
    'source-layer': sourceLayer,
    minzoom: 12,
    filter: ['has', 'ground_elevation_navd88_ft'],
    paint: {
      'fill-extrusion-base': groundMeters,
      'fill-extrusion-height': waterSurfaceMeters,
      'fill-extrusion-color': [
        'case',
        ['>=', depthMeters, feetToMeters(2)],
        '#dc3545',
        ['>=', depthMeters, feetToMeters(1)],
        '#f0ad4e',
        '#0077be',
      ],
      'fill-extrusion-opacity': 0.7,
      'fill-extrusion-vertical-gradient': true,
    },
  };
}

export function createHydraulicSource(
  sourceId: string,
  martinBaseUrl: string,
): {
  id: string;
  type: 'vector';
  tiles: string[];
  minzoom: number;
  maxzoom: number;
} {
  if (!/^[a-z][a-z0-9-]{0,127}$/.test(sourceId)) {
    throw new Error('Invalid Martin source identifier.');
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(martinBaseUrl);
  } catch {
    throw new Error('Martin base URL must be an absolute HTTP(S) URL.');
  }

  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw new Error('Martin base URL must use HTTP or HTTPS.');
  }

  const base = baseUrl.toString().replace(/\/$/, '');

  return {
    id: sourceId,
    type: 'vector',
    tiles: [
      `${base}/${encodeURIComponent(sourceId)}/{z}/{x}/{y}`,
    ],
    minzoom: 12,
    maxzoom: 20,
  };
}
