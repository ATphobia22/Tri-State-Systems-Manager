/**
 * Deterministic soil-moisture and stress engine.
 * Pure functions only. No I/O. No mutation of evidence stores.
 * Adapted from SeasonalCropStress + SoilFertilizer mechanics for TSM parcels.
 */

export type SoilTexture = "sandy" | "loam" | "clay" | "unknown";

export interface WeatherStep {
  /** hours since last step */
  dtHours: number;
  /** average temperature °C */
  temperatureC: number;
  /** rainfall mm in this step */
  rainfallMm: number;
  /** relative humidity 0..1 */
  relativeHumidity: number;
}

export interface MoistureConfig {
  /** base evaporation rate mm/day at 20 °C */
  baseEtMmPerDay: number;
  /** soil texture multiplier on drainage */
  drainageMultiplier: Record<SoilTexture, number>;
  /** critical moisture thresholds by crop code */
  criticalThresholds: Record<string, number>;
}

export const DEFAULT_MOISTURE_CONFIG: MoistureConfig = {
  baseEtMmPerDay: 4.0,
  drainageMultiplier: {
    sandy: 1.4,
    loam: 1.0,
    clay: 0.7,
    unknown: 1.0,
  },
  criticalThresholds: {
    wheat: 0.35,
    corn: 0.4,
    soybean: 0.4,
    potato: 0.55,
    default: 0.35,
  },
};

/**
 * Advance moisture for one time step.
 * Returns new moisture in [0,1] and drought stress increment in [0,1].
 */
export function advanceMoisture(
  currentMoisture: number,
  texture: SoilTexture,
  weather: WeatherStep,
  cropCode: string | null,
  config: MoistureConfig = DEFAULT_MOISTURE_CONFIG
): { moisture: number; droughtStressDelta: number } {
  if (!Number.isFinite(currentMoisture) || currentMoisture < 0 || currentMoisture > 1) {
    throw new Error("moisture must be finite number in [0,1]");
  }
  if (weather.dtHours <= 0) {
    throw new Error("dtHours must be positive");
  }

  const drainage = config.drainageMultiplier[texture] ?? 1.0;
  const etFactor =
    Math.max(0, (weather.temperatureC - 5) / 20) *
    (1 - 0.4 * weather.relativeHumidity);
  const etMm = config.baseEtMmPerDay * etFactor * (weather.dtHours / 24) * drainage;
  const rainMm = Math.max(0, weather.rainfallMm);

  // Convert mm to moisture fraction (simplified 150 mm field capacity)
  const capacityMm = 150;
  let next = currentMoisture + (rainMm - etMm) / capacityMm;
  next = Math.max(0, Math.min(1, next));

  const threshold =
    (cropCode && config.criticalThresholds[cropCode]) ||
    config.criticalThresholds.default;
  const droughtStressDelta =
    next < threshold ? Math.min(1, (threshold - next) * 0.15 * (weather.dtHours / 24)) : 0;

  return { moisture: next, droughtStressDelta };
}

/**
 * Crop extraction rates (fraction of available nutrient per harvest event).
 * Values are illustrative scenario coefficients, not measured agronomy.
 */
export const CROP_EXTRACTION: Record<
  string,
  { n: number; p: number; k: number }
> = {
  potato: { n: 0.35, p: 0.25, k: 0.45 },
  sugarbeet: { n: 0.3, p: 0.2, k: 0.4 },
  corn: { n: 0.28, p: 0.18, k: 0.3 },
  wheat: { n: 0.2, p: 0.12, k: 0.2 },
  soybean: { n: 0.15, p: 0.18, k: 0.2 }, // partial fixation assumed
  default: { n: 0.2, p: 0.15, k: 0.2 },
};

export function applyHarvestExtraction(
  nutrients: { n: number; p: number; k: number; om: number; ph: number },
  cropCode: string
): { n: number; p: number; k: number; om: number; ph: number } {
  const rates = CROP_EXTRACTION[cropCode] ?? CROP_EXTRACTION.default;
  return {
    n: Math.max(0, nutrients.n * (1 - rates.n)),
    p: Math.max(0, nutrients.p * (1 - rates.p)),
    k: Math.max(0, nutrients.k * (1 - rates.k)),
    om: nutrients.om,
    ph: nutrients.ph,
  };
}
