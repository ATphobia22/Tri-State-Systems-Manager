import { buildGeoreferencedExtent, parseWorldFile } from './world-file.mjs';

const PANEL_ID_RE = /^\d{5}[A-Z]\d{4}[A-Z]$/;

export function validateWorldFileAssociation({
  panelId,
  worldFileName,
  rasterWidth,
  rasterHeight,
  worldFileText,
  expectedExtent,
  tolerance = 0,
}) {
  if (!PANEL_ID_RE.test(panelId)) {
    return { ok: false, status: 'FAILED_CLOSED_INVALID_PANEL_ID', errors: ['invalid FEMA panel identifier'] };
  }

  const declaredPanel = worldFileName.replace(/\.(pgw|tfw|jgw|wld)$/i, '');
  const errors = [];
  if (declaredPanel !== panelId) {
    errors.push(`world-file panel mismatch: expected ${panelId}, received ${declaredPanel}`);
  }

  let transform;
  try {
    transform = parseWorldFile(worldFileText);
  } catch (error) {
    errors.push(error.message);
  }

  if (!transform) {
    return { ok: false, status: 'FAILED_CLOSED_INVALID_WORLD_FILE', errors };
  }

  const extent = buildGeoreferencedExtent(transform, rasterWidth, rasterHeight);
  if (expectedExtent) {
    for (const key of ['minX', 'minY', 'maxX', 'maxY']) {
      if (!Number.isFinite(expectedExtent[key]) || Math.abs(extent[key] - expectedExtent[key]) > tolerance) {
        errors.push(`extent mismatch at ${key}`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      status: 'FAILED_CLOSED_WORLD_FILE_ASSOCIATION',
      errors,
      transform,
      extent,
    };
  }

  return {
    ok: true,
    status: 'VALIDATED',
    errors: [],
    transform,
    extent,
    transformation: {
      method: 'ESRI_WORLD_FILE_AFFINE_PIXEL_TO_MAP',
      pixel_origin: 'upper-left pixel center',
      source_panel: panelId,
    },
  };
}
