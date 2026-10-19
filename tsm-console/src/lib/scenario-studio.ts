/**
 * Scenario Studio — screening-only cascading impact model for Twin Canvas.
 *
 * Authority: SCENARIO / SIMULATION_DEMO only. Never OBSERVED or REGULATORY.
 * Does not invent WSE, gage-zero, or flood extents from live stages.
 * Human authority remains final (ADR-004 / ADR-006 S1).
 */

export type ScenarioEventId =
  | 'screening-100yr'
  | 'screening-500yr'
  | 'historical-1937-context'
  | 'compound-rain-rise';

export type AdaptationId =
  | 'none'
  | 'temporary-road-closure'
  | 'elevated-access-route'
  | 'facility-hardening-awareness'
  | 'buyout-zone-awareness';

export type ImpactSeverity = 'none' | 'watch' | 'elevated' | 'severe';

export interface ScenarioEvent {
  id: ScenarioEventId;
  label: string;
  description: string;
  /** Relative screening intensity 0–1; not a calibrated depth. */
  intensity: number;
  authorityClass: 'SCENARIO';
  status: 'unverified' | 'context_only';
  evidenceNote: string;
}

export interface AdaptationOption {
  id: AdaptationId;
  label: string;
  description: string;
  /** Multiplier applied to cascade residual risk (screening). */
  residualFactor: number;
  authorityClass: 'SCENARIO';
}

export interface CriticalFacility {
  id: string;
  name: string;
  category: 'fire' | 'medical' | 'school' | 'shelter' | 'utility' | 'transport';
  lat: number;
  lon: number;
  county: string;
  notes: string;
  /** Screening exposure weight 0–1 relative to river corridor proximity. */
  corridorExposure: number;
}

export interface CascadeImpactRow {
  assetId: string;
  assetName: string;
  category: string;
  severity: ImpactSeverity;
  score: number;
  narrative: string;
}

export interface ScenarioStudioResult {
  event: ScenarioEvent;
  adaptation: AdaptationOption;
  runAt: string;
  authorityClass: 'SCENARIO';
  label: 'SIMULATION_DEMO';
  residualRiskIndex: number;
  impacts: CascadeImpactRow[];
  disclaimer: string;
}

export const SCENARIO_EVENTS: readonly ScenarioEvent[] = [
  {
    id: 'screening-100yr',
    label: '100-year screening envelope',
    description: 'Non-calibrated relative envelope for access-impact rehearsal. Not FEMA SFHA.',
    intensity: 0.55,
    authorityClass: 'SCENARIO',
    status: 'unverified',
    evidenceNote: 'No verified depth grid bound; intensity is UI screening only.',
  },
  {
    id: 'screening-500yr',
    label: '500-year screening envelope',
    description: 'Higher relative envelope for stress-test of access and facilities.',
    intensity: 0.78,
    authorityClass: 'SCENARIO',
    status: 'unverified',
    evidenceNote: 'Not a regulatory product. Fail-closed: no invented NAVD88 depths.',
  },
  {
    id: 'historical-1937-context',
    label: '1937 historical context',
    description: 'Narrative/context rehearsal of extreme Ohio River conditions.',
    intensity: 0.85,
    authorityClass: 'SCENARIO',
    status: 'context_only',
    evidenceNote: 'Historical context only; not a reconstituted hydrograph.',
  },
  {
    id: 'compound-rain-rise',
    label: 'Compound rain + stage rise',
    description: 'Screening compound stressor for cascading road/facility impact.',
    intensity: 0.65,
    authorityClass: 'SCENARIO',
    status: 'unverified',
    evidenceNote: 'Compound scenario is illustrative; not a forecast.',
  },
] as const;

export const ADAPTATION_OPTIONS: readonly AdaptationOption[] = [
  {
    id: 'none',
    label: 'No adaptation',
    description: 'Baseline residual access risk for the selected scenario.',
    residualFactor: 1,
    authorityClass: 'SCENARIO',
  },
  {
    id: 'temporary-road-closure',
    label: 'Temporary road closures',
    description: 'Pre-emptive closure of low corridor segments (operational rehearsal).',
    residualFactor: 0.72,
    authorityClass: 'SCENARIO',
  },
  {
    id: 'elevated-access-route',
    label: 'Elevated / alternate access',
    description: 'Shift response traffic to higher ground corridors where available.',
    residualFactor: 0.58,
    authorityClass: 'SCENARIO',
  },
  {
    id: 'facility-hardening-awareness',
    label: 'Facility hardening (awareness)',
    description: 'Marks hardening intent; does not claim structural performance.',
    residualFactor: 0.8,
    authorityClass: 'SCENARIO',
  },
  {
    id: 'buyout-zone-awareness',
    label: 'Buyout / retreat zone (awareness)',
    description: 'Planning awareness only; not a property determination.',
    residualFactor: 0.5,
    authorityClass: 'SCENARIO',
  },
] as const;

/** Screening critical facilities — situational awareness, not an official inventory. */
export const SCREENING_CRITICAL_FACILITIES: readonly CriticalFacility[] = [
  {
    id: 'fac-mt-vernon-fire',
    name: 'Mt. Vernon Fire (screening pin)',
    category: 'fire',
    lat: 37.9323,
    lon: -87.895,
    county: 'Posey',
    notes: 'Approximate community pin for cascade UI only.',
    corridorExposure: 0.45,
  },
  {
    id: 'fac-new-harmony-access',
    name: 'New Harmony access node',
    category: 'transport',
    lat: 38.1298,
    lon: -87.9345,
    county: 'Posey',
    notes: 'Near primary USGS 03378500 context; access screening only.',
    corridorExposure: 0.7,
  },
  {
    id: 'fac-bonebank-corridor',
    name: 'Bonebank Rd corridor node',
    category: 'transport',
    lat: 37.8459,
    lon: -88.0051,
    county: 'Posey',
    notes: 'Candidate AOI corridor awareness — not approved pilot output.',
    corridorExposure: 0.82,
  },
  {
    id: 'fac-myers-context',
    name: 'John T. Myers L&D context',
    category: 'utility',
    lat: 37.9023,
    lon: -87.9601,
    county: 'OH-River',
    notes: 'Navigation/structure context from NID awareness layer.',
    corridorExposure: 0.9,
  },
  {
    id: 'fac-posey-school-pin',
    name: 'Posey school cluster (screening)',
    category: 'school',
    lat: 37.941,
    lon: -87.91,
    county: 'Posey',
    notes: 'Generic cluster pin; verify official facility lists before ops use.',
    corridorExposure: 0.35,
  },
] as const;

function severityFromScore(score: number): ImpactSeverity {
  if (score < 0.25) return 'none';
  if (score < 0.45) return 'watch';
  if (score < 0.7) return 'elevated';
  return 'severe';
}

/**
 * Deterministic screening cascade. Not calibrated hydraulic output.
 */
export function runScenarioStudio(
  eventId: ScenarioEventId,
  adaptationId: AdaptationId,
  facilities: readonly CriticalFacility[] = SCREENING_CRITICAL_FACILITIES,
): ScenarioStudioResult {
  const event = SCENARIO_EVENTS.find((e) => e.id === eventId) ?? SCENARIO_EVENTS[0];
  const adaptation = ADAPTATION_OPTIONS.find((a) => a.id === adaptationId) ?? ADAPTATION_OPTIONS[0];

  const impacts: CascadeImpactRow[] = facilities.map((f) => {
    const raw = Math.min(1, event.intensity * (0.35 + 0.65 * f.corridorExposure));
    const score = Math.min(1, raw * adaptation.residualFactor);
    const severity = severityFromScore(score);
    return {
      assetId: f.id,
      assetName: f.name,
      category: f.category,
      severity,
      score: Math.round(score * 1000) / 1000,
      narrative: `${severity.toUpperCase()} screening score ${score.toFixed(2)} under ${event.label} with ${adaptation.label}. Not a field determination.`,
    };
  });

  const residualRiskIndex =
    Math.round(
      (impacts.reduce((s, r) => s + r.score, 0) / Math.max(1, impacts.length)) * 1000,
    ) / 1000;

  return {
    event,
    adaptation,
    runAt: new Date().toISOString(),
    authorityClass: 'SCENARIO',
    label: 'SIMULATION_DEMO',
    residualRiskIndex,
    impacts: impacts.sort((a, b) => b.score - a.score),
    disclaimer:
      'SIMULATION_DEMO / SCENARIO only. Cascading impacts are relative screening scores, not flood depths, not SFHA, not dam-safety or facility-operational orders. Source-required evidence gates remain resilient. Human authority remains final.',
  };
}

export function impactsToGeoJson(
  facilities: readonly CriticalFacility[],
  result: ScenarioStudioResult | null,
): GeoJSON.FeatureCollection {
  const byId = new Map(result?.impacts.map((i) => [i.assetId, i]) ?? []);
  return {
    type: 'FeatureCollection',
    features: facilities.map((f) => {
      const impact = byId.get(f.id);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
        properties: {
          id: f.id,
          name: f.name,
          category: f.category,
          severity: impact?.severity ?? 'none',
          score: impact?.score ?? 0,
          authorityClass: 'SCENARIO',
          label: 'SIMULATION_DEMO',
        },
      };
    }),
  };
}
