/**
 * Tri-State Engineering Simulator viewport configuration
 * Farming Simulator–class grounded world: practical Posey / Ohio–Wabash replica.
 * No decorative animation loops. Math remains authoritative.
 */

export const VIEWPORT_CONFIG = {
  projectNode:
    '13101 Bonebank Road, Point Township, Posey County, Indiana',
  visualDoctrine: 'tri-state-engineering-sim' as const,
  /** FS17-class: readable landscape, real assets, operator HUD — not fantasy open-world */
  renderPolicy: {
    headlessAnimationLoops: false,
    decorativeWaterBob: false,
    openWorldEntertainmentMode: false,
    engineeringReplicaMode: true,
  },
  crs: {
    horizontalEpsg: 2966,
    horizontalName: 'NAD83 / Indiana West (ftUS)',
    verticalDatum: 'NAVD88',
  },
  elevations: {
    bfeFt: 375.0,
    lagFt: 377.2,
    ffeFt: 382.5,
    bermCrestFt: 379.8,
    clearanceLagMinusBfeFt: 2.2,
  },
  parcel: {
    apn: '65-19-08-100-008.001-010',
  },
  hydrology: {
    primaryUsgs: '03378500',
    primaryUsgsName: 'Wabash River at New Harmony, IN',
    compensatoryStorageRatio: 1.2,
    idnrFloodwaySurchargeFt: 0.15,
    indianaFreeboardFt: 2.0,
  },
  infrastructureLayers: [
    'flood_surfaces',
    'utilities_water',
    'power_corridors',
    'roads_centerlines',
    'parcels',
    'locks_dams',
    'idnr_properties',
  ] as const,
  loma: {
    tileId: 'IN2020_26800940_12',
    s3Uri:
      's3://giselevationingov/las/statewide/2020/SPW/ql2/IN2020_26800940_12.las',
    portal: 'https://elevation.gio.in.gov/',
    tileMaxGroundFt: 366.5,
    bufferMinFt: 337.22,
    lagOutsideLowGroundTile: true,
    note:
      'Structure LAG 377.2 ft lies outside this low-ground tile — require adjacent higher-ground tiles + sealed survey for LOMA.',
  },
  camera: {
    defaultPosition: [0, 60, 180] as [number, number, number],
    fov: 45,
    minDistance: 20,
    maxDistance: 400,
    maxPolarAngle: Math.PI / 2.05,
  },
  waterMaterial: {
    ior: 1.333,
    color: '#0ea5e9',
    opacity: 0.85,
    isSimulationDemo: true,
  },
  separation: {
    evidenceMutationsAllowedInViewport: false,
    stageSliderIsLiveUsgs: false,
    usdExportAuthorityClass: 'VISUALIZATION' as const,
  },
  labels: {
    simulationBanner:
      'ENGINEERING SIM — stage is GAGE_DATUM unless conversion applied; not entertainment open-world',
    authorityBanner:
      'Human authority final · Technology informs, does not govern',
    evidencePresentationBoundary:
      'Viewport does not mutate PostGIS / HEC-RAS / Evidence Ledger',
  },
  portable: {
    requiredEpsg: 2966,
    requiredVertical: 'NAVD88',
    requiredBfeFt: 375.0,
    requiredLagFt: 377.2,
    requiredApn: '65-19-08-100-008.001-010',
  },
} as const;

export type StageFinding = 'NOMINAL' | 'BFE_EXCEEDED' | 'CRITICAL_INUNDATION';

export function stageFinding(stageFt: number): StageFinding {
  if (stageFt >= VIEWPORT_CONFIG.elevations.lagFt) return 'CRITICAL_INUNDATION';
  if (stageFt >= VIEWPORT_CONFIG.elevations.bfeFt) return 'BFE_EXCEEDED';
  return 'NOMINAL';
}

/**
 * Visual water plane Y from stage — static engineering surface.
 * No sine bob / headless animation (renderPolicy.decorativeWaterBob = false).
 */
export function visualWaterY(stageFt: number, _elapsedSec = 0): number {
  const { bfeFt } = VIEWPORT_CONFIG.elevations;
  return Math.max(0, (stageFt - bfeFt) * 0.8);
}

export function verifyPortableInvariants(input: {
  epsg?: number;
  vertical?: string;
  bfeFt?: number;
  lagFt?: number;
  apn?: string;
}): { ok: boolean; failures: string[] } {
  const p = VIEWPORT_CONFIG.portable;
  const failures: string[] = [];
  if (input.epsg !== undefined && input.epsg !== p.requiredEpsg) {
    failures.push(`EPSG expected ${p.requiredEpsg}, got ${input.epsg}`);
  }
  if (input.vertical !== undefined && input.vertical !== p.requiredVertical) {
    failures.push(`Vertical expected ${p.requiredVertical}, got ${input.vertical}`);
  }
  if (input.bfeFt !== undefined && input.bfeFt !== p.requiredBfeFt) {
    failures.push(`BFE expected ${p.requiredBfeFt}, got ${input.bfeFt}`);
  }
  if (input.lagFt !== undefined && input.lagFt !== p.requiredLagFt) {
    failures.push(`LAG expected ${p.requiredLagFt}, got ${input.lagFt}`);
  }
  if (input.apn !== undefined && input.apn !== p.requiredApn) {
    failures.push(`APN mismatch`);
  }
  return { ok: failures.length === 0, failures };
}
