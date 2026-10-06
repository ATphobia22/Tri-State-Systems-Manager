/**
 * Terrain-RGB / MapLibre 3D terrain contract (fail-closed).
 *
 * MapLibre `setTerrain()` is allowed only when a materialized, provenance-controlled
 * Terrain-RGB XYZ template is supplied via VITE_TSM_TERRAIN_RGB_URL_TEMPLATE.
 * Missing, placeholder, or non-template values must not enable 3D terrain mesh.
 *
 * Production: HTTPS + real host only (not example.com, YOUR-HOST, bare localhost).
 * Development: http://localhost (or 127.0.0.1) may be allowed when allowHttpLocal
 * so ops/terrain-rgb-server can be tested before HTTPS publish.
 *
 * Public open-data (AWS Mapzen Terrarium, Mapterhorn) may be used for visualization
 * with encoding=terrarium — still OBSERVATION, not LOMA/NFIP evidence.
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

/** Always rejected (production and development). */
const PLACEHOLDER_PATTERNS = [
  /example\.invalid/i,
  /example\.com/i,
  /example\.org/i,
  /example\.net/i,
  /YOUR[-_]?HOST/i,
  /YOUR[-_]?PROVENANCE[-_]?HOST/i,
  /YOUR[-_]?DOMAIN/i,
  /REPLACE[-_]?ME/i,
  /placeholder/i,
  /\$\{VITE_TSM_TERRAIN/,
];

/** Rejected in production; allowed only when allowHttpLocal (npm run dev). */
const LOCAL_HOST_PATTERNS = [/localhost/i, /127\.0\.0\.1/, /0\.0\.0\.0/];

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOST_PATTERNS.some((re) => re.test(hostname));
}

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
      .replace(/\{z\}/g, '0')
      .replace(/\{x\}/g, '0')
      .replace(/\{y\}/g, '0');
    url = new URL(probe);
  } catch {
    return { enabled: false, template: null, reason: 'invalid_template' };
  }

  const host = url.hostname.toLowerCase();
  const allowLocal = options?.allowHttpLocal === true;

  if (isLocalHost(host) && !allowLocal) {
    return { enabled: false, template: null, reason: 'placeholder' };
  }

  if (url.protocol === 'https:') {
    if (isLocalHost(host) && !allowLocal) {
      return { enabled: false, template: null, reason: 'placeholder' };
    }
    return { enabled: true, template: trimmed, reason: 'configured' };
  }

  if (url.protocol === 'http:') {
    if (allowLocal && isLocalHost(host)) {
      return { enabled: true, template: trimmed, reason: 'configured' };
    }
    return { enabled: false, template: null, reason: 'insecure_scheme' };
  }

  return { enabled: false, template: null, reason: 'invalid_template' };
}

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
      return 'MapLibre 3D terrain mesh: FAIL-CLOSED — template looks like a placeholder/example/local host. Refusing synthetic or demo terrain.';
    case 'invalid_template':
      return 'MapLibre 3D terrain mesh: FAIL-CLOSED — template must be an absolute URL containing {z}, {x}, and {y}.';
    case 'insecure_scheme':
      return 'MapLibre 3D terrain mesh: FAIL-CLOSED — production templates must use https:// on a real host.';
    default:
      return 'MapLibre 3D terrain mesh: FAIL-CLOSED.';
  }
}

export const TERRAIN_RGB_SOURCE_ID = 'tsm-terrain-rgb' as const;
export const TERRAIN_RGB_ENCODING = 'mapbox' as const;
export const TERRAIN_RGB_TILE_SIZE = 256 as const;
export const TERRAIN_RGB_DEFAULT_EXAGGERATION = 1.0 as const;

export type TerrainRgbEncoding = 'mapbox' | 'terrarium';

export function resolveTerrainRgbEncoding(
  raw: string | undefined = import.meta.env.VITE_TSM_TERRAIN_RGB_ENCODING,
): TerrainRgbEncoding {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'terrarium') return 'terrarium';
  return 'mapbox';
}

export function resolveTerrainRgbTileSize(
  raw: string | undefined = import.meta.env.VITE_TSM_TERRAIN_RGB_TILE_SIZE,
): number {
  const n = Number(raw);
  if (n === 512) return 512;
  return 256;
}

export function resolveTerrainRgbMaxZoom(
  raw: string | undefined = import.meta.env.VITE_TSM_TERRAIN_RGB_MAXZOOM,
): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0 && n <= 22) return Math.floor(n);
  // Deployed Terrain-RGB pyramid is z8–z12 (see CI terrain generation);
  // MapLibre overzooms from z12 rather than requesting missing tiles.
  return 12;
}

export const PUBLIC_TERRAIN_SOURCES = {
  aws_mapzen_terrarium: {
    template: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    encoding: 'terrarium' as const,
    tileSize: 256,
    maxzoom: 15,
    authority: 'AWS Open Data / Mapzen Terrain Tiles',
    notes: 'Global terrarium DEM; free HTTPS; OBSERVATION visualization only',
  },
  mapterhorn_terrarium: {
    template: 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp',
    encoding: 'terrarium' as const,
    tileSize: 512,
    maxzoom: 17,
    authority: 'Mapterhorn',
    notes: 'Terrarium WebP 512px; free HTTPS CDN',
  },
} as const;
