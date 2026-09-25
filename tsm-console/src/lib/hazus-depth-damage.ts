/**
 * Hazus-compatible depth-damage engine.
 *
 * Source methodology: FEMA Hazus Flood Technical Manual depth-damage
 * functions (residential curves derived from the USACE generic
 * depth-damage relationships; non-residential curves from Hazus/FIA
 * expert-elicited families). Depth is water depth above the structure's
 * first floor, in feet. Damage is returned as a fraction (0–1) of the
 * structure / contents replacement value; values are linearly
 * interpolated between integer table depths.
 *
 * Table provenance:
 *  - RES-1SNB structural: published USACE generic one-story residential,
 *    no-basement curve as adopted in the Hazus Flood Technical Manual.
 *  - RES-1SNB contents, RES-2SNB, COM, IND: illustrative curves adapted
 *    to the shape and magnitude of the published Hazus/USACE generic
 *    depth-damage function families (two-story flatter than one-story,
 *    commercial/industrial delayed onset).
 *
 * Limitations (read before any real use):
 *  - These are illustrative curves adapted from published generic
 *    functions — NOT FEMA-certified loss estimates, and this module is
 *    NOT FEMA HAZUS software.
 *  - Site-specific curves need local calibration (construction type,
 *    first-floor elevation, basement presence, local cost data).
 *  - Depths beyond the 0–10 ft table are clamped to the 10-ft values;
 *    this is a fail-safe, not an extrapolation — real deep-water damage
 *    must be assessed separately.
 *  - Never treat these outputs as evidence of eligibility, benefits, or
 *    losses for any grant, insurance, or regulatory claim without human
 *    expert review.
 *
 * Fail-closed rules: depth ≤ 0 → zero damage; unknown occupancy,
 * negative dollar values, or non-finite inputs → throw.
 */

// ---------------------------------------------------------------------------
// Provenance: shared labels from `./provenance-labels`. Model outputs from
// this engine are labeled MODELED + DERIVED. This module is Hazus-
// compatible — not FEMA-certified (see header).
// ---------------------------------------------------------------------------

import { makeProvenance, type Provenance } from './provenance-labels';

// ---------------------------------------------------------------------------
// Depth-damage tables.
// ---------------------------------------------------------------------------

export type OccupancyType = 'RES-1SNB' | 'RES-2SNB' | 'COM' | 'IND';

export interface DepthDamagePoint {
  /** Water depth above first floor, feet. */
  depthFt: number;
  /** Structural damage as fraction (0–1) of structure replacement value. */
  structuralPct: number;
  /** Contents damage as fraction (0–1) of contents value. */
  contentsPct: number;
}

/** Highest depth covered by the tables; deeper depths clamp to this row. */
export const MAX_TABLE_DEPTH_FT = 10;

/**
 * Depth-damage tables per occupancy type, at 1-ft increments.
 *
 * Basis:
 *  - RES-1SNB structural row: USACE generic one-story residential,
 *    no-basement curve (adopted in the Hazus Flood Technical Manual).
 *  - All other rows: illustrative adaptations to the published
 *    Hazus/USACE generic function shapes for those occupancy families.
 *    Not FEMA-certified; calibrate locally before real use.
 */
export const DEPTH_DAMAGE_TABLES: Record<OccupancyType, DepthDamagePoint[]> = {
  'RES-1SNB': [
    { depthFt: 0, structuralPct: 0.13, contentsPct: 0.10 },
    { depthFt: 1, structuralPct: 0.23, contentsPct: 0.18 },
    { depthFt: 2, structuralPct: 0.32, contentsPct: 0.26 },
    { depthFt: 3, structuralPct: 0.40, contentsPct: 0.33 },
    { depthFt: 4, structuralPct: 0.47, contentsPct: 0.40 },
    { depthFt: 5, structuralPct: 0.53, contentsPct: 0.46 },
    { depthFt: 6, structuralPct: 0.58, contentsPct: 0.52 },
    { depthFt: 7, structuralPct: 0.62, contentsPct: 0.57 },
    { depthFt: 8, structuralPct: 0.66, contentsPct: 0.61 },
    { depthFt: 9, structuralPct: 0.69, contentsPct: 0.65 },
    { depthFt: 10, structuralPct: 0.71, contentsPct: 0.69 },
  ],
  'RES-2SNB': [
    { depthFt: 0, structuralPct: 0.09, contentsPct: 0.08 },
    { depthFt: 1, structuralPct: 0.16, contentsPct: 0.15 },
    { depthFt: 2, structuralPct: 0.22, contentsPct: 0.21 },
    { depthFt: 3, structuralPct: 0.27, contentsPct: 0.26 },
    { depthFt: 4, structuralPct: 0.32, contentsPct: 0.31 },
    { depthFt: 5, structuralPct: 0.36, contentsPct: 0.36 },
    { depthFt: 6, structuralPct: 0.40, contentsPct: 0.40 },
    { depthFt: 7, structuralPct: 0.44, contentsPct: 0.44 },
    { depthFt: 8, structuralPct: 0.47, contentsPct: 0.47 },
    { depthFt: 9, structuralPct: 0.50, contentsPct: 0.50 },
    { depthFt: 10, structuralPct: 0.53, contentsPct: 0.53 },
  ],
  COM: [
    { depthFt: 0, structuralPct: 0.06, contentsPct: 0.05 },
    { depthFt: 1, structuralPct: 0.12, contentsPct: 0.10 },
    { depthFt: 2, structuralPct: 0.18, contentsPct: 0.15 },
    { depthFt: 3, structuralPct: 0.24, contentsPct: 0.20 },
    { depthFt: 4, structuralPct: 0.29, contentsPct: 0.25 },
    { depthFt: 5, structuralPct: 0.34, contentsPct: 0.30 },
    { depthFt: 6, structuralPct: 0.39, contentsPct: 0.34 },
    { depthFt: 7, structuralPct: 0.43, contentsPct: 0.38 },
    { depthFt: 8, structuralPct: 0.47, contentsPct: 0.42 },
    { depthFt: 9, structuralPct: 0.51, contentsPct: 0.45 },
    { depthFt: 10, structuralPct: 0.54, contentsPct: 0.48 },
  ],
  IND: [
    { depthFt: 0, structuralPct: 0.05, contentsPct: 0.08 },
    { depthFt: 1, structuralPct: 0.10, contentsPct: 0.15 },
    { depthFt: 2, structuralPct: 0.15, contentsPct: 0.22 },
    { depthFt: 3, structuralPct: 0.20, contentsPct: 0.28 },
    { depthFt: 4, structuralPct: 0.24, contentsPct: 0.34 },
    { depthFt: 5, structuralPct: 0.28, contentsPct: 0.39 },
    { depthFt: 6, structuralPct: 0.32, contentsPct: 0.44 },
    { depthFt: 7, structuralPct: 0.35, contentsPct: 0.48 },
    { depthFt: 8, structuralPct: 0.38, contentsPct: 0.52 },
    { depthFt: 9, structuralPct: 0.41, contentsPct: 0.55 },
    { depthFt: 10, structuralPct: 0.44, contentsPct: 0.58 },
  ],
};

// ---------------------------------------------------------------------------
// API.
// ---------------------------------------------------------------------------

export interface DamageInput {
  occupancyType: OccupancyType;
  /** Water depth above first floor, feet. ≤ 0 → zero damage. */
  depthFt: number;
  structureValueUsd: number;
  contentsValueUsd?: number;
}

export interface DamageOutput {
  occupancyType: OccupancyType;
  depthFt: number;
  structuralPct: number;
  structuralUsd: number;
  contentsPct: number;
  contentsUsd: number;
  totalUsd: number;
  methodology: 'Hazus-compatible';
  provenance: Provenance;
}

const OCCUPANCY_TYPES: readonly OccupancyType[] = ['RES-1SNB', 'RES-2SNB', 'COM', 'IND'];

function assertFiniteNumber(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`hazus-depth-damage: ${name} must be a finite number, got ${String(value)}`);
  }
}

/** Linear interpolation of the damage fractions for a depth within [0, 10]. */
function interpolateDamage(table: DepthDamagePoint[], depthFt: number): { structuralPct: number; contentsPct: number } {
  const clamped = Math.min(depthFt, MAX_TABLE_DEPTH_FT);
  for (let i = 1; i < table.length; i++) {
    const lower = table[i - 1];
    const upper = table[i];
    if (clamped <= upper.depthFt) {
      const span = upper.depthFt - lower.depthFt;
      const t = span === 0 ? 0 : (clamped - lower.depthFt) / span;
      return {
        structuralPct: lower.structuralPct + t * (upper.structuralPct - lower.structuralPct),
        contentsPct: lower.contentsPct + t * (upper.contentsPct - lower.contentsPct),
      };
    }
  }
  // Clamped depth never exceeds the last row, but keep a fail-safe return.
  const last = table[table.length - 1];
  return { structuralPct: last.structuralPct, contentsPct: last.contentsPct };
}

/**
 * Compute flood damage for one structure using the Hazus-compatible
 * depth-damage tables. Depth ≤ 0 yields zero damage (never negative).
 * Throws on unknown occupancy, negative dollar values, or non-finite
 * inputs.
 */
export function computeFloodDamage(input: DamageInput): DamageOutput {
  const { occupancyType, depthFt, structureValueUsd } = input;
  const contentsValueUsd = input.contentsValueUsd ?? 0;

  if (!OCCUPANCY_TYPES.includes(occupancyType)) {
    throw new Error(
      `hazus-depth-damage: unknown occupancy type ${JSON.stringify(occupancyType)}; expected one of ${OCCUPANCY_TYPES.join(', ')}`,
    );
  }
  assertFiniteNumber('depthFt', depthFt);
  assertFiniteNumber('structureValueUsd', structureValueUsd);
  assertFiniteNumber('contentsValueUsd', contentsValueUsd);
  if (structureValueUsd < 0) {
    throw new Error('hazus-depth-damage: structureValueUsd must not be negative');
  }
  if (contentsValueUsd < 0) {
    throw new Error('hazus-depth-damage: contentsValueUsd must not be negative');
  }

  let structuralPct = 0;
  let contentsPct = 0;
  if (depthFt > 0) {
    const damage = interpolateDamage(DEPTH_DAMAGE_TABLES[occupancyType], depthFt);
    structuralPct = damage.structuralPct;
    contentsPct = damage.contentsPct;
  }

  const structuralUsd = structureValueUsd * structuralPct;
  const contentsUsd = contentsValueUsd * contentsPct;
  const totalUsd = structuralUsd + contentsUsd;

  return {
    occupancyType,
    depthFt,
    structuralPct,
    structuralUsd,
    contentsPct,
    contentsUsd,
    totalUsd,
    methodology: 'Hazus-compatible',
    provenance: makeProvenance(['MODELED', 'DERIVED'], {
      modelVersion: 'hazus-dd-v1',
    }),
  };
}
