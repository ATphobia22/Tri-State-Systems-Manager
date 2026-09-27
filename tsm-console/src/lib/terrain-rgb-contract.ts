/**
 * Terrain-RGB / MapLibre 3D terrain contract (fail-closed).
 *
 * MapLibre `setTerrain()` is allowed only when a materialized, provenance-controlled
 * Terrain-RGB XYZ template is supplied via VITE_TSM_TERRAIN_RGB_URL_TEMPLATE.
 * Missing, placeholder, or non-template values must not enable 3D terrain mesh.
 *
 * Hillshade / 3DEP WMS visualization remains a separate OBSERVATION layer and is
 * not a substitute for raster-dem elevation mesh.
 */

export type TerrainRgbStatus =
  | { enabled: true; template: string; reason: 'configured' }
  | { enabled: false; template: null; reason: TerrainRgbBlockReason };

export type TerrainRgbBlockReason =
  | 'missing'
  | 'placeholder'
  | 'invalid_template'
  | 'insecure_scheme';

const PLACEHOLDER_PATTERNS = [
  /example\.invalid/i,
  /example\.com/i,
  /example\.org/i,
  /YOUR[-_]?HOST/i,
  /REPLACE[-_]?ME/i,
  /placeholder/i,
  /localhost/i,
  /127\.0\.0\.1/,
  /\$\{VITE_TSM_TERRAIN/,
];

/**
 * Validate a candidate XYZ template for MapLibre raster-dem.
 * Requires https (or http only when explicitly allowed for local tile servers),
 * and MapLibre tile tokens {z}/{x}/{y} (order flexible).
 */
export function validateTerrainRgbUrlTemplate(
  raw: string | undefined | null,
  options?: { allowHttpLocal?: boolean },
): TerrainRgbStatus {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return { enabled: false, template: null, reason: 'missing' };
  }
  for (const re of PLACEHOLDER_PATTERNS) {
    if (re.test(trimmed)) {
      return { enabled: false, template: null, reason: 'placeholder' };
    }
  }
  const hasZ = trimmed.includes('{z}');
  const hasX = trimmed.includes('{x}');
  const hasY = trimmed.includes('{y}');
  if (!hasZ || !hasX || !hasY) {
    return { enabled: false, template: null, reason: 'invalid_template' };
  }
  let url: URL;
  try {
    const probe = trimmed
      .replace('{z}', '0')
      .replace('{x}', '0')
      .replace('{y}', '0');
    url = new URL(probe);
  } catch {
    return { enabled: false, template: null, reason: 'invalid_template' };
  }
  if (url.protocol === 'https:') {
    return { enabled: true, template: trimmed, reason: 'configured' };
  }
  if (url.protocol === 'http:' && options?.allowHttpLocal) {
    return { enabled: true, template: trimmed, reason: 'configured' };
  }
  if (url.protocol === 'http:') {
    return { enabled: false, template: null, reason: 'insecure_scheme' };
  }
  return { enabled: false, template: null, reason: 'invalid_template' };
}

/** Resolve status from Vite env (build-time injection). */
export function resolveTerrainRgbFromEnv(
  envValue: string | undefined = import.meta.env.VITE_TSM_TERRAIN_RGB_URL_TEMPLATE,
): TerrainRgbStatus {
  const isDev = import.meta.env.DEV === true;
  return validateTerrainRgbUrlTemplate(envValue, { allowHttpLocal: isDev });
}

export function terrainRgbBlockMessage(status: TerrainRgbStatus): string {
  if (status.enabled) {
    return 'MapLibre 3D terrain mesh: ENABLED (provenance-controlled Terrain-RGB template).';
  }
  switch (status.reason) {
    case 'missing':
      return 'MapLibre 3D terrain mesh: FAIL-CLOSED — VITE_TSM_TERRAIN_RGB_URL_TEMPLATE not set. Flat basemap only; no synthetic elevation.';
    case 'placeholder':
      return 'MapLibre 3D terrain mesh: FAIL-CLOSED — template looks like a placeholder/example host. Refusing synthetic or demo terrain.';
    case 'invalid_template':
      return 'MapLibre 3D terrain mesh: FAIL-CLOSED — template must be an absolute URL containing {z}, {x}, and {y}.';
    case 'insecure_scheme':
      return 'MapLibre 3D terrain mesh: FAIL-CLOSED — production templates must use https://.';
    default:
      return 'MapLibre 3D terrain mesh: FAIL-CLOSED.';
  }
}

/** MapLibre source id used when terrain is enabled. */
export const TERRAIN_RGB_SOURCE_ID = 'tsm-terrain-rgb' as const;

export const TERRAIN_RGB_ENCODING = 'mapbox' as const;
export const TERRAIN_RGB_TILE_SIZE = 256 as const;
export const TERRAIN_RGB_DEFAULT_EXAGGERATION = 1.0 as const;
