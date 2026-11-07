/**
 * ASPRS LAS point classification codes — the subset the USGS Lidar Base
 * Specification (LBS) requires plus the common ASPRS vegetation/building codes.
 *
 * Sources (verified 2026-11-07):
 * - USGS LBS Table 5 (2025 rev. A), "Lidar Base Specification Tables":
 *   https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-tables
 * - ASPRS LAS 1.1–1.4 class table (via ArcGIS Pro):
 *   https://pro.arcgis.com/en/pro-app/3.0/help/data/las-dataset/storing-lidar-data.htm
 *
 * Wording differs between the two authorities for two codes: ASPRS says
 * class 1 "Unassigned" and class 7 "Low Point"; the LBS says class 1
 * "Processed, but unclassified" and class 7 "Low noise". Both labels are
 * recorded here; neither is treated as an error. In LAS 1.4, codes 8 and 12
 * are reserved (use class flags instead); LAS 1.1–1.3 support only 0–31.
 *
 * Only the verified codes are listed. Do not invent codes: an unknown code
 * is unknown, never silently remapped.
 */
export const LIDAR_CLASS = {
  NEVER_CLASSIFIED: 0,
  UNASSIGNED: 1,
  GROUND: 2,
  LOW_VEGETATION: 3,
  MEDIUM_VEGETATION: 4,
  HIGH_VEGETATION: 5,
  BUILDING: 6,
  LOW_NOISE: 7,
  WATER: 9,
  BRIDGE_DECK: 17,
  HIGH_NOISE: 18,
  IGNORED_GROUND: 20,
} as const;

export interface LidarClassDefinition {
  code: number;
  /** ASPRS LAS wording. */
  asprsLabel: string;
  /** USGS LBS wording, where the LBS names the code. Null when the LBS minimum scheme does not name it. */
  lbsLabel: string | null;
}

/** Verified class definitions, keyed by numeric code. */
export const LIDAR_CLASS_DEFINITIONS: ReadonlyMap<number, LidarClassDefinition> = new Map([
  [0, { code: 0, asprsLabel: "Created, never classified", lbsLabel: null }],
  [1, { code: 1, asprsLabel: "Unassigned", lbsLabel: "Processed, but unclassified" }],
  [2, { code: 2, asprsLabel: "Ground", lbsLabel: "Bare earth" }],
  [3, { code: 3, asprsLabel: "Low Vegetation", lbsLabel: "Low Vegetation" }],
  [4, { code: 4, asprsLabel: "Medium Vegetation", lbsLabel: "Medium Vegetation" }],
  [5, { code: 5, asprsLabel: "High Vegetation", lbsLabel: "High Vegetation" }],
  [6, { code: 6, asprsLabel: "Building", lbsLabel: "Building" }],
  [7, { code: 7, asprsLabel: "Low Point", lbsLabel: "Low noise" }],
  [9, { code: 9, asprsLabel: "Water", lbsLabel: "Water" }],
  [17, { code: 17, asprsLabel: "Bridge Deck", lbsLabel: "Bridge deck" }],
  [18, { code: 18, asprsLabel: "High Noise", lbsLabel: "High noise" }],
  [20, { code: 20, asprsLabel: "Ignored Ground", lbsLabel: "Ignored ground (typically breakline proximity)" }],
]);

/** Definition for a code, or null when the code is not in the verified set. */
export function lidarClassDefinition(code: number): LidarClassDefinition | null {
  return LIDAR_CLASS_DEFINITIONS.get(code) ?? null;
}

/** True for ASPRS class 2 (bare earth / ground) — the only class a bare-earth DEM is built from. */
export function isGroundClass(code: number): boolean {
  return code === LIDAR_CLASS.GROUND;
}

/** True for ASPRS classes 3, 4, 5 (low / medium / high vegetation). */
export function isVegetationClass(code: number): boolean {
  return (
    code === LIDAR_CLASS.LOW_VEGETATION ||
    code === LIDAR_CLASS.MEDIUM_VEGETATION ||
    code === LIDAR_CLASS.HIGH_VEGETATION
  );
}

/** True for ASPRS classes 7 and 18 (low / high noise). */
export function isNoiseClass(code: number): boolean {
  return code === LIDAR_CLASS.LOW_NOISE || code === LIDAR_CLASS.HIGH_NOISE;
}
