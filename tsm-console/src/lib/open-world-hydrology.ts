export type HydrologicStateClass = 'OBSERVED' | 'FORECAST' | 'STALE' | 'SOURCE_UNAVAILABLE';

export interface OpenWorldHydrologicObservation {
  readonly stationId: string;
  readonly observedAt: string;
  readonly parameter: string;
  readonly value: number;
  readonly units: string;
  readonly datum: string;
  readonly qualifier: string | null;
  readonly sourceUrl: string;
  readonly state: HydrologicStateClass;
}

export interface OpenWorldHydrologicState {
  readonly refreshedAt: string;
  readonly observations: readonly OpenWorldHydrologicObservation[];
}

export interface CommunityHydrologyPayload {
  readonly stations?: readonly OpenWorldHydrologicObservation[];
}

export function normalizeCommunityHydrology(
  payload: CommunityHydrologyPayload,
  now = new Date(),
): OpenWorldHydrologicState {
  const observations = (payload.stations ?? []).map((station) => ({
    ...station,
    state: classifyObservationFreshness(station.observedAt, now),
  }));
  return { refreshedAt: now.toISOString(), observations };
}

export function classifyObservationFreshness(observedAt: string, now = new Date()): HydrologicStateClass {
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return 'SOURCE_UNAVAILABLE';
  return now.getTime() - timestamp <= 15 * 60 * 1000 ? 'OBSERVED' : 'STALE';
}
