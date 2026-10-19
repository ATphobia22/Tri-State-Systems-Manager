/**
 * Batch coordinate validation — system-wide CRS/datum/epoch/accuracy checks.
 *
 * Processes feature records (e.g. building footprints) and reports coverage.
 * Does not invent missing fields; incomplete features fail closed for AUTHORITATIVE use.
 */

import {
  type ElevationEvidenceProduct,
  validateElevationEvidenceProduct,
} from './elevation-evidence-product';

export interface CoordinateFeatureRecord {
  id: string;
  horizontal_crs?: string;
  vertical_datum?: string;
  coordinate_epoch?: number | null;
  accuracy_class?: ElevationEvidenceProduct['accuracy_class'];
  authority_class?: ElevationEvidenceProduct['authority_class'];
  source_id?: string;
  source_date?: string | null;
  units?: 'meters' | 'feet';
  /** Optional height for stats only */
  height_m?: number | null;
}

export interface BatchValidationReport {
  total: number;
  valid: number;
  invalid: number;
  missingCrs: number;
  missingDatum: number;
  missingEpochWhenRequired: number;
  errors: Array<{ id: string; errors: string[] }>;
  /** Fraction 0..1 of features with complete evidence */
  coverage: number;
}

export function validateFeatureCoordinates(
  features: readonly CoordinateFeatureRecord[],
  options: { requireEpoch?: boolean; maxErrors?: number } = {},
): BatchValidationReport {
  const maxErrors = options.maxErrors ?? 100;
  let valid = 0;
  let missingCrs = 0;
  let missingDatum = 0;
  let missingEpochWhenRequired = 0;
  const errors: Array<{ id: string; errors: string[] }> = [];

  for (const f of features) {
    if (!f.horizontal_crs) missingCrs++;
    if (!f.vertical_datum) missingDatum++;
    if (options.requireEpoch && (f.coordinate_epoch == null || !Number.isFinite(f.coordinate_epoch))) {
      missingEpochWhenRequired++;
    }

    const product: Partial<ElevationEvidenceProduct> = {
      horizontal_crs: f.horizontal_crs,
      vertical_datum: f.vertical_datum,
      coordinate_epoch: f.coordinate_epoch ?? null,
      accuracy_class: f.accuracy_class ?? 'UNKNOWN',
      authority_class: f.authority_class ?? 'DERIVED',
      source_id: f.source_id ?? f.id,
      source_date: f.source_date ?? null,
      units: f.units ?? 'meters',
      content_sha256: null,
    };

    const result = validateElevationEvidenceProduct(product);
    if (options.requireEpoch && product.coordinate_epoch == null) {
      result.errors.push('coordinate_epoch required by batch policy');
      result.valid = false;
    }

    if (result.valid) valid++;
    else if (errors.length < maxErrors) {
      errors.push({ id: f.id, errors: result.errors });
    }
  }

  const total = features.length;
  return {
    total,
    valid,
    invalid: total - valid,
    missingCrs,
    missingDatum,
    missingEpochWhenRequired,
    errors,
    coverage: total === 0 ? 0 : valid / total,
  };
}
