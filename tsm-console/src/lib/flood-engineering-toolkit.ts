/**
 * Flood engineering toolkit — SIMULATION / PRESENTATION only.
 * Does not issue LOMA determinations or replace PE/surveyor elevations.
 * Human authority remains final.
 */

export const AUTHORITY_CLASS = "SIMULATION_DEMO" as const;

export const BONEBANK_MODEL = Object.freeze({
  bfeFtNavd88: 375.0,
  lagFtNavd88: 377.2,
  ffeFtNavd88: 382.5,
  bermCrestFtNavd88: 379.8,
  /** Verified 1937 crest target used by FloodScenarioAnimation (ft NAVD88). */
  historical1937CrestFtNavd88: 377.8,
  mtvi3GageZeroFtNavd88: 318.59,
});

export type FreeboardResult = {
  lagFt: number;
  bfeFt: number;
  freeboardFt: number;
  aboveBfe: boolean;
  authority: typeof AUTHORITY_CLASS;
  disclaimer: string;
};

/** freeboard = LAG − BFE (positive means modeling LAG above BFE). */
export function computeFreeboardFt(lagFt: number, bfeFt: number): FreeboardResult {
  const freeboardFt = lagFt - bfeFt;
  return {
    lagFt,
    bfeFt,
    freeboardFt,
    aboveBfe: freeboardFt >= 0,
    authority: AUTHORITY_CLASS,
    disclaimer:
      "Modeling freeboard only. Not a LOMA determination and not a substitute for certified elevations.",
  };
}

export type InundationDepthResult = {
  groundFt: number;
  waterSurfaceFt: number;
  depthFt: number;
  wet: boolean;
  authority: typeof AUTHORITY_CLASS;
};

/** Simple bathtub depth at a point: max(0, WSE − ground). */
export function inundationDepthFt(groundFt: number, waterSurfaceFt: number): InundationDepthResult {
  const depthFt = Math.max(0, waterSurfaceFt - groundFt);
  return {
    groundFt,
    waterSurfaceFt,
    depthFt,
    wet: depthFt > 0,
    authority: AUTHORITY_CLASS,
  };
}

export type AnimationKeyframe = {
  t: number;
  waterSurfaceFt: number;
};

/**
 * Build eased water-surface keyframes from startFt to targetFt.
 * t in [0,1]; ease-in-out quadratic (matches FloodScenarioAnimation).
 */
export function buildWseAnimationKeyframes(
  startFt: number,
  targetFt: number,
  steps = 24
): AnimationKeyframe[] {
  const n = Math.max(2, Math.floor(steps));
  const out: AnimationKeyframe[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    out.push({
      t,
      waterSurfaceFt: startFt + (targetFt - startFt) * eased,
    });
  }
  return out;
}

/** Stage at MTVI3 from NAVD88 WSE using published zero in model constants. */
export function mtvi3StageFromWseFt(wseFtNavd88: number): number {
  return wseFtNavd88 - BONEBANK_MODEL.mtvi3GageZeroFtNavd88;
}

export type ScenarioEngineeringSummary = {
  id: string;
  freeboardAtLag: FreeboardResult;
  depthAtLagVsCrest: InundationDepthResult | null;
  keyframes: AnimationKeyframe[] | null;
  authority: typeof AUTHORITY_CLASS;
};

export function summarizeBonebankScenario(
  id: "model-bfe" | "historical-1937"
): ScenarioEngineeringSummary {
  const freeboardAtLag = computeFreeboardFt(
    BONEBANK_MODEL.lagFtNavd88,
    BONEBANK_MODEL.bfeFtNavd88
  );
  if (id === "model-bfe") {
    return {
      id,
      freeboardAtLag,
      depthAtLagVsCrest: inundationDepthFt(
        BONEBANK_MODEL.lagFtNavd88,
        BONEBANK_MODEL.bfeFtNavd88
      ),
      keyframes: buildWseAnimationKeyframes(
        BONEBANK_MODEL.bfeFtNavd88 - 5,
        BONEBANK_MODEL.bfeFtNavd88,
        16
      ),
      authority: AUTHORITY_CLASS,
    };
  }
  return {
    id,
    freeboardAtLag,
    depthAtLagVsCrest: inundationDepthFt(
      BONEBANK_MODEL.lagFtNavd88,
      BONEBANK_MODEL.historical1937CrestFtNavd88
    ),
    keyframes: buildWseAnimationKeyframes(
      BONEBANK_MODEL.bfeFtNavd88 - 5,
      BONEBANK_MODEL.historical1937CrestFtNavd88,
      24
    ),
    authority: AUTHORITY_CLASS,
  };
}
