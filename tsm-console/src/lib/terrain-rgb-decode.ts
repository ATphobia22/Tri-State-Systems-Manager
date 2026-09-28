/**
 * Mapbox Terrain-RGB elevation decode (meters).
 * Must match MapLibre raster-dem encoding: 'mapbox' and rio-rgbify --base-val -10000 --interval 0.1
 *
 * height_m = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1
 *
 * Vertical datum is whatever the source DEM used (CONUS 3DEP seamless: NAVD88).
 * This function does not transform datums.
 */

export const TERRAIN_RGB_TILE_SIZE = 256 as const;
export const TERRAIN_RGB_BASE_M = -10000 as const;
export const TERRAIN_RGB_INTERVAL_M = 0.1 as const;

/** Decode one pixel (R,G,B in 0..255) to elevation meters. */
export function decodeTerrainRgbHeightMeters(r: number, g: number, b: number): number {
  const R = r & 255;
  const G = g & 255;
  const B = b & 255;
  return TERRAIN_RGB_BASE_M + (R * 65536 + G * 256 + B) * TERRAIN_RGB_INTERVAL_M;
}

/** Encode elevation meters to RGB (for tests / tooling). */
export function encodeTerrainRgbChannels(heightMeters: number): { r: number; g: number; b: number } {
  const encoded = Math.round((heightMeters - TERRAIN_RGB_BASE_M) / TERRAIN_RGB_INTERVAL_M);
  if (encoded < 0 || encoded > 16777215) {
    throw new RangeError('elevation outside Terrain-RGB representable range');
  }
  return {
    r: (encoded >> 16) & 255,
    g: (encoded >> 8) & 255,
    b: encoded & 255,
  };
}
