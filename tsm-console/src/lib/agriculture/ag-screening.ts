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

/** Roll up per-zone exposure into a single field summary. */
export function summarizeFieldExposure(exposure: FieldExposure): FieldExposureSummary {
  if (!Number.isFinite(exposure.totalAcres) || exposure.totalAcres <= 0) {
    throw new Error('[ag-screening] totalAcres must be a positive finite number');
  }
  const sfhaAcres = Object.values(exposure.sfhaAcresByZone).reduce(
    (sum, acres) => sum + (Number.isFinite(acres) && acres > 0 ? acres : 0),
    0,
  );
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
  const cutoff = new Date(asOfDate);
  cutoff.setFullYear(cutoff.getFullYear() - 5);
  const recent = entries.filter((e) => {
    const d = new Date(e.eventDate);
    return Number.isFinite(d.getTime()) && d >= cutoff && e.fieldId === fieldId;
  });
  const totalAcres = recent.reduce(
    (sum, e) => sum + (Number.isFinite(e.estimatedAcresAffected) ? e.estimatedAcresAffected : 0),
    0,
  );
  return {
    fieldId,
    eventsInLast5Years: recent.length,
    totalAcresAffected: Math.round(totalAcres * 10) / 10,
    meetsDiscussionThreshold: recent.length >= 2,
    derivation: INFORM_ONLY,
  };
}
