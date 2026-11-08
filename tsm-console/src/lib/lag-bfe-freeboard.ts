/**
 * LAG − BFE freeboard calculation (modeling / engineering context).
 *
 * freeboard_ft = LAG_ft − BFE_ft
 *   > 0  → modeling grade above base flood elevation
 *   = 0  → at BFE
 *   < 0  → modeling grade below BFE (not a LOMA proof by itself)
 *
 * Authority: SIMULATION / DERIVED. Does not replace PE/surveyor elevations or FEMA LOMA.
 */

export const FREEBOARD_AUTHORITY = "SIMULATION_DEMO" as const;

export type FreeboardInput = {
  lagFt: number;
  bfeFt: number;
  /** Optional vertical datum label for display only. */
  verticalDatum?: string;
};

export type FreeboardComputation = {
  lagFt: number;
  bfeFt: number;
  freeboardFt: number;
  freeboardRoundedFt: number;
  aboveBfe: boolean;
  atBfe: boolean;
  belowBfe: boolean;
  verticalDatum: string;
  formula: string;
  authority: typeof FREEBOARD_AUTHORITY;
  disclaimer: string;
};

export function computeLagBfeFreeboard(input: FreeboardInput): FreeboardComputation {
  const { lagFt, bfeFt } = input;
  if (!Number.isFinite(lagFt) || !Number.isFinite(bfeFt)) {
    throw new Error("LAG and BFE must be finite numbers (ft)");
  }
  const freeboardFt = lagFt - bfeFt;
  const freeboardRoundedFt = Math.round(freeboardFt * 100) / 100;
  return {
    lagFt,
    bfeFt,
    freeboardFt,
    freeboardRoundedFt,
    aboveBfe: freeboardFt > 0,
    atBfe: freeboardFt === 0,
    belowBfe: freeboardFt < 0,
    verticalDatum: input.verticalDatum ?? "NAVD88",
    formula: "freeboard_ft = LAG_ft − BFE_ft",
    authority: FREEBOARD_AUTHORITY,
    disclaimer:
      "Modeling freeboard only. Not a LOMA determination. Certified LAG/BFE from surveyor/PE and effective FIRM/FIS control regulatory use.",
  };
}

/** Bonebank site modeling defaults from TSM site constants. */
export const BONEBANK_FREEBOARD = computeLagBfeFreeboard({
  lagFt: 377.2,
  bfeFt: 375.0,
  verticalDatum: "NAVD88",
});
