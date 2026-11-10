/**
 * Gage / gauge datum discipline — prevent unit and datum confusion.
 *
 * Verified product fact (NOAA NWPS MTVI3 Vertical Datum Table, water.noaa.gov/gauges/mtvi3):
 *   Gauge Zero = 318.59 ft NAVD88  (also listed NGVD29 318.92 ft)
 *   Stage categories are in feet above gage zero (e.g. minor flood 35 ft stage).
 *
 * Rules:
 * 1. Observed "stage" from NWPS/USGS is GAGE_DATUM feet unless the product says otherwise.
 * 2. WSE_NAVD88 = stage_ft + gage_zero_ft_NAVD88  ONLY when gage_zero is from the same
 *    published product table (or a PE-documented conversion). Never invent zeros.
 * 3. USGS site "alt_va" (land-surface/gage altitude in NWIS site file) is NOT automatically
 *    the operational flood-category gage zero — do not swap them.
 * 4. Different stations have different zeros. Never apply MTVI3 zero to 03378500 or vice versa.
 */

export type VerticalDatumLabel = "GAGE_DATUM" | "NAVD88" | "NGVD29" | "UNKNOWN";

export type GageStageReading = {
  stationId: string;
  /** Stage as reported by the product (typically feet above local gage zero). */
  stageFt: number;
  stageDatum: "GAGE_DATUM";
  observedAt?: string;
  source: string;
};

export type PublishedGageZero = {
  stationId: string;
  gageZeroFt: number;
  verticalDatum: "NAVD88" | "NGVD29";
  sourceUrl: string;
  sourceLabel: string;
  /** When the product table was verified by TSM operators */
  verifiedAt: string;
};

/** NOAA NWPS MTVI3 — Ohio River at Mount Vernon, IN (Posey Co). */
export const MTVI3_GAGE_ZERO_NAVD88: PublishedGageZero = Object.freeze({
  stationId: "MTVI3",
  gageZeroFt: 318.59,
  verticalDatum: "NAVD88",
  sourceUrl: "https://water.noaa.gov/gauges/mtvi3",
  sourceLabel: "NOAA NWPS Vertical Datum Table — Gauge Zero",
  verifiedAt: "2026-11-10",
});

/** Historic crest stage (ft above gage zero) — NOAA historic crests table. */
export const MTVI3_HISTORIC_1937_CREST_STAGE_FT = 59.21;

/**
 * Convert stage (GAGE_DATUM) → approximate WSE in published vertical datum.
 * Returns null if station has no published zero in this registry (fail quiet, not invent).
 */
export function stageToWseFt(
  reading: GageStageReading,
  publishedZero: PublishedGageZero | null
): {
  wseFt: number | null;
  verticalDatum: VerticalDatumLabel;
  formula: string;
  authority: "OBSERVATION_CONVERTED" | "GAGE_DATUM_ONLY";
  disclaimer: string;
} {
  if (!publishedZero || publishedZero.stationId !== reading.stationId) {
    return {
      wseFt: null,
      verticalDatum: "GAGE_DATUM",
      formula: "WSE unavailable — no product-matched gage zero for this stationId",
      authority: "GAGE_DATUM_ONLY",
      disclaimer:
        "Stage remains in GAGE_DATUM. Do not apply another station's zero or USGS alt_va as a substitute.",
    };
  }
  if (!Number.isFinite(reading.stageFt) || !Number.isFinite(publishedZero.gageZeroFt)) {
    return {
      wseFt: null,
      verticalDatum: "UNKNOWN",
      formula: "invalid inputs",
      authority: "GAGE_DATUM_ONLY",
      disclaimer: "Non-finite stage or gage zero.",
    };
  }
  const wseFt = reading.stageFt + publishedZero.gageZeroFt;
  return {
    wseFt,
    verticalDatum: publishedZero.verticalDatum,
    formula: `WSE_${publishedZero.verticalDatum} = stage_ft + gage_zero_ft (${reading.stageFt} + ${publishedZero.gageZeroFt})`,
    authority: "OBSERVATION_CONVERTED",
    disclaimer:
      "Conversion uses published NWPS/product gage zero for this station only. Not a survey of structure LAG/BFE.",
  };
}

/** 1937 crest check: 59.21 + 318.59 = 377.80 ft NAVD88 (matches prior animation target). */
export function mtvi31937CrestWseNavd88(): number {
  return MTVI3_HISTORIC_1937_CREST_STAGE_FT + MTVI3_GAGE_ZERO_NAVD88.gageZeroFt;
}

export const GAGE_DISCIPLINE_NOTES = Object.freeze({
  never: [
    "Never treat stage feet as NAVD88 feet without adding published gage zero",
    "Never reuse MTVI3 zero on USGS 03378500 or other stations",
    "Never use NWIS alt_va as operational flood-category gage zero without product match",
    "Never publish gageZeroNavd88 as validated in APIs without evidence",
  ],
  mtvi3_zero_navd88: MTVI3_GAGE_ZERO_NAVD88.gageZeroFt,
  mtvi3_1937_wse_navd88: 59.21 + 318.59,
});
