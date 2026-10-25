import type { CoordinateReference, ValidationResult } from "./CoordinateReference.js";
import type { ElevationValue } from "./ElevationValidator.js";
import type { LinearUnit } from "./UnitRegistry.js";
import { convertLinear } from "./UnitConversion.js";
import { validateCoordinateReference } from "./CrsValidator.js";
import { VerticalDatum } from "./VerticalDatum.js";

export interface GageMeasurement {
  stage: number;
  units: LinearUnit;
  stationId: string;
  gageDatumId: string;
  observedAt: string;
  sourceUrl: string;
}
export interface GageZeroSurvey {
  stationId: string;
  gageDatumId: string;
  gageZeroElevation: number;
  units: LinearUnit;
  reference: CoordinateReference;
  surveyId: string;
  surveyedAt: string;
  sourceUrl: string;
}
export interface GageStageConversion { valid: boolean; elevation?: ElevationValue; validation: ValidationResult; }

export function stageToElevation(measurement: GageMeasurement, survey: GageZeroSurvey): GageStageConversion {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!measurement || !Number.isFinite(measurement.stage)) errors.push("GAGE_STAGE_MUST_BE_FINITE");
  if (!survey || !Number.isFinite(survey.gageZeroElevation)) errors.push("GAGE_ZERO_ELEVATION_MUST_BE_FINITE");
  if (!measurement?.stationId || measurement.stationId !== survey?.stationId) errors.push("GAGE_STATION_MISMATCH");
  if (!measurement?.gageDatumId || measurement.gageDatumId !== survey?.gageDatumId) errors.push("GAGE_DATUM_ID_MISMATCH");
  if (!measurement?.sourceUrl || !survey?.sourceUrl || !survey?.surveyId?.trim()) errors.push("GAGE_SOURCE_AND_SURVEY_PROVENANCE_REQUIRED");
  if (!Number.isFinite(Date.parse(measurement?.observedAt ?? ""))) errors.push("GAGE_OBSERVATION_TIME_INVALID");
  if (!Number.isFinite(Date.parse(survey?.surveyedAt ?? ""))) errors.push("GAGE_SURVEY_TIME_INVALID");
  for (const source of [measurement?.sourceUrl, survey?.sourceUrl]) {
    if (!source) continue;
    try {
      const url = new URL(source);
      if (url.protocol !== "https:" || url.username || url.password) errors.push("GAGE_SOURCE_URL_UNSAFE");
    } catch { errors.push("GAGE_SOURCE_URL_INVALID"); }
  }
  const targetVerticalDatum = survey?.reference?.verticalDatum;
  if (targetVerticalDatum === VerticalDatum.GAGE_DATUM || targetVerticalDatum === VerticalDatum.ELLIPSOID || targetVerticalDatum === VerticalDatum.UNKNOWN || !targetVerticalDatum) errors.push("GAGE_ZERO_TARGET_VERTICAL_DATUM_INVALID");
  if (survey?.reference) {
    const crsResult = validateCoordinateReference(survey.reference);
    errors.push(...crsResult.errors);
    warnings.push(...crsResult.warnings);
  } else errors.push("GAGE_ZERO_COORDINATE_REFERENCE_REQUIRED");
  if (errors.length) return { valid: false, validation: { valid: false, errors: [...new Set(errors)], warnings } };
  const stageInSurveyUnits = convertLinear(measurement.stage, measurement.units, survey.units);
  const elevation: ElevationValue = {
    value: survey.gageZeroElevation + stageInSurveyUnits,
    units: survey.units,
    reference: survey.reference,
    sourceId: "gage-stage:" + measurement.stationId + ":" + measurement.gageDatumId,
    heightType: targetVerticalDatum === VerticalDatum.MLLW || targetVerticalDatum === VerticalDatum.MHW ? "TIDAL" : "ORTHOMETRIC"
  };
  return { valid: true, elevation, validation: { valid: true, errors: [], warnings } };
}
