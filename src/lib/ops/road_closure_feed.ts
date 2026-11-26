/** Road closure feed adapter stub — INDOT/IDOT/KYTC when credentials available. */
export type ClosureSeverity = 'advisory' | 'lane' | 'full' | 'emergency';
export interface RoadClosure {
  id: string;
  route: string;
  countyFips: string;
  severity: ClosureSeverity;
  startIso: string;
  endIso?: string;
  geomWgs84?: GeoJSON.Geometry;
  source: string;
}
export function ingestClosures(raw: unknown[]): RoadClosure[] {
  return (raw || []).map((r: any, i) => ({
    id: String(r.id ?? `closure-${i}`),
    route: String(r.route ?? 'UNKNOWN'),
    countyFips: String(r.countyFips ?? ''),
    severity: (r.severity as ClosureSeverity) || 'advisory',
    startIso: String(r.startIso ?? new Date().toISOString()),
    endIso: r.endIso ? String(r.endIso) : undefined,
    source: String(r.source ?? 'stub'),
  }));
}
