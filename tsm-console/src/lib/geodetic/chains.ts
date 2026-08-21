import type { TransformationStep } from '../../types/evidence';
import {
  EXPECTED_FORWARD_OPS,
  PARAM_SET_ID,
  VELOCITY_MODELS,
  VERTICAL_MODELS,
} from './constants';
import { TransformationContractViolationError } from './errors';

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
        gravimetric_source: VERTICAL_MODELS.grav_d,
      },
    },
  ];
}

/**
 * Future modernization path (WATCH) — template only until NGS production release adopted.
 * EPP changes frame (ITRF2020 → NATRF2022); IFDM changes epoch within frame.
 */
export function buildModernizationWatchChain(opts: {
  observationEpoch: string;
  targetEpoch: string;
}): TransformationStep[] {
  return [
    {
      step: 1,
      operation: 'epp2022_frame',
      from: 'ITRF2020',
      to: 'NATRF2022',
      software: 'NGS EPP2022 (beta)',
      parameters: {
        model: VELOCITY_MODELS.epp2022,
        epp: VELOCITY_MODELS.natrf2022_epp_mas_per_yr,
        reference_epoch: VELOCITY_MODELS.natrf_epoch,
        note: 'Rigid plate rotation; does not change epoch',
      },
    },
    {
      step: 2,
      operation: 'ifdm_propagate',
      from: `NATRF2022@${opts.observationEpoch}`,
      to: `NATRF2022@${opts.targetEpoch}`,
      software: 'NGS IFDM2022 (watch)',
      parameters: {
        model: VELOCITY_MODELS.ifdm2022,
        t1: opts.observationEpoch,
        t2: opts.targetEpoch,
        includes_vertical_velocity: true,
        alters_orthometric_site_constants: false,
        note: 'Residual intra-plate motion after EPP; epoch change only',
      },
    },
  ];
}
