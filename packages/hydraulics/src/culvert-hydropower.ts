export interface CulvertHydraulicPowerInput {
  /** Flow that is actually available to the turbine, in cubic metres per second. */
  readonly turbineFlowM3PerSecond: number;
  /** Verified net head across the turbine after hydraulic losses, in metres. */
  readonly netHeadMetres: number;
  /** Combined turbine/generator/conversion efficiency, dimensionless in (0, 1]. */
  readonly totalEfficiency: number;
  /** Optional water density in kg/m^3; default is fresh water at approximately 20 C. */
  readonly waterDensityKgPerM3?: number;
  /** Optional gravitational acceleration in m/s^2; default is standard gravity. */
  readonly gravityMetresPerSecondSquared?: number;
}

export interface CulvertHydraulicPowerEstimate {
  readonly classification: 'SCREENING_ONLY';
  readonly hydraulicPowerWatts: number;
  readonly estimatedElectricalPowerWatts: number;
  readonly estimatedElectricalPowerKilowatts: number;
  readonly assumptions: {
    readonly turbineFlowM3PerSecond: number;
    readonly netHeadMetres: number;
    readonly totalEfficiency: number;
    readonly waterDensityKgPerM3: number;
    readonly gravityMetresPerSecondSquared: number;
  };
  readonly requiredEvidence: readonly string[];
  readonly limitations: readonly string[];
}

/**
 * Compute a first-pass power estimate only from explicitly supplied flow, net head,
 * and total efficiency. This function does not infer any site inputs, estimate annual
 * energy, or establish culvert/turbine feasibility, safety, or environmental acceptability.
 */
export function estimateHydraulicPower(input: CulvertHydraulicPowerInput): CulvertHydraulicPowerEstimate {
  const density = input.waterDensityKgPerM3 ?? 1000;
  const gravity = input.gravityMetresPerSecondSquared ?? 9.80665;
  const finite = (value: number): boolean => Number.isFinite(value);

  if (!finite(input.turbineFlowM3PerSecond) || input.turbineFlowM3PerSecond < 0) {
    throw new RangeError('turbineFlowM3PerSecond must be finite and non-negative');
  }
  if (!finite(input.netHeadMetres) || input.netHeadMetres < 0) {
    throw new RangeError('netHeadMetres must be finite and non-negative');
  }
  if (!finite(input.totalEfficiency) || input.totalEfficiency <= 0 || input.totalEfficiency > 1) {
    throw new RangeError('totalEfficiency must be finite and in the interval (0, 1]');
  }
  if (!finite(density) || density <= 0) {
    throw new RangeError('waterDensityKgPerM3 must be finite and positive');
  }
  if (!finite(gravity) || gravity <= 0) {
    throw new RangeError('gravityMetresPerSecondSquared must be finite and positive');
  }

  const hydraulicPowerWatts = density * gravity * input.turbineFlowM3PerSecond * input.netHeadMetres;
  const estimatedElectricalPowerWatts = hydraulicPowerWatts * input.totalEfficiency;
  if (!finite(hydraulicPowerWatts) || !finite(estimatedElectricalPowerWatts)) {
    throw new RangeError('power estimate overflowed; check the supplied physical inputs');
  }

  return {
    classification: 'SCREENING_ONLY',
    hydraulicPowerWatts,
    estimatedElectricalPowerWatts,
    estimatedElectricalPowerKilowatts: estimatedElectricalPowerWatts / 1000,
    assumptions: {
      turbineFlowM3PerSecond: input.turbineFlowM3PerSecond,
      netHeadMetres: input.netHeadMetres,
      totalEfficiency: input.totalEfficiency,
      waterDensityKgPerM3: density,
      gravityMetresPerSecondSquared: gravity,
    },
    requiredEvidence: [
      'Measured or independently validated turbine-available flow and its seasonal flow-duration distribution',
      'Surveyed elevations and verified net head after inlet, outlet, culvert, turbine, and tailwater losses',
      'Manufacturer performance curve and validated total efficiency at the actual operating point',
      'Structural, blockage, debris, sediment, scour, ecological, environmental-flow, and flood-conveyance review',
      'Electrical protection, grounding, interconnection, and applicable code review',
      'Independent engineering review and sensitivity/uncertainty analysis',
    ],
    limitations: [
      'Screening estimate only; not a design, site-feasibility determination, or safety certification',
      'Does not estimate annual energy or availability from seasonal/variable flows',
      'Does not account for turbine operating envelope, part-load behavior, outages, bypass flow, or electrical losses unless represented in totalEfficiency',
      'Must not be used to justify altering a culvert or reducing required flood conveyance',
    ],
  };
}
