/**
 * USGS 3DEP lidar quality levels (QL0–QL3) with their Lidar Base
 * Specification requirements.
 *
 * Sources (verified 2026-11-07):
 * - USGS LBS Tables, Table 4 (2025 rev. A):
 *   https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-tables
 * - USGS "Topographic Data Quality Levels (QLs)":
 *   https://www.usgs.gov/3d-elevation-program/topographic-data-quality-levels-qls
 *
 * Terminology note: LBS 2024 rev. A renamed `RMSEz` to `RMSEv` under ASPRS
 * Positional Accuracy Standards Ed. 2
 * (https://www.usgs.gov/ngp-standards-and-specifications/adopt-updated-accuracy-standards);
 * the values are unchanged. This module uses `RMSEv`. The QL page's Table 1
 * still prints the older `RMSEz` heading for the same numbers.
 *
 * QL4 (imagery, 139 cm) and QL5 (IfSAR, 185 cm) are not lidar levels and are
 * deliberately not in this model. QL0 and QL1 share pulse density
 * (>= 8 pts/m^2, ANPS <= 0.35 m) and differ only in accuracy.
 *
 * The nva95M and vvaM fields below are **legacy-derived display heuristics**,
 * retained only for API compatibility; neither is a current LBS 2025 or
 * ASPRS Edition 2 QA acceptance result or a substitute for measured VVA.
 * These are dataset QA metrics, not per-point filters: a QL2 collection
 * (Posey County 2020) means the collection was specified to 10 cm
 * non-vegetated RMSEv at >= 2 pulses/m^2 — it does not certify any single
 * point or pixel. Unknown levels return null (UNAVAILABLE), never a guess.
 */
export type LidarQualityLevel = "QL0" | "QL1" | "QL2" | "QL3";

export interface QualityLevelDefinition {
  level: LidarQualityLevel;
  /** Non-vegetated absolute vertical accuracy, RMSEv, in metres. */
  rmseVNonVegetatedM: number;
  /** @deprecated Historical NSSDA-style 1.96×RMSEv estimate; not a current USGS LBS 2025/ASPRS Ed.2 acceptance metric. */
  nva95M: number;
  /** @deprecated Historical RMSEv×3 heuristic, NOT a measured vegetated vertical accuracy or current LBS pass criterion. */
  vvaM: number;
  /** Aggregate nominal pulse spacing, maximum, in metres. */
  maxNominalPulseSpacingM: number;
  /** Aggregate nominal pulse density, minimum, in points per square metre. */
  minNominalPulseDensityPerSqM: number;
  /** DEM cell size, in metres. */
  demCellSizeM: number;
  sourceUrl: string;
}

const LBS_TABLES_URL = "https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-tables";
const QL_PAGE_URL = "https://www.usgs.gov/3d-elevation-program/topographic-data-quality-levels-qls";

export const QUALITY_LEVELS: Readonly<Record<LidarQualityLevel, QualityLevelDefinition>> = {
  QL0: {
    level: "QL0",
    rmseVNonVegetatedM: 0.05,
    nva95M: 0.098,
    vvaM: 0.15,
    maxNominalPulseSpacingM: 0.35,
    minNominalPulseDensityPerSqM: 8,
    demCellSizeM: 0.5,
    sourceUrl: QL_PAGE_URL,
  },
  QL1: {
    level: "QL1",
    rmseVNonVegetatedM: 0.1,
    nva95M: 0.196,
    vvaM: 0.3,
    maxNominalPulseSpacingM: 0.35,
    minNominalPulseDensityPerSqM: 8,
    demCellSizeM: 0.5,
    sourceUrl: QL_PAGE_URL,
  },
  QL2: {
    level: "QL2",
    rmseVNonVegetatedM: 0.1,
    nva95M: 0.196,
    vvaM: 0.3,
    maxNominalPulseSpacingM: 0.71,
    minNominalPulseDensityPerSqM: 2,
    demCellSizeM: 1.0,
    sourceUrl: QL_PAGE_URL,
  },
  QL3: {
    level: "QL3",
    rmseVNonVegetatedM: 0.2,
    nva95M: 0.392,
    vvaM: 0.6,
    maxNominalPulseSpacingM: 1.41,
    minNominalPulseDensityPerSqM: 0.5,
    demCellSizeM: 2.0,
    sourceUrl: QL_PAGE_URL,
  },
};

export const LBS_TABLES_SOURCE_URL = LBS_TABLES_URL;

/** Definition for a lidar quality level, or null for anything unrecognised — never a guessed level. */
export function qualityLevelDefinition(level: string): QualityLevelDefinition | null {
  if (level === "QL0" || level === "QL1" || level === "QL2" || level === "QL3") {
    return QUALITY_LEVELS[level];
  }
  return null;
}

/** Non-vegetated RMSEv in metres for a level, or null when the level is unknown. */
export function rmseVNonVegetatedM(level: string): number | null {
  return qualityLevelDefinition(level)?.rmseVNonVegetatedM ?? null;
}
