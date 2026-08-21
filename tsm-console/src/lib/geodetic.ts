/**
 * TSM Geodetic subsystem (streamlined)
 * Analysis frame: EPSG:2966 + NAVD88
 * Chains record NGS HTDP / GEOID18 contracts — numeric grids stay offline.
 */

import type { TransformationStep } from '../types/evidence';
import { SITE } from '../types/site';

// ── Constants ──────────────────────────────────────────────
export const AUTHORITATIVE_HORIZONTAL_EPSG = 2966 as const;
export const REJECTED_HORIZONTAL_EPSG = [2967] as const;
export const AUTHORITATIVE_VERTICAL = 'NAVD88' as const;
export const PARAM_SET_ID = 'NGS-HTDP-ITRF2014-v2' as const;

export const PROJ4_EPSG_2966 =
  '+proj=tmerc +lat_0=37.5 +lon_0=-87.0833333333333 +k=0.999966667 +x_0=900000 +y_0=249999.9998984 +ellps=GRS80 +units=us-ft +no_defs';

/** HTDP / modernization velocity model names (reference only) */
export const VELOCITY_MODELS = {
  /** Classical HTDP interseismic field + Okada coseismic */
  htdp_interseismic: 'HTDP-velocity-field',
  htdp_coseismic: 'HTDP-Okada-initeq',
  /** NSRS modernization (watch) */
  epp2022: 'EPP2022',
  ifdm2022: 'IFDM2022',
  /** Stable plate interior — Posey typical */
  posey_coseismic_relevant: false,
  /** Illustrative stable-interior rate order of magnitude (not site-specific) */
  stable_interior_mm_per_yr_order: 15,
} as const;

/** Vertical models */
export const VERTICAL_MODELS = {
  authoritative: 'NAVD88',
  ellipsoid_to_orthometric: 'GEOID18',
  ngvd29_to_navd88: 'VERTCON3',
  future_geoid: 'GEOID2022',
  future_datum: 'NAPGD2022',
  geoid18_conus_sigma_cm: 1.27,
  geoid18_gpsbm_count: 32357,
  reject_new_without_chain: ['NAVD29', 'NGVD29'] as const,
} as const;

export const GEODETIC_POLICY = {
  analysis_frame: 'EPSG:2966 + NAVD88',
  display_frame: 'WGS84 / Web Mercator (MapLibre)',
  htdp_coseismic_relevant_to_posey: false,
  reject_epsg: REJECTED_HORIZONTAL_EPSG,
  velocity_models: VELOCITY_MODELS,
  vertical_models: VERTICAL_MODELS,
} as const;

export const EXPECTED_FORWARD_OPS = [
  'inverse_transverse_mercator',
  'geodetic_to_ecef',
  'helmert_14_param',
  'htdp_propagate',
  'ecef_to_geodetic',
] as const;

// ── Errors ─────────────────────────────────────────────────
export class TransformationContractViolationError extends Error {
  code: string;
  constructor(message: string, code = 'TRANSFORM_CONTRACT') {
    super(message);
    this.name = 'TransformationContractViolationError';
    this.code = code;
  }
}

// ── Spatial / vertical stamps ──────────────────────────────
export function siteSpatialReference() {
  return {
    horizontal_crs: `EPSG:${SITE.crs.horizontalEpsg}`,
    horizontal_crs_name: SITE.crs.horizontalName,
    units: 'US survey feet',
  };
}

export function siteVerticalReference() {
  return {
    vertical_datum: SITE.crs.verticalDatum,
    units: 'ft',
  };
}

export function siteVerticalBoundary() {
  return {
    vertical_datum: AUTHORITATIVE_VERTICAL,
    bfe_ft: SITE.elevations.bfe_ft,
    lag_ft: SITE.elevations.lag_ft,
    ffe_ft: SITE.elevations.ffe_ft,
    berm_crest_ft: SITE.elevations.bermCrest_ft,
    immutable: true as const,
  };
}

export function siteCenterWgs84(): [number, number] {
  const { minLon, maxLon, minLat, maxLat } = SITE.boundingEnvelope;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

// ── Guards ─────────────────────────────────────────────────
export function assertAuthoritativeHorizontal(epsg: number | string): void {
  const n = typeof epsg === 'string' ? Number(String(epsg).replace(/EPSG:/i, '')) : epsg;
  if ((REJECTED_HORIZONTAL_EPSG as readonly number[]).includes(n as 2967)) {
    throw new TransformationContractViolationError(
      `Rejected CRS EPSG:${n}. Use EPSG:${AUTHORITATIVE_HORIZONTAL_EPSG}.`,
      'REJECTED_EPSG'
    );
  }
}

export function assertNoDirectPlanarHelmert(attempt: boolean): void {
  if (attempt) {
    throw new TransformationContractViolationError(
      'Direct planar-to-Helmert forbidden. Inverse EPSG:2966 to NAD83 geodetic first.',
      'DIRECT_PLANAR_HELMERT'
    );
  }
}

export function assertVerticalIsolation(artifact: {
  vertical_reference?: { vertical_datum?: string };
  vertical_datum?: string;
  elevations?: Partial<typeof SITE.elevations>;
  transformation_chain?: TransformationStep[];
}): void {
  const vd =
    artifact.vertical_reference?.vertical_datum ??
    artifact.vertical_datum ??
    AUTHORITATIVE_VERTICAL;
  if (vd !== AUTHORITATIVE_VERTICAL) {
    throw new TransformationContractViolationError(
      `Vertical datum must remain ${AUTHORITATIVE_VERTICAL}; got ${vd}`,
      'VERTICAL_SUBSTITUTION'
    );
  }
  for (const step of artifact.transformation_chain ?? []) {
    if (step.operation === 'htdp_propagate' && step.parameters?.alters_orthometric) {
      throw new TransformationContractViolationError(
        'HTDP must not alter orthometric heights',
        'HTDP_VERTICAL_OVERRIDE'
      );
    }
  }
  const e = artifact.elevations;
  if (e) {
    for (const key of ['bfe_ft', 'lag_ft', 'ffe_ft'] as const) {
      if (e[key] !== undefined && e[key] !== SITE.elevations[key]) {
        throw new TransformationContractViolationError(`${key} mutated`, 'SITE_CONSTANT_MUTATION');
      }
    }
  }
}

// ── Chain builders ─────────────────────────────────────────
export function buildNad83ToItrf2014Chain(opts: {
  observationEpoch: string;
  targetEpoch?: string;
  coseismicApplied?: boolean;
  software?: string;
  paramSetId?: string;
}): TransformationStep[] {
  if (!opts.observationEpoch || !/^\d{4}(\.\d+)?$/.test(opts.observationEpoch)) {
    throw new TransformationContractViolationError(
      `Malformed observation epoch: ${opts.observationEpoch}`,
      'MALFORMED_EPOCH'
    );
  }
  const t2 = opts.targetEpoch ?? '2010.0';
  const soft = opts.software ?? `HTDP/${opts.paramSetId ?? PARAM_SET_ID}`;
  const coseismic = opts.coseismicApplied ?? VELOCITY_MODELS.posey_coseismic_relevant;
  const paramSet = opts.paramSetId ?? PARAM_SET_ID;

  return [
    {
      step: 1,
      operation: 'inverse_transverse_mercator',
      from: 'EPSG:2966',
      to: 'NAD83 geodetic',
      software: soft,
      parameters: { units: 'us-ft', note: 'Never Helmert easting/northing directly' },
    },
    {
      step: 2,
      operation: 'geodetic_to_ecef',
      from: 'NAD83 geodetic',
      to: 'NAD83 ECEF',
      software: soft,
      parameters: { epoch: opts.observationEpoch, ellipsoid: 'GRS80' },
    },
    {
      step: 3,
      operation: 'helmert_14_param',
      from: 'NAD83 ECEF',
      to: 'ITRF2014 ECEF',
      software: soft,
      parameters: {
        epoch: opts.observationEpoch,
        param_set_id: paramSet,
        translations: 3,
        rotations: 3,
        scale: 1,
        rates: 7,
      },
    },
    {
      step: 4,
      operation: 'htdp_propagate',
      from: `ITRF2014 ECEF@${opts.observationEpoch}`,
      to: `ITRF2014 ECEF@${t2}`,
      software: soft,
      parameters: {
        t1: opts.observationEpoch,
        t2,
        coseismic_applied: coseismic,
        velocity_model: VELOCITY_MODELS.htdp_interseismic,
        region_note: 'Posey County IN — stable interior; coseismic typically false',
      },
    },
    {
      step: 5,
      operation: 'ecef_to_geodetic',
      from: `ITRF2014 ECEF@${t2}`,
      to: `ITRF2014 geodetic@${t2}`,
      software: soft,
      parameters: { epoch: t2 },
    },
  ];
}

/** Alias used by pipeline / tests */
export function buildForwardChainContract(opts: {
  observationEpoch: string;
  targetEpoch?: string;
  paramSetId?: string;
}): TransformationStep[] {
  return buildNad83ToItrf2014Chain(opts);
}

export function validateForwardChain(chain: TransformationStep[]): void {
  if (!Array.isArray(chain) || chain.length < 5) {
    throw new TransformationContractViolationError(
      'Forward chain incomplete (need 2966→geo→ECEF→Helmert→HTDP→geo)',
      'CHAIN_INCOMPLETE'
    );
  }
  for (let i = 0; i < EXPECTED_FORWARD_OPS.length; i++) {
    if (chain[i]?.operation !== EXPECTED_FORWARD_OPS[i]) {
      throw new TransformationContractViolationError(
        `Step ${i + 1}: expected ${EXPECTED_FORWARD_OPS[i]}, got ${chain[i]?.operation}`,
        'CHAIN_ORDER'
      );
    }
  }
  if (!chain.find((s) => s.operation === 'helmert_14_param')?.parameters?.param_set_id) {
    throw new TransformationContractViolationError(
      'Missing parameter set identifier on Helmert step',
      'MISSING_PARAM_SET'
    );
  }
}

export function buildEllipsoidToNavd88Chain(opts?: {
  geoidModel?: string;
  software?: string;
}): TransformationStep[] {
  const model = opts?.geoidModel ?? VERTICAL_MODELS.ellipsoid_to_orthometric;
  const soft = opts?.software ?? 'NGS NCAT / GEOID18';
  return [
    {
      step: 1,
      operation: 'geoid_separation',
      from: 'NAD83 ellipsoid height h',
      to: 'NAVD88 orthometric H',
      software: soft,
      parameters: {
        model,
        relation: 'H ≈ h - N',
        conus_sigma_cm: VERTICAL_MODELS.geoid18_conus_sigma_cm,
      },
    },
  ];
}

export async function sealGeodeticEvidence(payload: unknown): Promise<{
  content_hash_sha256: string;
  artifact_type: string;
  spatial_reference: ReturnType<typeof siteSpatialReference>;
  vertical_boundary: ReturnType<typeof siteVerticalBoundary>;
}> {
  const canonical = JSON.stringify(payload);
  const buf = new TextEncoder().encode('TSM_LEAF:' + canonical);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const content_hash_sha256 = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return {
    content_hash_sha256,
    artifact_type: 'tsm.geodetic.evidence.v1',
    spatial_reference: siteSpatialReference(),
    vertical_boundary: siteVerticalBoundary(),
  };
}
