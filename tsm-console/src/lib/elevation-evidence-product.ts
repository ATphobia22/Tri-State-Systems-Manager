/**
 * ElevationEvidenceProduct — explicit provenance for every elevation surface.
 *
 * Local-frame math tests are NOT sufficient. Callers must attach this product
 * to DEM tiles, Terrain-RGB, and derived meshes before regulatory or survey
 * claims. Missing fields => reject (do not invent datum or epoch).
 *
 * See docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md §4.
 */

export type ElevationAccuracyClass =
  | 'SURVEY_CONTROL'
  | 'LIDAR_QL2'
  | 'LIDAR_QL1'
  | 'DEM_1M'
  | 'DEM_10M'
  | 'SCREENING'
  | 'UNKNOWN';

export type ElevationAuthorityClass =
  | 'AUTHORITATIVE'
  | 'OBSERVATION'
  | 'DERIVED'
  | 'SIMULATION_DEMO'
  | 'SCREENING';

export interface ElevationEvidenceProduct {
  /** Horizontal CRS, e.g. EPSG:2966 or EPSG:4326 */
  horizontal_crs: string;
  /** Vertical datum, e.g. NAVD88 — never inferred */
  vertical_datum: string;
  /** Decimal year when known (time-dependent CRS); null if not applicable */
  coordinate_epoch: number | null;
  accuracy_class: ElevationAccuracyClass;
  authority_class: ElevationAuthorityClass;
  /** Source identifier + vintage */
  source_id: string;
  /** ISO 8601 acquisition or publication date when known */
  source_date: string | null;
  /** Units of elevation values */
  units: 'meters' | 'feet';
  /** SHA-256 of source bytes when available */
  content_sha256: string | null;
}

export interface ElevationEvidenceValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const CRS_RE = /^(EPSG:\d+|https?:\/\/.+|urn:ogc:def:crs:.+)$/i;

/** Reject incomplete elevation products — no silent datum invention. */
export function validateElevationEvidenceProduct(
  product: Partial<ElevationEvidenceProduct> | null | undefined,
): ElevationEvidenceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!product) {
    return { valid: false, errors: ['ElevationEvidenceProduct is required'], warnings };
  }
  if (!product.horizontal_crs || !CRS_RE.test(product.horizontal_crs)) {
    errors.push('horizontal_crs must be an EPSG/URN/URL CRS identifier');
  }
  if (!product.vertical_datum || !String(product.vertical_datum).trim()) {
    errors.push('vertical_datum is required (e.g. NAVD88); never invent');
  }
  if (product.coordinate_epoch != null) {
    if (!Number.isFinite(product.coordinate_epoch) || product.coordinate_epoch < 1900 || product.coordinate_epoch > 2100) {
      errors.push('coordinate_epoch must be a decimal year in a plausible range');
    }
  } else {
    warnings.push('coordinate_epoch is null — acceptable only for static projected CRS');
  }
  if (!product.accuracy_class) {
    errors.push('accuracy_class is required');
  } else if (product.accuracy_class === 'UNKNOWN') {
    warnings.push('accuracy_class UNKNOWN — screening use only');
  }
  if (!product.authority_class) {
    errors.push('authority_class is required');
  }
  if (!product.source_id || !String(product.source_id).trim()) {
    errors.push('source_id is required');
  }
  if (product.units !== 'meters' && product.units !== 'feet') {
    errors.push("units must be 'meters' or 'feet'");
  }
  if (product.authority_class === 'AUTHORITATIVE' && product.accuracy_class === 'SCREENING') {
    errors.push('AUTHORITATIVE authority cannot pair with SCREENING accuracy');
  }
  return { valid: errors.length === 0, errors, warnings };
}

/** Assert or throw — use at DEM ingest / terrain apply boundaries. */
export function assertElevationEvidenceProduct(
  product: Partial<ElevationEvidenceProduct> | null | undefined,
): asserts product is ElevationEvidenceProduct {
  const result = validateElevationEvidenceProduct(product);
  if (!result.valid) {
    throw new Error(`ElevationEvidenceProduct invalid: ${result.errors.join('; ')}`);
  }
}
