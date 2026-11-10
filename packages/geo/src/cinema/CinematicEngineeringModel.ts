/**
 * Mathematical and source model for the cinematic engineering experience.
 * Real-world sources are cited; conversions are explicit.
 */

import {
  MTVI3_GAGE_ZERO_NAVD88,
  MTVI3_HISTORIC_1937_CREST_STAGE_FT,
  stageToWseFt,
} from "../hydrology/GageDatumDiscipline";

export type AuthorityClass =
  | "REGULATORY"
  | "OBSERVATION"
  | "DERIVED"
  | "MODEL_SIMULATION"
  | "PRESENTATION";

export const CINEMA_SITE = Object.freeze({
  name: "13101 Bonebank Rd / Point Twp / Posey Co",
  lon: -88.0051,
  lat: 37.84589,
  crsHorizontal: "EPSG:2966",
  verticalDatumPreferred: "NAVD88" as const,
  lagFt_modeling: 377.2,
  bfeFt_modeling: 375.0,
});

export function freeboardFt(lagFt: number, bfeFt: number): number {
  return lagFt - bfeFt;
}

/** Bathtub inundation depth on a DEM sample (ft). */
export function inundationDepthFt(wseFt: number, groundFt: number): number {
  return Math.max(0, wseFt - groundFt);
}

/** Ease for WSE animation keyframes (smoothstep). */
export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function interpolateWse(wse0: number, wse1: number, t: number): number {
  const u = smoothstep(t);
  return wse0 + (wse1 - wse0) * u;
}

/** MTVI3 product-matched conversion for cinema HUD. */
export function mtvi3StageToWse(stageFt: number) {
  return stageToWseFt(
    {
      stationId: "MTVI3",
      stageFt,
      stageDatum: "GAGE_DATUM",
      source: "NOAA NWPS MTVI3",
    },
    MTVI3_GAGE_ZERO_NAVD88
  );
}

export function historic1937WseNavd88(): number {
  return MTVI3_HISTORIC_1937_CREST_STAGE_FT + MTVI3_GAGE_ZERO_NAVD88.gageZeroFt;
}

export const REAL_WORLD_SOURCES = Object.freeze([
  {
    id: "nfhl",
    name: "FEMA NFHL / MSC",
    url: "https://msc.fema.gov",
    authority: "REGULATORY" as AuthorityClass,
  },
  {
    id: "3dep",
    name: "USGS 3DEP",
    url: "https://www.usgs.gov/3d-elevation-program",
    authority: "DERIVED" as AuthorityClass,
  },
  {
    id: "mtvi3",
    name: "NOAA NWPS MTVI3",
    url: "https://water.noaa.gov/gauges/mtvi3",
    authority: "OBSERVATION" as AuthorityClass,
    note: "Gage zero 318.59 ft NAVD88",
  },
  {
    id: "usgs",
    name: "USGS NWIS/OGC stage",
    url: "https://waterservices.usgs.gov/",
    authority: "OBSERVATION" as AuthorityClass,
  },
  {
    id: "igio",
    name: "Indiana GIO parcels / imagery",
    authority: "REGULATORY" as AuthorityClass,
  },
]);

export type StreamLayer = {
  id: string;
  kind: "terrain_rgb" | "vector_mvt" | "3d_tiles" | "glb_buildings";
  urlTemplate?: string;
  authority: AuthorityClass;
  label: string;
};

/** Default streaming layout for web + native consumers. */
export const DEFAULT_STREAM_LAYERS: readonly StreamLayer[] = Object.freeze([
  {
    id: "terrain-3dep",
    kind: "terrain_rgb",
    urlTemplate: "{base}/terrain_3dep/{z}/{x}/{y}.png",
    authority: "DERIVED",
    label: "3DEP Terrain-RGB",
  },
  {
    id: "nfhl-mvt",
    kind: "vector_mvt",
    authority: "REGULATORY",
    label: "NFHL vector",
  },
  {
    id: "buildings-3dtiles",
    kind: "3d_tiles",
    authority: "DERIVED",
    label: "Building 3D Tiles / CityGML-derived",
  },
  {
    id: "structures-glb",
    kind: "glb_buildings",
    authority: "DERIVED",
    label: "Local GLB structures",
  },
]);

export type CinemaKeyframe = {
  t: number;
  lon: number;
  lat: number;
  heightM: number;
  pitchDeg: number;
  yawDeg: number;
  wseFt: number | null;
  label: string;
};

export function buildEngineeringCinemaPath(): CinemaKeyframe[] {
  const wseMinor = mtvi3StageToWse(35).wseFt;
  const wse1937 = historic1937WseNavd88();
  return [
    {
      t: 0,
      lon: -88.05,
      lat: 37.9,
      heightM: 8000,
      pitchDeg: -45,
      yawDeg: 30,
      wseFt: null,
      label: "Regional Ohio–Wabash",
    },
    {
      t: 0.35,
      lon: CINEMA_SITE.lon,
      lat: CINEMA_SITE.lat,
      heightM: 2000,
      pitchDeg: -50,
      yawDeg: 0,
      wseFt: wseMinor,
      label: "Minor flood WSE (MTVI3 product zero)",
    },
    {
      t: 0.7,
      lon: CINEMA_SITE.lon,
      lat: CINEMA_SITE.lat,
      heightM: 900,
      pitchDeg: -35,
      yawDeg: -20,
      wseFt: CINEMA_SITE.bfeFt_modeling,
      label: "Modeling BFE 375.0 NAVD88",
    },
    {
      t: 1,
      lon: CINEMA_SITE.lon,
      lat: CINEMA_SITE.lat,
      heightM: 600,
      pitchDeg: -25,
      yawDeg: -40,
      wseFt: wse1937,
      label: "1937 crest WSE 377.80 NAVD88",
    },
  ];
}

export function sampleCinemaPath(path: CinemaKeyframe[], t: number): CinemaKeyframe {
  const u = Math.min(1, Math.max(0, t));
  if (path.length === 0) {
    throw new Error("empty path");
  }
  if (u <= path[0].t) return path[0];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (u >= a.t && u <= b.t) {
      const local = (u - a.t) / (b.t - a.t || 1);
      const s = smoothstep(local);
      return {
        t: u,
        lon: a.lon + (b.lon - a.lon) * s,
        lat: a.lat + (b.lat - a.lat) * s,
        heightM: a.heightM + (b.heightM - a.heightM) * s,
        pitchDeg: a.pitchDeg + (b.pitchDeg - a.pitchDeg) * s,
        yawDeg: a.yawDeg + (b.yawDeg - a.yawDeg) * s,
        wseFt:
          a.wseFt != null && b.wseFt != null
            ? a.wseFt + (b.wseFt - a.wseFt) * s
            : b.wseFt ?? a.wseFt,
        label: s < 0.5 ? a.label : b.label,
      };
    }
  }
  return path[path.length - 1];
}
