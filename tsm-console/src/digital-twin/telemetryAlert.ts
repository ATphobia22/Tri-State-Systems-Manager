export interface StageObservation {
  gaugeId: string;
  observedAt: string;
  stageFeetNavd88: number;
}

export interface StageAlert {
  severity: "normal" | "warning" | "critical";
  thresholdFeetNavd88: number;
  message: string;
}

/** Pure evaluator; network ingestion remains outside the renderer. */
export function evaluateStructureStageAlert(
  observation: StageObservation,
  lowestAdjacentGradeFeetNavd88: number,
): StageAlert {
  if (!Number.isFinite(observation.stageFeetNavd88)) {
    throw new RangeError("stageFeetNavd88 must be finite");
  }
  if (!Number.isFinite(lowestAdjacentGradeFeetNavd88)) {
    throw new RangeError("lowestAdjacentGradeFeetNavd88 must be finite");
  }

  if (observation.stageFeetNavd88 >= lowestAdjacentGradeFeetNavd88) {
    return {
      severity: "critical",
      thresholdFeetNavd88: lowestAdjacentGradeFeetNavd88,
      message: `${observation.gaugeId} stage ${observation.stageFeetNavd88.toFixed(2)} ft is at or above the structure LAG of ${lowestAdjacentGradeFeetNavd88.toFixed(2)} ft NAVD88.`,
    };
  }

  const margin = lowestAdjacentGradeFeetNavd88 - observation.stageFeetNavd88;
  return {
    severity: margin <= 2 ? "warning" : "normal",
    thresholdFeetNavd88: lowestAdjacentGradeFeetNavd88,
    message: `${observation.gaugeId} stage is ${margin.toFixed(2)} ft below the structure LAG.`,
  };
}
