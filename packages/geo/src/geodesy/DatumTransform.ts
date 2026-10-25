import type { CoordinateReference, ValidationResult } from "./CoordinateReference.js";
import { validateCoordinateReference } from "./CrsValidator.js";

export interface DatumTransformOperation {
  operationId: string;
  source: CoordinateReference;
  target: CoordinateReference;
  method: string;
  sourceUrl: string;
  softwareName?: string;
  softwareVersion?: string;
  modelOrGridSha256?: readonly string[];
  statedAccuracyMeters?: number;
}
export function validateDatumTransformOperation(operation: DatumTransformOperation): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!operation?.operationId?.trim()) errors.push("TRANSFORM_OPERATION_ID_REQUIRED");
  if (!operation?.method?.trim()) errors.push("TRANSFORM_METHOD_REQUIRED");
  if (!operation?.sourceUrl?.trim()) errors.push("TRANSFORM_SOURCE_URL_REQUIRED");
  else {
    try {
      const url = new URL(operation.sourceUrl);
      if (url.protocol !== "https:" || url.username || url.password) errors.push("TRANSFORM_SOURCE_URL_UNSAFE");
    } catch { errors.push("TRANSFORM_SOURCE_URL_INVALID"); }
  }
  if (operation?.statedAccuracyMeters !== undefined && (!Number.isFinite(operation.statedAccuracyMeters) || operation.statedAccuracyMeters < 0)) errors.push("TRANSFORM_ACCURACY_INVALID");
  const hashPattern = /^[a-f0-9]{64}$/i;
  for (const hash of operation?.modelOrGridSha256 ?? []) if (!hashPattern.test(hash)) errors.push("TRANSFORM_GRID_HASH_INVALID");
  if (operation?.source) errors.push(...validateCoordinateReference(operation.source).errors.map((error) => "SOURCE_" + error));
  else errors.push("TRANSFORM_SOURCE_REFERENCE_REQUIRED");
  if (operation?.target) errors.push(...validateCoordinateReference(operation.target).errors.map((error) => "TARGET_" + error));
  else errors.push("TRANSFORM_TARGET_REFERENCE_REQUIRED");
  if (operation?.source && operation?.target && operation.source.epsg === operation.target.epsg && operation.source.verticalDatum === operation.target.verticalDatum) warnings.push("IDENTITY_TRANSFORM_SHOULD_BE_REVIEWED");
  if (!operation?.softwareName || !operation?.softwareVersion) warnings.push("TRANSFORMATION_SOFTWARE_VERSION_NOT_RECORDED");
  return { valid: errors.length === 0, errors, warnings };
}
