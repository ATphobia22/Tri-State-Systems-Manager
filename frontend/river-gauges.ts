/** TSM V35.1 typed river-gauge contract. No synthetic values are permitted. */

export type GaugeState = 'LIVE' | 'STALE' | 'SOURCE_UNAVAILABLE';
export type GaugeProvider = 'USGS' | 'NOAA_NWS';

export interface RiverGauge {
  readonly stationId: string;
  readonly provider: GaugeProvider;
  readonly name: string;
  readonly river: string;
  readonly sourceUri: string;
  readonly variables: readonly string[];
  readonly horizontalCrs: 'EPSG:4326';
  readonly verticalDatum: 'SOURCE_GAGE_DATUM' | 'GAGE_DATUM' | 'NAVD88';
  readonly latitude?: number;
  readonly longitude?: number;
  readonly state: GaugeState;
  readonly observedAt: string | null;
  readonly retrievedAt: string | null;
  readonly stageFt: number | null;
  readonly dischargeCfs: number | null;
  readonly provisional: boolean;
  readonly cacheAgeSeconds: number | null;
}

export const ACTIVE_RIVER_GAUGES: readonly Omit<
  RiverGauge,
  'state' | 'observedAt' | 'retrievedAt' | 'stageFt' | 'dischargeCfs' | 'provisional' | 'cacheAgeSeconds'
>[] = [
  { stationId: '03378500', provider: 'USGS', name: 'Wabash River at New Harmony, IN', river: 'Wabash River', sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03378500/', variables: ['00065', '00060'], horizontalCrs: 'EPSG:4326', verticalDatum: 'SOURCE_GAGE_DATUM', latitude: 38.13089124398878, longitude: -87.94141452141561 },
  { stationId: '03322000', provider: 'USGS', name: 'Ohio River at Evansville, IN', river: 'Ohio River', sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03322000/', variables: ['00065', '00060'], horizontalCrs: 'EPSG:4326', verticalDatum: 'SOURCE_GAGE_DATUM', latitude: 37.97228264107407, longitude: -87.57640285193835 },
  { stationId: '03304300', provider: 'USGS', name: 'Ohio River at Newburgh Lock and Dam, IN', river: 'Ohio River', sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03304300/', variables: ['00065'], horizontalCrs: 'EPSG:4326', verticalDatum: 'SOURCE_GAGE_DATUM' },
  { stationId: '03322420', provider: 'USGS', name: 'OHIO RIVER AT UNIONTOWN DAM, KY', river: 'Ohio River', sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03322420', variables: ['00065'], horizontalCrs: 'EPSG:4326', verticalDatum: 'SOURCE_GAGE_DATUM' },
  { stationId: '03381700', provider: 'USGS', name: 'Ohio River at Old Shawneetown, IL-KY', river: 'Ohio River', sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03381700/', variables: ['00065', '00060'], horizontalCrs: 'EPSG:4326', verticalDatum: 'SOURCE_GAGE_DATUM' },
] as const;

export type GaugeTransition =
  | { readonly type: 'LIVE_OBSERVATION'; readonly observedAt: string; readonly stageFt: number | null; readonly dischargeCfs: number | null; readonly provisional: boolean }
  | { readonly type: 'STALE_CACHE'; readonly observedAt: string | null; readonly stageFt: number | null; readonly dischargeCfs: number | null; readonly cacheAgeSeconds: number }
  | { readonly type: 'SOURCE_FAILURE' };

function finiteGaugeValue(value: number | null, name: string): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isFinite(value)) {
    throw new TypeError(`invalid ${name}`);
  }
  return value;
}

function validTimestamp(value: string | null): boolean {
  return value === null || Number.isFinite(Date.parse(value));
}

export function transitionGauge(
  current: RiverGauge,
  event: GaugeTransition,
): RiverGauge {
  switch (event.type) {
    case 'LIVE_OBSERVATION':
      if (!validTimestamp(event.observedAt)) {
        throw new TypeError('invalid live observation timestamp');
      }
      return {
        ...current,
        state: 'LIVE',
        observedAt: event.observedAt,
        retrievedAt: new Date().toISOString(),
        stageFt: finiteGaugeValue(event.stageFt, 'live stage'),
        dischargeCfs: finiteGaugeValue(event.dischargeCfs, 'live discharge'),
        provisional: event.provisional,
        cacheAgeSeconds: 0,
      };
    case 'STALE_CACHE':
      if (!validTimestamp(event.observedAt)) {
        throw new TypeError('invalid stale observation timestamp');
      }
      if (!Number.isFinite(event.cacheAgeSeconds) || event.cacheAgeSeconds < 0) {
        throw new TypeError('invalid cache age');
      }
      return {
        ...current,
        state: 'STALE',
        observedAt: event.observedAt,
        stageFt: finiteGaugeValue(event.stageFt, 'stale stage'),
        dischargeCfs: finiteGaugeValue(event.dischargeCfs, 'stale discharge'),
        cacheAgeSeconds: event.cacheAgeSeconds,
      };
    case 'SOURCE_FAILURE':
      return {
        ...current,
        state: 'SOURCE_UNAVAILABLE',
        observedAt: null,
        retrievedAt: null,
        stageFt: null,
        dischargeCfs: null,
        provisional: false,
        cacheAgeSeconds: null,
      };
  }
}

export function createUnavailableGauge(
  config: typeof ACTIVE_RIVER_GAUGES[number],
): RiverGauge {
  return {
    ...config,
    state: 'SOURCE_UNAVAILABLE',
    observedAt: null,
    retrievedAt: null,
    stageFt: null,
    dischargeCfs: null,
    provisional: false,
    cacheAgeSeconds: null,
  };
}
