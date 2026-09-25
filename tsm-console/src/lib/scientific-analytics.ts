/**
 * Site scientific snapshot — freeboard arithmetic + H3 multi-resolution cells.
 * Fail-closed: elevations are SITE_CONSTANTS until PE/surveyor certification.
 * Does not assert LOMA approval, Daubert courtroom readiness, or verified regulatory status.
 */
import { cellToParent, latLngToCell } from "h3-js";

export interface SiteElevationConstants {
  BFE: number;
  LAG: number;
  FFE: number;
  BERM: number;
}

/** Locked site constants — 13101 Bonebank Rd (see tsm-site-constants + evidence lock packet). */
export const BONEBANK_SITE_CONSTANTS: SiteElevationConstants = {
  BFE: 375.0,
  LAG: 377.2,
  FFE: 382.5,
  BERM: 379.8,
};

/** Locked WGS84 centroid used in Layer 2 evidence package (not a survey pin). */
export const BONEBANK_CENTROID = {
  lat: 37.845887,
  lng: -88.005075,
} as const;

export interface ScientificSnapshotResult {
  siteId: string;
  location: { lat: number; lng: number };
  h3Cells: {
    res10: string;
    res8: string;
    res5: string;
  };
  elevations: SiteElevationConstants;
  freeboardMargins: {
    lagFreeboard: number;
    ffeFreeboard: number;
    bermFreeboard: number;
  };
  uncertainty: {
    verticalRmseFt: number;
    datum: string;
    horizontalCrs: string;
    note: string;
  };
  governance: {
    evidenceStatus: "SIMULATION_OR_SITE_CONSTANT";
    humanOversightRequired: true;
    daubertCompliant: false;
    requiresPeOrSurveyorForMt1: true;
  };
}

export function scientificSiteSnapshot(
  lat: number = BONEBANK_CENTROID.lat,
  lng: number = BONEBANK_CENTROID.lng,
  siteConstants: SiteElevationConstants = BONEBANK_SITE_CONSTANTS,
): ScientificSnapshotResult {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude: ${lat}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error(`Invalid longitude: ${lng}`);
  }

  const res10Cell = latLngToCell(lat, lng, 10);
  const res8Cell = cellToParent(res10Cell, 8);
  const res5Cell = cellToParent(res10Cell, 5);

  const lagFreeboard = Number((siteConstants.LAG - siteConstants.BFE).toFixed(2));
  const ffeFreeboard = Number((siteConstants.FFE - siteConstants.BFE).toFixed(2));
  const bermFreeboard = Number((siteConstants.BERM - siteConstants.BFE).toFixed(2));

  return {
    siteId: "13101-BONEBANK-ROAD-PTDT",
    location: { lat, lng },
    h3Cells: {
      res10: res10Cell,
      res8: res8Cell,
      res5: res5Cell,
    },
    elevations: { ...siteConstants },
    freeboardMargins: {
      lagFreeboard,
      ffeFreeboard,
      bermFreeboard,
    },
    uncertainty: {
      verticalRmseFt: 0.33,
      datum: "NAVD88",
      horizontalCrs: "EPSG:2966",
      note: "QL2-class RMSE is catalog context only — not a site survey accuracy claim",
    },
    governance: {
      evidenceStatus: "SIMULATION_OR_SITE_CONSTANT",
      humanOversightRequired: true,
      daubertCompliant: false,
      requiresPeOrSurveyorForMt1: true,
    },
  };
}
