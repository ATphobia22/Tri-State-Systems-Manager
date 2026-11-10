/**
 * Terrain-RGB / Mapbox Terrarium-style heightmap codec.
 *
 * Terrarium (Mapzen/Tilezen) encoding commonly used with 3DEP-derived tiles:
 *   height_m = (R * 256 + G + B / 256) - 32768
 *
 * Mapbox Terrain-RGB:
 *   height_m = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1
 *
 * Outputs are DERIVED screening elevations — not survey LAG/BFE.
 */

export const TERRAIN_RGB_AUTHORITY = "DERIVED" as const;

export type Rgb = { r: number; g: number; b: number };

/** Decode Mapzen Terrarium RGB → meters. */
export function decodeTerrariumMeters(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** Encode meters → Terrarium RGB (0–255 channels). */
export function encodeTerrariumMeters(heightM: number): Rgb {
  const v = heightM + 32768;
  const r = Math.min(255, Math.max(0, Math.floor(v / 256)));
  const g = Math.min(255, Math.max(0, Math.floor(v % 256)));
  const b = Math.min(255, Math.max(0, Math.floor((v - Math.floor(v)) * 256)));
  return { r, g, b };
}

/** Decode Mapbox Terrain-RGB → meters. */
export function decodeMapboxTerrainRgbMeters(r: number, g: number, b: number): number {
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

/** Encode meters → Mapbox Terrain-RGB. */
export function encodeMapboxTerrainRgbMeters(heightM: number): Rgb {
  const v = (heightM + 10000) / 0.1;
  const n = Math.max(0, Math.min(16777215, Math.round(v)));
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

export function metersToFeet(m: number): number {
  return m * 3.280839895;
}

export function feetToMeters(ft: number): number {
  return ft / 3.280839895;
}

/**
 * Sample a decoded height and label authority.
 * Does not assign NAVD88 survey status — caller must track product vertical datum.
 */
export function sampleDerivedElevationFt(
  heightM: number,
  options?: { verticalDatumLabel?: string }
): {
  elevationFt: number;
  elevationM: number;
  authority: typeof TERRAIN_RGB_AUTHORITY;
  verticalDatumLabel: string;
  disclaimer: string;
} {
  return {
    elevationM: heightM,
    elevationFt: metersToFeet(heightM),
    authority: TERRAIN_RGB_AUTHORITY,
    verticalDatumLabel: options?.verticalDatumLabel ?? "PRODUCT_NATIVE_OR_UNSPECIFIED",
    disclaimer:
      "Terrain-RGB/Terrarium sample is DERIVED screening geometry. Not PE survey LAG/BFE. Confirm product vertical datum before engineering use.",
  };
}
