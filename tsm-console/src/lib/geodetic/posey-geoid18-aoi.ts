/**
 * Posey AOI GEOID18 educational sampler (Scope B).
 * Static samples only — Pages-safe. Not a full-grid substitute.
 * Equation: H_NAVD88 = h_NAD83(2011) - N_GEOID18
 */

export type Geoid18AoiPoint = {
  id: string;
  lat: number;
  lon: number;
  N_m: number;
  note: string;
};

export type Geoid18AoiCatalog = {
  schema: string;
  authorityClass: 'DERIVED';
  model: 'GEOID18';
  horizontalFrame: string;
  verticalDatum: 'NAVD88';
  equation: string;
  fit_uncertainty_conus_1sigma_cm: number;
  disclaimer: string;
  aoi: { name: string; bbox: [number, number, number, number] };
  points: Geoid18AoiPoint[];
};

export type ConversionResult = {
  ok: true;
  mode: 'h_to_H' | 'H_to_h';
  input_m: number;
  N_m: number;
  output_m: number;
  output_ft: number;
  point: Geoid18AoiPoint;
  model: 'GEOID18';
  authorityClass: 'DERIVED';
  fit_sigma_cm: number;
  disclaimer: string;
} | {
  ok: false;
  reason: string;
};

const METERS_TO_FT = 3.280839895;

let cached: Geoid18AoiCatalog | null = null;

export async function loadPoseyGeoid18Aoi(
  baseUrl = `${import.meta.env.BASE_URL}data/geoid/posey-geoid18-aoi-samples.json`,
): Promise<Geoid18AoiCatalog> {
  if (cached) return cached;
  const res = await fetch(baseUrl, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`GEOID18 AOI catalog unavailable (${res.status})`);
  const data = (await res.json()) as Geoid18AoiCatalog;
  if (!data?.points?.length || data.model !== 'GEOID18') {
    throw new Error('GEOID18 AOI catalog failed schema checks');
  }
  cached = data;
  return data;
}

/** Nearest sample by great-circle distance (educational; not spatial interpolation of the full grid). */
export function nearestAoiPoint(
  catalog: Geoid18AoiCatalog,
  lat: number,
  lon: number,
): Geoid18AoiPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || catalog.points.length === 0) return null;
  let best: Geoid18AoiPoint | null = null;
  let bestD = Infinity;
  for (const p of catalog.points) {
    const dlat = (p.lat - lat) * Math.PI / 180;
    const dlon = (p.lon - lon) * Math.PI / 180;
    const a = Math.sin(dlat / 2) ** 2
      + Math.cos(lat * Math.PI / 180) * Math.cos(p.lat * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
    const d = 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Convert ellipsoid h → orthometric H, or reverse.
 * Fail-closed: requires a catalog point (no invented N).
 */
export function convertWithAoiN(
  catalog: Geoid18AoiCatalog,
  opts: { mode: 'h_to_H' | 'H_to_h'; value_m: number; lat: number; lon: number },
): ConversionResult {
  if (!Number.isFinite(opts.value_m)) {
    return { ok: false, reason: 'Height must be a finite number in meters.' };
  }
  const point = nearestAoiPoint(catalog, opts.lat, opts.lon);
  if (!point) {
    return { ok: false, reason: 'No GEOID18 AOI sample near this location (fail-closed).' };
  }
  const N = point.N_m;
  const output_m = opts.mode === 'h_to_H' ? opts.value_m - N : opts.value_m + N;
  return {
    ok: true,
    mode: opts.mode,
    input_m: opts.value_m,
    N_m: N,
    output_m,
    output_ft: output_m * METERS_TO_FT,
    point,
    model: 'GEOID18',
    authorityClass: 'DERIVED',
    fit_sigma_cm: catalog.fit_uncertainty_conus_1sigma_cm,
    disclaimer: catalog.disclaimer,
  };
}
