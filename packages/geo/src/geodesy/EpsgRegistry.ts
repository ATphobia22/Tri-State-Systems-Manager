import { HorizontalDatum } from "./HorizontalDatum.js";

export interface EpsgCrsRecord {
  code: number;
  name: string;
  horizontalDatum: HorizontalDatum;
  kind: "GEOGRAPHIC_2D" | "GEOGRAPHIC_3D" | "PROJECTED";
  suitability: "ENGINEERING" | "DISPLAY_ONLY";
}

/** Bounded contract registry, not a substitute for the complete EPSG dataset. */
export const EPSG_CRS_REGISTRY: ReadonlyMap<number, EpsgCrsRecord> = new Map([
  [4326, { code: 4326, name: "WGS 84 geographic 2D", horizontalDatum: HorizontalDatum.WGS84, kind: "GEOGRAPHIC_2D", suitability: "ENGINEERING" }],
  [4979, { code: 4979, name: "WGS 84 geographic 3D", horizontalDatum: HorizontalDatum.WGS84, kind: "GEOGRAPHIC_3D", suitability: "ENGINEERING" }],
  [4269, { code: 4269, name: "NAD83 geographic 2D", horizontalDatum: HorizontalDatum.NAD83, kind: "GEOGRAPHIC_2D", suitability: "ENGINEERING" }],
  [4267, { code: 4267, name: "NAD27 geographic 2D", horizontalDatum: HorizontalDatum.NAD27, kind: "GEOGRAPHIC_2D", suitability: "ENGINEERING" }],
  [6318, { code: 6318, name: "NAD83(2011) geographic 2D", horizontalDatum: HorizontalDatum.NAD83_2011, kind: "GEOGRAPHIC_2D", suitability: "ENGINEERING" }],
  [26915, { code: 26915, name: "NAD83 / UTM zone 15N", horizontalDatum: HorizontalDatum.NAD83, kind: "PROJECTED", suitability: "ENGINEERING" }],
  [26916, { code: 26916, name: "NAD83 / UTM zone 16N", horizontalDatum: HorizontalDatum.NAD83, kind: "PROJECTED", suitability: "ENGINEERING" }],
  [2966, { code: 2966, name: "NAD83 / Indiana West (ftUS)", horizontalDatum: HorizontalDatum.NAD83, kind: "PROJECTED", suitability: "ENGINEERING" }],
  [5070, { code: 5070, name: "NAD83 / Conus Albers", horizontalDatum: HorizontalDatum.NAD83, kind: "PROJECTED", suitability: "ENGINEERING" }],
  [3857, { code: 3857, name: "WGS 84 / Pseudo-Mercator", horizontalDatum: HorizontalDatum.WGS84, kind: "PROJECTED", suitability: "DISPLAY_ONLY" }]
]);
export function getEpsgCrs(code: number): EpsgCrsRecord | undefined { return EPSG_CRS_REGISTRY.get(code); }
