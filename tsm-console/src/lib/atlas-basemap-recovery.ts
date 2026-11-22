import type { StyleSpecification } from 'maplibre-gl';

/** Keyless local style fallback: no fake roads, contour elevations or imagery. */
export function createAtlasFallbackStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{
      id: 'tsm-basemap-unavailable',
      type: 'background',
      paint: { 'background-color': '#1d4154' },
    }],
  };
}

/** Only the primary style-fetch failure triggers early fallback; tile warnings
 * after successful initialization are surfaced without tearing down the map. */
export function isAtlasBasemapError(message: string): boolean {
  const error = message.toLowerCase();
  return error.includes('tiles.openfreemap.org/styles/liberty') ||
    (error.includes('style') && (error.includes('failed to fetch') ||
      error.includes('not found') || error.includes('load failed')));
}
