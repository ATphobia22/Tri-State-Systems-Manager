/**
 * Tri-State River Valley engineering viewport configuration.
 * Legacy scenario elevations remain explicit and are not universal design criteria.
 */

export const VIEWPORT_CONFIG = {
  projectNode: 'Lower Wabash-Ohio Confluence Community',
  visualDoctrine: 'tri-state-engineering-sim' as const,
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
    bfeFt: null,
    lagFt: null,
    ffeFt: null,
    bermCrestFt: null,
    clearanceLagMinusBfeFt: null,
    evidenceStatus: 'SOURCE_REQUIRED' as const,
  },
  hydrology: {
    primaryUsgs: '03378500',
    primaryUsgsName: 'Wabash River at New Harmony, IN',
    primaryNws: 'NHRI3',
    relatedGauges: ['03322000', '03304300', '03322420', '03381700', '03399800', '03303280', '03612600', '03277200', '03293600', '03294500'] as const,
    compensatoryStorageRatio: 1.0,
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
    simulationBanner: 'ENGINEERING SIM — observed, forecast, model and simulation states remain distinct',
    authorityBanner: 'Human authority final · Technology informs, does not govern',
    evidencePresentationBoundary: 'Viewport does not mutate PostGIS / HEC-RAS / Evidence Ledger',
  },
  portable: {
    requiredEpsg: 2966,
    requiredVertical: 'NAVD88',
    requiredBfeFt: 375.0,
    requiredLagFt: 377.2,
  },
} as const;

export type StageFinding = 'NOMINAL' | 'BFE_EXCEEDED' | 'CRITICAL_INUNDATION';

export function stageFinding(stageFt: number): StageFinding {
  if (stageFt >= VIEWPORT_CONFIG.elevations.lagFt) return 'CRITICAL_INUNDATION';
  if (stageFt >= VIEWPORT_CONFIG.elevations.bfeFt) return 'BFE_EXCEEDED';
  return 'NOMINAL';
}

export function visualWaterY(stageFt: number, _elapsedSec = 0): number {
  const { bfeFt } = VIEWPORT_CONFIG.elevations;
  return Math.max(0, (stageFt - bfeFt) * 0.8);
}

export function verifyPortableInvariants(input: {
  epsg?: number;
  vertical?: string;
  bfeFt?: number;
  lagFt?: number;
}): { ok: boolean; failures: string[] } {
  const p = VIEWPORT_CONFIG.portable;
  const failures: string[] = [];
  if (input.epsg !== undefined && input.epsg !== p.requiredEpsg) failures.push(`EPSG expected ${p.requiredEpsg}, got ${input.epsg}`);
  if (input.vertical !== undefined && input.vertical !== p.requiredVertical) failures.push(`Vertical expected ${p.requiredVertical}, got ${input.vertical}`);
  if (input.bfeFt !== undefined && input.bfeFt !== p.requiredBfeFt) failures.push(`BFE expected ${p.requiredBfeFt}, got ${input.bfeFt}`);
  if (input.lagFt !== undefined && input.lagFt !== p.requiredLagFt) failures.push(`LAG expected ${p.requiredLagFt}, got ${input.lagFt}`);
  return { ok: failures.length === 0, failures };
}
