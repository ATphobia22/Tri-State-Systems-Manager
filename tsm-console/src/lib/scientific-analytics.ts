/**
 * Generic scientific snapshot — freeboard arithmetic + H3 multi-resolution cells.
 *
 * Privacy boundary:
 * - No property address, private centroid, parcel identifier, or site-specific
 *   elevation constants are embedded in public/runtime code.
 * - Callers must supply an evidence-bound siteId, coordinates, and elevation
 *   constants from the appropriate evidence plane.
 * - Inputs remain simulation/site-constant context until PE/RLS certification.
 */
import { cellToParent, latLngToCell } from 'h3-js';

export interface SiteElevationConstants {
  BFE: number;
  LAG: number;
  FFE: number;
  BERM: number;
}

export interface ScientificSnapshotInput {
  siteId: string;
  lat: number;
  lng: number;
  siteConstants: SiteElevationConstants;
}

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
    evidenceStatus: 'SIMULATION_OR_SITE_CONSTANT';
    humanOversightRequired: true;
    daubertCompliant: false;
    requiresPeOrSurveyorForMt1: true;
  };
}

export function scientificSiteSnapshot({
  siteId,
  lat,
  lng,
  siteConstants,
}: ScientificSnapshotInput): ScientificSnapshotResult {
  if (!siteId.trim()) throw new Error('siteId is required');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude: ${lat}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error(`Invalid longitude: ${lng}`);
  }
  for (const [key, value] of Object.entries(siteConstants)) {
    if (!Number.isFinite(value)) throw new Error(`Invalid elevation constant ${key}: ${value}`);
  }

  const res10Cell = latLngToCell(lat, lng, 10);
  const res8Cell = cellToParent(res10Cell, 8);
  const res5Cell = cellToParent(res10Cell, 5);

  const lagFreeboard = Number((siteConstants.LAG - siteConstants.BFE).toFixed(2));
  const ffeFreeboard = Number((siteConstants.FFE - siteConstants.BFE).toFixed(2));
  const bermFreeboard = Number((siteConstants.BERM - siteConstants.BFE).toFixed(2));

  return {
    siteId,
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
      datum: 'NAVD88',
      horizontalCrs: 'EPSG:2966',
      note: 'QL2-class RMSE is catalog context only — not a site survey accuracy claim',
    },
    governance: {
      evidenceStatus: 'SIMULATION_OR_SITE_CONSTANT',
      humanOversightRequired: true,
      daubertCompliant: false,
      requiresPeOrSurveyorForMt1: true,
    },
  };
}
