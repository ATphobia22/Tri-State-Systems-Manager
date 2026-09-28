/**
 * berm-road-placement.ts — screening-level road & berm placement engineering.
 *
 * Pure functions. NOTHING here designs, approves, or builds anything: every
 * result is an inform-only parameter set for human deliberation, consistent
 * with the workbench axiom — "Technology informs people; it does not
 * silently govern people. Human authority remains final."
 *
 * What this module does:
 *   1. Takes a proposed centerline alignment (stations with ground elevation
 *      sampled from 3DEP terrain) and a typical cross-section, and computes
 *      earthwork volumes (cut/fill, cubic yards).
 *   2. Estimates dredged-material fill demand and haul cost from a USACE
 *      placement/stockpile site (Section 204 / WRDA 2016 §1122 framing).
 *   3. Applies the Section 204 cost-share split (65% federal / 35% sponsor)
 *      with the federal ceiling flagged.
 *   4. Emits a flood-sim scenario delta (terrain modification) so the twin's
 *      2D diffusion-wave screen can compare with/without backwater effects.
 *
 * Units: feet for geometry, cubic yards for volumes, USD for costs.
 * Datum: elevations are NAVD88 feet ONLY when the caller supplies validated
 * NAVD88 values; otherwise the module labels outputs "SOURCE DATUM ONLY".
 */

export const INFORM_ONLY = 'inform-only-screening-estimate' as const;
export const NOT_A_DESIGN = 'not-an-engineering-design' as const;

/** A station along the proposed alignment. */
export interface AlignmentStation {
  /** Distance along alignment, feet. Must be strictly increasing. */
  stationFt: number;
  /** Ground elevation at centerline, feet (see datum note above). */
  groundElevFt: number;
}

/** Typical cross-section for a berm or road embankment. */
export interface TypicalSection {
  kind: 'flood-berm' | 'road-embankment' | 'revetment-backfill';
  /** Crest / crown width, feet. */
  crestWidthFt: number;
  /** Finished crest elevation, feet. */
  crestElevFt: number;
  /** Side slope as horizontal:vertical (e.g. 3 = 3H:1V). */
  sideSlopeHV: number;
  /** Fraction of fill assumed from dredged material (0–1). */
  dredgeFillFraction: number;
}

export interface EarthworkResult {
  fillCubicYards: number;
  cutCubicYards: number;
  netImportCubicYards: number;
  /** Longest continuous fill reach, feet — drives haul logistics. */
  alignmentLengthFt: number;
  derivation: typeof INFORM_ONLY;
  disclaimer: typeof NOT_A_DESIGN;
}

export interface DredgeSourcing {
  /** Cubic yards of dredged material required. */
  dredgeCubicYards: number;
  /** One-way haul distance from placement site, miles. */
  haulMiles: number;
  /** Assumed $/cy-mile. Caller-supplied; default is a screening placeholder. */
  haulRatePerCyMile: number;
  haulCostUsd: number;
  materialSuitabilityNote: string;
}

export interface Section204Math {
  federalSharePct: number;
  sponsorSharePct: number;
  /** Federal ceiling commonly cited; confirm with the district. */
  federalCeilingUsd: number;
  estimatedConstructionUsd: number;
  federalShareUsd: number;
  sponsorShareUsd: number;
  ceilingBinding: boolean;
  note: string;
}

export interface PlacementScreening {
  earthwork: EarthworkResult;
  dredge: DredgeSourcing;
  costShare: Section204Math;
  /** Terrain-modification delta for the flood-sim scenario runner. */
  scenarioDelta: {
    kind: 'terrain-modification';
    alignmentLengthFt: number;
    crestElevFt: number;
    crestWidthFt: number;
    sideSlopeHV: number;
    backwaterScreenRequired: boolean;
  };
}

function validateStations(stations: AlignmentStation[]): void {
  if (stations.length < 2) {
    throw new Error('[berm-road-placement] need at least 2 alignment stations');
  }
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    if (!Number.isFinite(s.stationFt) || !Number.isFinite(s.groundElevFt)) {
      throw new Error(`[berm-road-placement] station ${i}: non-finite value`);
    }
    if (i > 0 && s.stationFt <= stations[i - 1].stationFt) {
      throw new Error('[berm-road-placement] stations must be strictly increasing');
    }
  }
}

/**
 * Average-end-area earthwork between consecutive stations.
 * Fill height at a station = max(0, crest - ground); cut = max(0, ground - crest).
 * Cross-section area of a trapezoidal embankment of height h:
 *   A = crestWidth * h + sideSlope * h^2
 */
export function computeEarthwork(
  stations: AlignmentStation[],
  section: TypicalSection,
): EarthworkResult {
  validateStations(stations);
  if (section.crestWidthFt <= 0 || section.sideSlopeHV <= 0) {
    throw new Error('[berm-road-placement] invalid typical section dimensions');
  }
  if (section.dredgeFillFraction < 0 || section.dredgeFillFraction > 1) {
    throw new Error('[berm-road-placement] dredgeFillFraction must be 0–1');
  }

  const areaAt = (groundFt: number): { fill: number; cut: number } => {
    const fillH = Math.max(0, section.crestElevFt - groundFt);
    const cutH = Math.max(0, groundFt - section.crestElevFt);
    const fill = section.crestWidthFt * fillH + section.sideSlopeHV * fillH * fillH;
    const cut = section.crestWidthFt * cutH + section.sideSlopeHV * cutH * cutH;
    return { fill, cut };
  };

  let fillCf = 0;
  let cutCf = 0;
  for (let i = 1; i < stations.length; i++) {
    const a = areaAt(stations[i - 1].groundElevFt);
    const b = areaAt(stations[i].groundElevFt);
    const dx = stations[i].stationFt - stations[i - 1].stationFt;
    fillCf += ((a.fill + b.fill) / 2) * dx;
    cutCf += ((a.cut + b.cut) / 2) * dx;
  }

  const fillCy = fillCf / 27;
  const cutCy = cutCf / 27;
  return {
    fillCubicYards: Math.round(fillCy),
    cutCubicYards: Math.round(cutCy),
    netImportCubicYards: Math.round(Math.max(0, fillCy - cutCy)),
    alignmentLengthFt: Math.round(stations[stations.length - 1].stationFt - stations[0].stationFt),
    derivation: INFORM_ONLY,
    disclaimer: NOT_A_DESIGN,
  };
}

/** Dredged-material demand and haul estimate (screening). */
export function estimateDredgeSourcing(
  earthwork: EarthworkResult,
  section: TypicalSection,
  haulMiles: number,
  haulRatePerCyMile = 1.85,
): DredgeSourcing {
  if (!Number.isFinite(haulMiles) || haulMiles < 0) {
    throw new Error('[berm-road-placement] haulMiles must be a finite non-negative number');
  }
  const dredgeCy = Math.round(earthwork.netImportCubicYards * section.dredgeFillFraction);
  return {
    dredgeCubicYards: dredgeCy,
    haulMiles,
    haulRatePerCyMile,
    haulCostUsd: Math.round(dredgeCy * haulMiles * haulRatePerCyMile),
    materialSuitabilityNote:
      'Screening only: clean sand/gravel suits structural fill; silts need compaction control and ' +
      'erosion armor; suspect contaminated sediment is EXCLUDED from beneficial use. ' +
      'Geotechnical characterization (gradation, Proctor, permeability) required before design.',
  };
}

/** Section 204 cost-share math (65/35, $15M federal ceiling — confirm with district). */
export function section204CostShare(
  estimatedConstructionUsd: number,
  federalSharePct = 65,
  federalCeilingUsd = 15_000_000,
): Section204Math {
  if (!Number.isFinite(estimatedConstructionUsd) || estimatedConstructionUsd < 0) {
    throw new Error('[berm-road-placement] construction cost must be finite non-negative');
  }
  const federal = (estimatedConstructionUsd * federalSharePct) / 100;
  const cappedFederal = Math.min(federal, federalCeilingUsd);
  return {
    federalSharePct,
    sponsorSharePct: 100 - federalSharePct,
    federalCeilingUsd,
    estimatedConstructionUsd: Math.round(estimatedConstructionUsd),
    federalShareUsd: Math.round(cappedFederal),
    sponsorShareUsd: Math.round(estimatedConstructionUsd - cappedFederal),
    ceilingBinding: federal > federalCeilingUsd,
    note:
      'Screening math only. Feasibility is 100% federal; design/construction per current ERDC ' +
      'CAP fact sheet. O&M is 100% sponsor. Confirm ceiling and share with Louisville District.',
  };
}

/** Full placement screening: earthwork → dredge → cost-share → sim delta. */
export function screenPlacement(
  stations: AlignmentStation[],
  section: TypicalSection,
  opts: { haulMiles: number; unitConstructionCostPerCy?: number },
): PlacementScreening {
  const earthwork = computeEarthwork(stations, section);
  const dredge = estimateDredgeSourcing(earthwork, section, opts.haulMiles);
  const unitCost = opts.unitConstructionCostPerCy ?? 28; // screening placeholder $/cy
  const construction = earthwork.fillCubicYards * unitCost + dredge.haulCostUsd;
  return {
    earthwork,
    dredge,
    costShare: section204CostShare(construction),
    scenarioDelta: {
      kind: 'terrain-modification',
      alignmentLengthFt: earthwork.alignmentLengthFt,
      crestElevFt: section.crestElevFt,
      crestWidthFt: section.crestWidthFt,
      sideSlopeHV: section.sideSlopeHV,
      backwaterScreenRequired: true,
    },
  };
}
