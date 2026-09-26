/**
 * HEC-RAS GeoTIFF depth-raster ingest endpoint logic.
 *
 * Receives the payload produced by tsm-console/scripts/ras-geotiff-ingest.mjs
 * (POST /api/engineering/ras-results): downsampled depth cells from a
 * HEC-RAS depth raster, stamped with Bonebank BFE/LAG constants.
 *
 * Fail-closed: validateRasResultsPayload throws on any schema violation and
 * the caller must answer 422. Nothing here is a regulatory determination;
 * accepted payloads are MODEL_OUTPUT / DERIVATION pending human review.
 *
 * authority_class: MODEL_OUTPUT / DERIVATION for downsampled cells.
 * Native analysis CRS for site work remains EPSG:2966 / NAVD88.
 */

const MAX_CELLS = 100_000;
const HEX64 = /^[0-9a-f]{64}$/i;

export function validateRasResultsPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw rasError('payload must be a JSON object');
  }
  const { meta, cells, bfe_navd88_ft, lag_navd88_ft } = body;

  if (!meta || typeof meta !== 'object') throw rasError('meta object is required');
  if (typeof meta.plan_id !== 'string' || meta.plan_id.trim().length === 0) {
    throw rasError('meta.plan_id must be a non-empty string');
  }
  if (typeof meta.content_hash_sha256 !== 'string' || !HEX64.test(meta.content_hash_sha256)) {
    throw rasError('meta.content_hash_sha256 must be a 64-char lowercase hex SHA-256');
  }
  if (typeof meta.authority_class !== 'string' || meta.authority_class.trim().length === 0) {
    throw rasError('meta.authority_class is required (e.g. DERIVATION)');
  }

  if (!Array.isArray(cells) || cells.length === 0) {
    throw rasError('cells must be a non-empty array');
  }
  if (cells.length > MAX_CELLS) {
    throw rasError(`cells array too large (${cells.length} > ${MAX_CELLS})`);
  }
  cells.forEach((cell, i) => {
    if (!cell || typeof cell !== 'object') throw rasError(`cells[${i}] must be an object`);
    if (typeof cell.id !== 'string' || cell.id.length === 0) {
      throw rasError(`cells[${i}].id must be a non-empty string`);
    }
    if (!Number.isFinite(cell.depth_ft) || cell.depth_ft < 0) {
      throw rasError(`cells[${i}].depth_ft must be a finite non-negative number`);
    }
    for (const coord of ['x_native', 'y_native']) {
      if (cell[coord] !== undefined && !Number.isFinite(cell[coord])) {
        throw rasError(`cells[${i}].${coord} must be finite when present`);
      }
    }
  });

  for (const [name, value] of [['bfe_navd88_ft', bfe_navd88_ft], ['lag_navd88_ft', lag_navd88_ft]]) {
    if (!Number.isFinite(value)) throw rasError(`${name} must be a finite number (NAVD88 ft)`);
  }

  return {
    plan_id: meta.plan_id,
    source: String(meta.source || 'geotiff:unknown'),
    content_hash_sha256: meta.content_hash_sha256.toLowerCase(),
    cell_count: cells.length,
    authority_class: meta.authority_class,
    derivation_class: String(meta.derivation_class || 'HEC_RAS_DEPTH_DOWNSAMPLE'),
  };
}

function rasError(message) {
  const error = new Error(message);
  error.code = 'RAS_RESULTS_INVALID';
  return error;
}

/**
 * Build the evidence-store artifact record for an accepted payload.
 * The store itself (appendArtifact) is injected by the HTTP layer so this
 * module stays pure and unit-testable.
 */
export function buildRasResultsArtifact(summary, body) {
  return {
    artifact_type: 'engineering_ras_results',
    source_authority: 'HEC-RAS (operator-supplied depth raster)',
    source_uri: `internal://tsm/engineering/ras-results/${summary.plan_id}`,
    source_identifier: summary.plan_id,
    retrieved_at: new Date().toISOString(),
    horizontal_crs: 'EPSG:2966',
    horizontal_crs_name: 'NAD83 / Indiana West (ftUS)',
    vertical_datum: 'NAVD88',
    content_hash_sha256: summary.content_hash_sha256,
    validation_status: 'provisional',
    authority_class: 'MODEL_OUTPUT',
    derivation_class: summary.derivation_class,
    software_version: 'tsm-ras-ingest@1.0.0',
    operator_or_service_identity: 'ras-results-api',
    governance_status: 'human_review_required',
    is_simulation_demo: false,
    human_review_status: 'pending',
    transformation_chain: [],
    payload: {
      summary,
      bfe_navd88_ft: body.bfe_navd88_ft,
      lag_navd88_ft: body.lag_navd88_ft,
      meta: body.meta,
      cells: body.cells,
    },
    notes:
      'Downsampled HEC-RAS depth raster cells. DERIVATION/MODEL_OUTPUT, not a regulatory ' +
      'determination. BFE/LAG are stamped constants, not inferred from the raster.',
  };
}
