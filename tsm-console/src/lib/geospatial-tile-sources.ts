export type GeospatialLayerType =
  | 'raster'
  | 'terrain'
  | 'vector'
  | 'live-observation'
  | 'live-forecast'
  | 'historical-raster';

export type GeospatialSourceState =
  | 'LIVE'
  | 'VERIFIED'
  | 'STALE'
  | 'PROGRAM_PENDING'
  | 'HISTORICAL'
  | 'SOURCE_UNAVAILABLE';

export interface GeospatialTileAsset {
  readonly id: string;
  readonly dataset: string;
  readonly authority: string;
  readonly authorityClass: string;
  readonly purpose: string;
  readonly layerType: GeospatialLayerType;
  readonly sourceUrl: string;
  readonly status: 'PUBLISHED' | 'PROGRAM_PENDING' | 'REQUIRES_DOWNLOAD' | 'SITE_SPECIFIC';
  readonly crs: string;
  readonly verticalDatum: string;
  readonly tileScheme: 'WEB_MERCATOR_XYZ' | 'SERVICE_NATIVE' | 'NONE';
  readonly provenanceClass: string;
  readonly currentTruth: boolean;
  readonly acquiredAt: string | null;
  readonly effectiveAt: string | null;
  readonly freshnessPolicy: string;
  readonly verification: {
    readonly state: 'VERIFIED' | 'PROVISIONAL' | 'PENDING' | 'HISTORICAL_REFERENCE';
    readonly checkedAt: string;
    readonly sourceHashPolicy: string;
  };
}

export interface ResolvedTileSource {
  readonly asset: GeospatialTileAsset;
  readonly state: GeospatialSourceState;
  readonly url: string | null;
  readonly reason: string;
}

export const GEOSPATIAL_TILE_MANIFEST_URL =
  '/artifacts/tsm-geospatial-tile-fabric-v1.json';

export const REQUIRED_OPEN_WORLD_LAYERS = [
  'fema-effective',
  'indiana-bafm',
  'indiana-parcels-2025',
  'indiana-current-imagery',
  'usgs-3dep-terrain',
  'usgs-03378500',
  'noaa-nwps',
  'usace-nld',
  'point-township-historical',
] as const;

export function classifySourceState(
  asset: GeospatialTileAsset,
  now: Date,
): GeospatialSourceState {
  if (asset.verification.state === 'HISTORICAL_REFERENCE' || !asset.currentTruth) {
    return 'HISTORICAL';
  }
  if (asset.status === 'PROGRAM_PENDING') {
    return 'PROGRAM_PENDING';
  }
  if (asset.status !== 'PUBLISHED') {
    return 'SOURCE_UNAVAILABLE';
  }
  if (asset.layerType === 'live-observation' || asset.layerType === 'live-forecast') {
    const checked = Date.parse(asset.verification.checkedAt);
    const ageMs = now.getTime() - checked;
    return Number.isFinite(checked) && ageMs <= 15 * 60 * 1000 ? 'LIVE' : 'STALE';
  }
  return 'VERIFIED';
}

export function resolveTileAsset(asset: GeospatialTileAsset, now = new Date()): ResolvedTileSource {
  const state = classifySourceState(asset, now);
  const canRender = state === 'LIVE' || state === 'VERIFIED' || state === 'HISTORICAL';
  return {
    asset,
    state,
    url: canRender ? asset.sourceUrl : null,
    reason:
      state === 'LIVE'
        ? 'Authoritative live source within freshness policy.'
        : state === 'VERIFIED'
          ? 'Published authoritative source with verified metadata.'
          : state === 'HISTORICAL'
            ? 'Historical/reference source; not current regulatory or cadastral truth.'
            : state === 'PROGRAM_PENDING'
              ? 'Program announced but required published source is not yet available.'
              : state === 'STALE'
                ? 'Live source metadata is outside the freshness policy.'
                : 'Authoritative source is not currently published for runtime use.',
  };
}
