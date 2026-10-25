/**
 * ag-screening.ts — agricultural screening tools for the digital twin.
 *
 * Pure functions, inform-only. Nothing here is agronomic advice, a USDA
 * determination, or an insurance decision. Results prepare the farmer for
 * conversations with NRCS / FSA / crop-insurance agents; they do not
 * replace those authorities. Human authority remains final.
 */

export const INFORM_ONLY = 'inform-only-screening-estimate' as const;

/** Per-field flood exposure roll-up (from the PostGIS intersection queries). */
export interface FieldExposure {
  fieldId: string;
  parcelId: string;
  totalAcres: number;
  /** Acres intersecting the SFHA, by zone. */
  sfhaAcresByZone: Record<string, number>;
  /** Worst (most restrictive) SFHA zone touching the field, if any. */
  worstZone: string | null;
}

export interface FieldExposureSummary {
  fieldId: string;
  totalAcres: number;
  sfhaAcres: number;
  sfhaPct: number;
  worstZone: string | null;
  /** Inform-only flag for the CRP/CREP conversation (see docs/agriculture). */
  chronicallyFloodedScreen: boolean;
  derivation: typeof INFORM_ONLY;
}

/** FEMA SFHA zone families. Zone X (including 0.2% flood fringe) and D
 * are not counted as the 1%-annual-chance Special Flood Hazard Area.
 * GIS preprocessing must produce disjoint *area* polygons; overlapped
 * zones are rejected when they exceed the surveyed total field area. */
export function isSfhaZone(zone: string): boolean {
  return /^(?:A|AE|AH|AO|AR|A99|V|VE|A(?:[1-9]|[12]\d|30)|V(?:[1-9]|[12]\d|30))$/.test(zone.toUpperCase());
}
function acceptedZone(zone: string): boolean {
  return isSfhaZone(zone) || ['X', 'X500', 'D'].includes(zone.toUpperCase());
}
/** Roll up disjoint per-zone intersections into a screening estimate.
 * Never silently discard negative/NaN/unknown zones or emit >100%. */
export function summarizeFieldExposure(exposure: FieldExposure): FieldExposureSummary {
  if (!exposure || typeof exposure.fieldId !== 'string' || !exposure.fieldId.trim()) {
    throw new Error('[ag-screening] fieldId is required');
  }
  if (!Number.isFinite(exposure.totalAcres) || exposure.totalAcres <= 0) {
    throw new Error('[ag-screening] totalAcres must be a positive finite number');
  }
  if (!exposure.sfhaAcresByZone || typeof exposure.sfhaAcresByZone !== 'object' ||
      Array.isArray(exposure.sfhaAcresByZone)) {
    throw new Error('[ag-screening] zone-area inventory required');
  }
  let sfhaAcres = 0;
  for (const [zone, acres] of Object.entries(exposure.sfhaAcresByZone)) {
    if (!acceptedZone(zone)) {
      throw new Error('[ag-screening] unknown FEMA flood zone: ' + zone);
    }
    if (!Number.isFinite(acres) || acres < 0) {
      throw new Error('[ag-screening] zone acres must be finite and nonnegative');
    }
    if (isSfhaZone(zone)) sfhaAcres += acres;
  }
  if (sfhaAcres > exposure.totalAcres + 1e-6) {
    throw new Error('[ag-screening] zone intersections exceed total field area; GIS topology/overlap review required');
  }
  if (exposure.worstZone !== null &&
      (!acceptedZone(exposure.worstZone) || !(exposure.worstZone.toUpperCase() in Object.fromEntries(
        Object.entries(exposure.sfhaAcresByZone).map(([zone, acres]) => [zone.toUpperCase(), acres])
      )))) {
    throw new Error('[ag-screening] worstZone must be one of the provided flood zone categories');
  }
  const sfhaPct = (sfhaAcres / exposure.totalAcres) * 100;
  return {
    fieldId: exposure.fieldId,
    totalAcres: exposure.totalAcres,
    sfhaAcres: Math.round(sfhaAcres * 10) / 10,
    sfhaPct: Math.round(sfhaPct * 10) / 10,
    worstZone: exposure.worstZone,
    // Screening heuristic only: >50% of the field in SFHA suggests the
    // parcel is worth discussing with FSA for CRP/CREP suitability.
    // NOT an eligibility determination.
    chronicallyFloodedScreen: sfhaPct > 50,
    derivation: INFORM_ONLY,
  };
}

/** Prevented-planting documentation helper: flood-event log entry. */
export interface FloodEventLogEntry {
  fieldId: string;
  eventDate: string; // ISO date
  /** Source: 'usgs-gage' | 'owner-observation' | 'fsa-record' | 'insurance-claim' */
  source: 'usgs-gage' | 'owner-observation' | 'fsa-record' | 'insurance-claim';
  estimatedAcresAffected: number;
  notes: string;
}

export interface PlantingHistorySummary {
  fieldId: string;
  eventsInLast5Years: number;
  totalAcresAffected: number;
  /** Inform-only: 2+ events in 5 years is the conversation threshold. */
  meetsDiscussionThreshold: boolean;
  derivation: typeof INFORM_ONLY;
}

/**
 * Summarize a field's 5-year flood-event log for prevented-planting /
 * conservation-program conversations. The log itself is owner-maintained;
 * this function only does the arithmetic.
 */
export function summarizePlantingHistory(
  fieldId: string,
  entries: FloodEventLogEntry[],
  asOfDate: string = new Date().toISOString().slice(0, 10),
): PlantingHistorySummary {
  if (!fieldId?.trim()) throw new Error('[ag-screening] fieldId is required');
  const dateUtc = (raw: string): Date => {
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw new Error('[ag-screening] date must be an exact YYYY-MM-DD calendar date');
    }
    const date = new Date(raw + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
      throw new Error('[ag-screening] date is not a valid calendar date');
    }
    return date;
  };
  const asOf = dateUtc(asOfDate);
  const cutoff = new Date(asOf.getTime());
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5);
  const recent = entries.filter((e) => {
    if (!e || !Number.isFinite(e.estimatedAcresAffected) || e.estimatedAcresAffected < 0) {
      throw new Error('[ag-screening] reported flood-event acres must be finite and nonnegative');
    }
    const d = dateUtc(e.eventDate);
    return d >= cutoff && d <= asOf && e.fieldId === fieldId;
  });
  const totalAcres = recent.reduce((sum, e) => sum + e.estimatedAcresAffected, 0);
  return {
    fieldId,
    eventsInLast5Years: recent.length,
    totalAcresAffected: Math.round(totalAcres * 10) / 10,
    meetsDiscussionThreshold: recent.length >= 2,
    derivation: INFORM_ONLY,
  };
}
