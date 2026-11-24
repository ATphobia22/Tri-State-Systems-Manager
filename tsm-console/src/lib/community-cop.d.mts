export type GaugeMarker = {id: string; longitude: number; latitude: number; status: "RECENT_OBSERVATION" | "STALE" | "MISSING_MEASUREMENT"; text: string; source: string; sourceSha256: string};
export type StationSummary = {stationId: string; sourceStatus: "CAPTURED" | "SOURCE_UNAVAILABLE" | "NO_OBSERVATIONS" | "NOT_IN_CAPTURE"; seriesCount: number; unlocatedSeriesCount: number};
export function gaugeMarkers(doc: unknown, now?: number): GaugeMarker[];
export function stationSummary(doc: unknown, now?: number): StationSummary[];
