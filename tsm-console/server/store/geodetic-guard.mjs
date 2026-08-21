/**
 * Fail-closed geodetic guards for evidence append
 */

export const AUTHORITATIVE_EPSG = 2966;
export const REJECTED_EPSG = new Set([2967]);

export function normalizeEpsg(value) {
  if (value == null) return null;
  const s = String(value).toUpperCase().replace('EPSG:', '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateSpatialFields(raw) {
  const epsg = normalizeEpsg(raw.horizontal_crs ?? raw.spatial_reference?.horizontal_crs);
  if (epsg != null && REJECTED_EPSG.has(epsg)) {
    return {
      ok: false,
      error: `fail-closed: rejected horizontal CRS EPSG:${epsg} — use EPSG:${AUTHORITATIVE_EPSG}`,
    };
  }
  const vd = raw.vertical_datum ?? raw.vertical_reference?.vertical_datum;
  if (vd && String(vd).toUpperCase().includes('NAVD29')) {
    return { ok: false, error: 'fail-closed: NAVD29 not accepted for new artifacts; use NAVD88' };
  }
  // Warn-only if non-2966 without chain
  if (epsg != null && epsg !== AUTHORITATIVE_EPSG) {
    const chain = raw.transformation_chain;
    if (!Array.isArray(chain) || chain.length === 0) {
      return {
        ok: false,
        error: `fail-closed: EPSG:${epsg} requires non-empty transformation_chain (analysis frame is EPSG:${AUTHORITATIVE_EPSG})`,
      };
    }
  }
  return { ok: true };
}
