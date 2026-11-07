/**
 * Empirical semivariogram for DEM/survey residuals.
 * Authority class: DERIVED — never writes certified LAG / LOMA elevations.
 *
 * γ(h) = 1/(2 N(h)) Σ (z(x_i) - z(x_i+h))²
 */

export interface SemivariogramBin {
  readonly lagCenterM: number;
  readonly gamma: number;
  readonly pairCount: number;
  readonly sufficient: boolean;
}

export interface SemivariogramResult {
  readonly bins: SemivariogramBin[];
  readonly maxDistM: number;
  readonly minPairs: number;
  readonly authorityClass: 'DERIVED';
  readonly crsNote: string;
}

export interface MetricCrsGuard {
  /** Must be a projected metric CRS (e.g. EPSG:2966), not geographic degrees. */
  readonly epsg: number;
  readonly units: 'metre' | 'meter';
}

const METRIC_EPSG_ALLOW = new Set([2965, 2966, 26915, 26916, 6458, 6459]);

export function assertMetricCrs(crs: MetricCrsGuard): void {
  if (crs.units !== 'metre' && crs.units !== 'meter') {
    throw new Error('Semivariogram requires metric CRS units (metres), not degrees');
  }
  if (!METRIC_EPSG_ALLOW.has(crs.epsg) && crs.epsg < 2000) {
    throw new Error(
      `Refusing geographic or unlisted CRS EPSG:${crs.epsg}. Reproject to metric (e.g. EPSG:2966) before hypot(dx,dy).`,
    );
  }
}

export function empiricalSemivariogram(
  x: Float64Array | number[],
  y: Float64Array | number[],
  z: Float64Array | number[],
  options: {
    nLags?: number;
    maxDistM?: number;
    minPairs?: number;
    crs?: MetricCrsGuard;
  } = {},
): SemivariogramResult {
  const nLags = options.nLags ?? 15;
  const minPairs = options.minPairs ?? 30;
  if (options.crs) assertMetricCrs(options.crs);

  const n = z.length;
  if (x.length !== n || y.length !== n) throw new Error('x, y, z length mismatch');
  if (n < 2) {
    return {
      bins: [],
      maxDistM: 0,
      minPairs,
      authorityClass: 'DERIVED',
      crsNote: options.crs ? `EPSG:${options.crs.epsg}` : 'caller-provided metric',
    };
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    if (x[i] < minX) minX = x[i];
    if (x[i] > maxX) maxX = x[i];
    if (y[i] < minY) minY = y[i];
    if (y[i] > maxY) maxY = y[i];
  }
  const maxDistM = options.maxDistM ?? 0.5 * Math.hypot(maxX - minX, maxY - minY);

  const lagEdges = new Array(nLags + 1);
  for (let k = 0; k <= nLags; k++) lagEdges[k] = (maxDistM * k) / nLags;
  const sumSq = new Float64Array(nLags);
  const counts = new Float64Array(nLags);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const h = Math.hypot(x[j] - x[i], y[j] - y[i]);
      if (h <= 0 || h >= maxDistM) continue;
      const k = Math.min(nLags - 1, Math.floor((h / maxDistM) * nLags));
      const dz = z[j] - z[i];
      sumSq[k] += dz * dz;
      counts[k] += 1;
    }
  }

  const bins: SemivariogramBin[] = [];
  for (let k = 0; k < nLags; k++) {
    const c = counts[k];
    const gamma = c >= minPairs ? 0.5 * (sumSq[k] / c) : Number.NaN;
    bins.push({
      lagCenterM: 0.5 * (lagEdges[k] + lagEdges[k + 1]),
      gamma,
      pairCount: c,
      sufficient: c >= minPairs,
    });
  }

  return {
    bins,
    maxDistM,
    minPairs,
    authorityClass: 'DERIVED',
    crsNote: options.crs ? `EPSG:${options.crs.epsg}` : 'caller-provided metric',
  };
}

export function sphericalModel(h: number, nugget: number, sill: number, range: number): number {
  if (range <= 0) return nugget + sill;
  if (h <= 0) return nugget;
  if (h >= range) return nugget + sill;
  const a = h / range;
  return nugget + sill * (1.5 * a - 0.5 * a * a * a);
}

export function exponentialModel(h: number, nugget: number, sill: number, range: number): number {
  if (range <= 0) return nugget + sill;
  if (h <= 0) return nugget;
  return nugget + sill * (1 - Math.exp(-3 * h / range));
}

export interface FittedModel {
  readonly model: 'spherical' | 'exponential';
  readonly nugget: number;
  readonly sill: number;
  readonly rangeM: number;
  readonly rmseFit: number;
  readonly authorityClass: 'DERIVED';
}

export function fitSemivariogramGrid(
  bins: readonly SemivariogramBin[],
  model: 'spherical' | 'exponential' = 'spherical',
): FittedModel | null {
  const pts = bins.filter((b) => b.sufficient && Number.isFinite(b.gamma));
  if (pts.length < 3) return null;

  const gammas = pts.map((b) => b.gamma);
  const sill0 = Math.max(...gammas);
  const nugget0 = Math.min(...gammas);
  const maxH = Math.max(...pts.map((b) => b.lagCenterM));

  let best: FittedModel | null = null;
  const fn = model === 'spherical' ? sphericalModel : exponentialModel;

  for (let ni = 0; ni <= 5; ni++) {
    const nugget = nugget0 * (ni / 5);
    for (let si = 1; si <= 8; si++) {
      const sill = Math.max(1e-9, (sill0 - nugget) * (si / 8));
      for (let ri = 1; ri <= 10; ri++) {
        const rangeM = (maxH * ri) / 10;
        let sse = 0;
        for (const b of pts) {
          const pred = fn(b.lagCenterM, nugget, sill, rangeM);
          const e = b.gamma - pred;
          sse += e * e;
        }
        const rmseFit = Math.sqrt(sse / pts.length);
        if (!best || rmseFit < best.rmseFit) {
          best = { model, nugget, sill, rangeM, rmseFit, authorityClass: 'DERIVED' };
        }
      }
    }
  }
  return best;
}
