import type { TransformationStep } from '../../types/evidence';
import { SITE } from '../../types/site';
import {
  AUTHORITATIVE_HORIZONTAL_EPSG,
  AUTHORITATIVE_VERTICAL,
  REJECTED_HORIZONTAL_EPSG,
} from './constants';
import { TransformationContractViolationError } from './errors';

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
    if (step.operation === 'ifdm_propagate' && step.parameters?.alters_orthometric_site_constants) {
      throw new TransformationContractViolationError(
        'IFDM must not mutate immutable site BFE/LAG/FFE constants',
        'IFDM_SITE_CONSTANT_MUTATION'
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
