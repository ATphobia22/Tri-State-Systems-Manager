/**
 * Station-bound vertical calibration and hydraulic transfer guard.
 *
 * A gage-height -> NAVD88 conversion establishes WSE at the station only.
 * It never establishes a project-site WSE without a validated hydraulic
 * profile/model transfer with explicit lineage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeVerticalDatum } from './vertical-datum.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_ENV = String(process.env.TSM_AUTHORITY_REGISTRY || '').trim();
const REGISTRY_CANDIDATES = [
  ...(REGISTRY_ENV ? [REGISTRY_ENV] : []),
  path.join(process.cwd(), 'data', 'authority', 'tsm-authority-registry-v35.json'),
  path.join(process.cwd(), 'tsm-authority-registry-v35.json'),
  path.join(process.cwd(), '..', 'tsm-authority-registry-v35.json'),
  path.join(__dirname, '../../../tsm-authority-registry-v35.json'),
  path.join(__dirname, '../../../../tsm-authority-registry-v35.json'),
];

function loadRegistry() {
  const registryPath = REGISTRY_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!registryPath) return { hydrologic_nodes: [] };
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    return { hydrologic_nodes: [] };
  }
}

export function getHydrologicNode(stationId) {
  const node = (loadRegistry().hydrologic_nodes || []).find(
    (candidate) => candidate.usgs_id === stationId || candidate.id === stationId || candidate.nws_id === stationId,
  );
  if (!node) {
    return { usgs_id: stationId, id: stationId, name: `Unregistered station ${stationId}`, role: 'UNREGISTERED_SOURCE' };
  }
  return node;
}

export function calculateGaugeWseNavd88({ stationId, stageFt }) {
  if (!Number.isFinite(stageFt)) {
    throw Object.assign(new TypeError('stageFt must be a finite number'), { code: 'INVALID_STAGE', status: 400 });
  }
  const node = getHydrologicNode(stationId);
  const zero = Number(node.gage_zero_navd88_ft);
  const source = node.vertical_conversion_source;
  if (!Number.isFinite(zero) || !source || node.vertical_conversion_status !== 'VERIFIED_PUBLISHED_STATION_RELATIONSHIP') {
    return {
      ok: false,
      station_id: stationId,
      stage_ft_gage_datum: stageFt,
      wse_navd88_ft: null,
      gage_zero_navd88_ft: null,
      vertical_conversion_status: 'UNVERIFIED_CONVERSION',
      site_transfer_status: 'REQUIRES_VALIDATED_HYDRAULIC_PROFILE',
      hydraulic_extrusion_eligibility: 'NOT_ELIGIBLE_UNVERIFIED_SITE_TRANSFER',
    };
  }
  const normalized = normalizeVerticalDatum({
    valueFt: stageFt,
    sourceDatum: 'GAGE_DATUM',
    targetDatum: 'NAVD88',
    offsetFt: zero,
    offsetSource: source,
  });
  return {
    ok: true,
    station_id: stationId,
    station_name: node.name,
    stage_ft_gage_datum: stageFt,
    wse_navd88_ft: Number(normalized.valueFt.toFixed(2)),
    gage_zero_navd88_ft: zero,
    vertical_conversion_status: 'VERIFIED_PUBLISHED_STATION_RELATIONSHIP',
    vertical_conversion_source: node.vertical_conversion_source_uri,
    site_transfer_status: node.site_transfer_required ? 'REQUIRES_VALIDATED_HYDRAULIC_PROFILE' : 'NOT_REQUIRED',
    hydraulic_extrusion_eligibility: 'NOT_ELIGIBLE_UNVERIFIED_SITE_TRANSFER',
    disclaimer: 'This is the NAVD88 WSE at the registered gage station. It is not a site WSE and must not be projected onto unrelated terrain without a validated hydraulic profile/model transfer.',
  };
}
