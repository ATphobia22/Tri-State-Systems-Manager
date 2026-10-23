/**
 * Terrain / asset coverage for a verified area of interest.
 * Fail-closed provider recovery. Presentation + operations plane only.
 */

export interface AoiBBox {
  readonly westLon: number;
  readonly southLat: number;
  readonly eastLon: number;
  readonly northLat: number;
}

export interface TerrainProvider {
  readonly id: string;
  readonly authority: string;
  readonly product: string;
  readonly horizontalCrs: string;
  readonly verticalDatum: string;
  readonly sourceUri: string | null;
  readonly tileTemplate: string | null;
  readonly status: 'PUBLISHED' | 'PROGRAM_PENDING' | 'UNAVAILABLE' | 'DEGRADED';
}

export interface CoverageCell {
  readonly row: number;
  readonly col: number;
  readonly westLon: number;
  readonly southLat: number;
  readonly eastLon: number;
  readonly northLat: number;
  /** Fraction of cell with valid samples [0,1]; null if unknown */
  readonly validFraction: number | null;
  readonly nodata: boolean;
  readonly providerId: string | null;
}

export interface CoverageReport {
  readonly aoiId: string;
  readonly bbox: AoiBBox;
  readonly cells: readonly CoverageCell[];
  readonly totalCells: number;
  readonly nodataCells: number;
  readonly coveredCells: number;
  readonly meanValidFraction: number | null;
  readonly providersUsed: readonly string[];
  readonly generatedAt: string;
  readonly authority: 'OPERATIONS_REPORT';
}

export interface ProviderFailureEvent {
  readonly providerId: string;
  readonly reason: string;
  readonly at: string;
}

export interface ProviderRecoveryResult {
  readonly primary: TerrainProvider;
  readonly fallback: TerrainProvider | null;
  readonly activeProviderId: string | null;
  readonly recovered: boolean;
  readonly events: readonly ProviderFailureEvent[];
  readonly failClosed: boolean;
}

export interface AoiCoverageManifest {
  readonly schema_version: string;
  readonly aoi_id: string;
  readonly name: string;
  readonly bbox: AoiBBox;
  readonly horizontal_crs: string;
  readonly vertical_datum: string;
  readonly cell_size_deg: number;
  readonly providers: readonly TerrainProvider[];
  readonly verification: {
    readonly state: 'VERIFIED' | 'PROVISIONAL' | 'PENDING';
    readonly checked_at: string;
    readonly notes: string;
  };
  readonly site_anchor?: {
    readonly label: string;
    readonly lon: number;
    readonly lat: number;
  };
}

/** Bonebank / Point Township representative AOI (owner-disclosed site anchor). */
export const POSEY_BONEBANK_AOI: AoiCoverageManifest = {
  schema_version: '1.0.0',
  aoi_id: 'posey-bonebank-13101',
  name: 'Posey County — Bonebank / Point Township AOI',
  bbox: {
    westLon: -88.05,
    southLat: 37.80,
    eastLon: -87.96,
    northLat: 37.89,
  },
  horizontal_crs: 'EPSG:4326',
  vertical_datum: 'NAVD88',
  cell_size_deg: 0.01,
  providers: [
    {
      id: 'usgs-3dep-terrain-rgb',
      authority: 'USGS',
      product: '3DEP Terrain-RGB (screening)',
      horizontalCrs: 'EPSG:3857',
      verticalDatum: 'NAVD88',
      sourceUri: 'https://elevation.nationalmap.gov/',
      tileTemplate: null,
      status: 'PROGRAM_PENDING',
    },
    {
      id: 'indiana-dem-igic',
      authority: 'Indiana GIO / IGIC',
      product: 'Statewide DEM',
      horizontalCrs: 'EPSG:2965',
      verticalDatum: 'NAVD88',
      sourceUri: null,
      tileTemplate: null,
      status: 'PROGRAM_PENDING',
    },
  ],
  verification: {
    state: 'PROVISIONAL',
    checked_at: '2026-10-23',
    notes:
      'AOI geometry verified against site constants. Tile endpoints remain program-pending until operator deploys Terrain-RGB URL template.',
  },
  site_anchor: {
    label: '13101 Bonebank Rd',
    lon: -88.005075,
    lat: 37.845887,
  },
};

export function buildCoverageGrid(
  manifest: AoiCoverageManifest,
  /** Optional per-cell valid fractions from an external survey; null => unknown */
  cellValidFractions?: ReadonlyMap<string, number>,
): CoverageReport {
  const { bbox, cell_size_deg: cs } = manifest;
  if (!(cs > 0)) throw new Error('cell_size_deg must be > 0');
  const cells: CoverageCell[] = [];
  let row = 0;
  for (let lat = bbox.southLat; lat < bbox.northLat - 1e-12; lat += cs, row++) {
    let col = 0;
    for (let lon = bbox.westLon; lon < bbox.eastLon - 1e-12; lon += cs, col++) {
      const key = `${row}:${col}`;
      const frac = cellValidFractions?.get(key) ?? null;
      const nodata = frac !== null ? frac <= 0 : true; // unknown => treat as nodata until measured
      const published = manifest.providers.find((p) => p.status === 'PUBLISHED');
      cells.push({
        row,
        col,
        westLon: lon,
        southLat: lat,
        eastLon: Math.min(lon + cs, bbox.eastLon),
        northLat: Math.min(lat + cs, bbox.northLat),
        validFraction: frac,
        nodata,
        providerId: published?.id ?? null,
      });
    }
  }
  const nodataCells = cells.filter((c) => c.nodata).length;
  const coveredCells = cells.filter((c) => !c.nodata).length;
  const fracs = cells.map((c) => c.validFraction).filter((f): f is number => f !== null);
  const meanValidFraction =
    fracs.length > 0 ? fracs.reduce((a, b) => a + b, 0) / fracs.length : null;
  return {
    aoiId: manifest.aoi_id,
    bbox,
    cells,
    totalCells: cells.length,
    nodataCells,
    coveredCells,
    meanValidFraction,
    providersUsed: [...new Set(cells.map((c) => c.providerId).filter(Boolean) as string[])],
    generatedAt: new Date().toISOString(),
    authority: 'OPERATIONS_REPORT',
  };
}

/**
 * Provider failure recovery: try primary, then ordered fallbacks; fail closed
 * if none are PUBLISHED. Never invent endpoints.
 */
export function recoverTerrainProvider(
  providers: readonly TerrainProvider[],
  primaryId: string,
  failureReason?: string,
): ProviderRecoveryResult {
  const events: ProviderFailureEvent[] = [];
  const primary = providers.find((p) => p.id === primaryId);
  if (!primary) {
    throw new Error(`Unknown primary provider ${primaryId}`);
  }
  if (primary.status === 'PUBLISHED' && primary.tileTemplate) {
    return {
      primary,
      fallback: null,
      activeProviderId: primary.id,
      recovered: true,
      events,
      failClosed: false,
    };
  }
  if (failureReason || primary.status !== 'PUBLISHED') {
    events.push({
      providerId: primary.id,
      reason: failureReason ?? `status=${primary.status}`,
      at: new Date().toISOString(),
    });
  }
  const fallback =
    providers.find(
      (p) =>
        p.id !== primaryId &&
        p.status === 'PUBLISHED' &&
        (p.tileTemplate || p.sourceUri),
    ) ?? null;
  if (fallback) {
    return {
      primary,
      fallback,
      activeProviderId: fallback.id,
      recovered: true,
      events,
      failClosed: false,
    };
  }
  return {
    primary,
    fallback: null,
    activeProviderId: null,
    recovered: false,
    events,
    failClosed: true,
  };
}

export function simulateProviderFailureRecovery(
  manifest: AoiCoverageManifest,
  primaryId: string,
): ProviderRecoveryResult {
  return recoverTerrainProvider(
    manifest.providers,
    primaryId,
    'simulated fetch failure for contract test',
  );
}
