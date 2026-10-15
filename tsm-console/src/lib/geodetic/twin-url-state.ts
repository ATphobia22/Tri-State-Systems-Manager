/**
 * Shareable Twin Canvas URL state (Pages-safe, no secrets).
 * Example: ?pitch=55&fema=1&bafm=0&radar=0&vert=NAVD88
 */

export type TwinUrlState = {
  pitch: number;
  bearing: number;
  fema: boolean;
  bafm: boolean;
  noaaWarnings: boolean;
  noaaRadar: boolean;
  tiles3d: boolean;
  vert: 'NAVD88' | 'GAGE_DATUM' | 'UNKNOWN';
};

const DEFAULTS: TwinUrlState = {
  pitch: 55,
  bearing: -15,
  fema: false,
  bafm: false,
  noaaWarnings: false,
  noaaRadar: false,
  tiles3d: false,
  vert: 'NAVD88',
};

function parseBool(v: string | null, fallback: boolean): boolean {
  if (v == null) return fallback;
  return v === '1' || v === 'true' || v === 'on';
}

export function readTwinUrlState(search = typeof window !== 'undefined' ? window.location.search : ''): TwinUrlState {
  const q = new URLSearchParams(search);
  const pitch = Number(q.get('pitch'));
  const bearing = Number(q.get('bearing'));
  const vertRaw = q.get('vert');
  const vert: TwinUrlState['vert'] =
    vertRaw === 'GAGE_DATUM' || vertRaw === 'UNKNOWN' || vertRaw === 'NAVD88' ? vertRaw : DEFAULTS.vert;
  return {
    pitch: Number.isFinite(pitch) ? Math.min(85, Math.max(0, pitch)) : DEFAULTS.pitch,
    bearing: Number.isFinite(bearing) ? bearing : DEFAULTS.bearing,
    fema: parseBool(q.get('fema'), DEFAULTS.fema),
    bafm: parseBool(q.get('bafm'), DEFAULTS.bafm),
    noaaWarnings: parseBool(q.get('warn'), DEFAULTS.noaaWarnings),
    noaaRadar: parseBool(q.get('radar'), DEFAULTS.noaaRadar),
    tiles3d: parseBool(q.get('tiles3d'), DEFAULTS.tiles3d),
    vert,
  };
}

export function writeTwinUrlState(state: Partial<TwinUrlState>): void {
  if (typeof window === 'undefined') return;
  const cur = readTwinUrlState();
  const next = { ...cur, ...state };
  const q = new URLSearchParams();
  q.set('pitch', String(Math.round(next.pitch)));
  q.set('bearing', String(Math.round(next.bearing)));
  q.set('fema', next.fema ? '1' : '0');
  q.set('bafm', next.bafm ? '1' : '0');
  q.set('warn', next.noaaWarnings ? '1' : '0');
  q.set('radar', next.noaaRadar ? '1' : '0');
  q.set('tiles3d', next.tiles3d ? '1' : '0');
  q.set('vert', next.vert);
  const url = `${window.location.pathname}?${q.toString()}${window.location.hash}`;
  window.history.replaceState({}, '', url);
}
