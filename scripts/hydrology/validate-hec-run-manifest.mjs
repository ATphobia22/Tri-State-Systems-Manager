#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SCHEMA_PATH = path.join(root, 'data/schemas/hec-coupled-run-manifest-v2.schema.json');

function matchesType(value, type) {
  const types = Array.isArray(type) ? type : [type];
  return types.some((item) => {
    if (item === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (item === 'array') return Array.isArray(value);
    if (item === 'integer') return Number.isInteger(value);
    if (item === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (item === 'null') return value === null;
    return typeof value === item;
  });
}

const SUPPORTED_SCHEMA_KEYWORDS = new Set([
  '$schema', '$id', 'title', 'description', 'type', 'additionalProperties',
  'required', 'properties', 'items', 'const', 'enum', 'minLength', 'maxLength',
  'pattern', 'format', 'minimum', 'maximum', 'minItems', 'maxItems',
]);

function findUnsupportedSchemaKeywords(schema, at = '$schema', errors = []) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return errors;
  for (const [keyword, value] of Object.entries(schema)) {
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(keyword)) errors.push(at + ': unsupported schema keyword ' + keyword);
    if (keyword === 'properties' && value && typeof value === 'object') {
      for (const [name, child] of Object.entries(value)) findUnsupportedSchemaKeywords(child, at + '.properties.' + name, errors);
    } else if (keyword === 'items' && value && typeof value === 'object') {
      findUnsupportedSchemaKeywords(value, at + '.items', errors);
    }
  }
  return errors;
}

/** Validates each JSON Schema 2020-12 keyword used by this specific contract.
 * The validator refuses unknown keywords rather than silently skipping them. */
export function validateAgainstSchema(value, schema, at = '$', errors = []) {
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(at + ': expected type ' + JSON.stringify(schema.type));
    return errors;
  }
  if (Object.hasOwn(schema, 'const') && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(at + ': must equal const ' + JSON.stringify(schema.const));
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) errors.push(at + ': value is not an allowed enum member');
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(at + ': below minLength');
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(at + ': above maxLength');
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(at + ': pattern mismatch');
    if (schema.format === 'date-time' && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || Number.isNaN(Date.parse(value)))) errors.push(at + ': invalid RFC 3339 date-time');
    if (schema.format === 'uri') { try { new URL(value); } catch { errors.push(at + ': invalid URI'); } }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(at + ': below minimum');
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(at + ': above maximum');
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(at + ': below minItems');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(at + ': above maxItems');
    if (schema.items) value.forEach((item, i) => validateAgainstSchema(item, schema.items, at + '[' + i + ']', errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(at + ': missing required property ' + key);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties && Object.hasOwn(schema.properties, key)) validateAgainstSchema(child, schema.properties[key], at + '.' + key, errors);
      else if (schema.additionalProperties === false) errors.push(at + ': unexpected property ' + key);
    }
  }
  return errors;
}

const PLACEHOLDER = /^(?:UNASSIGNED|UNVERIFIED|UNPINNED|UNCONFIGURED|AOI_NOT_SELECTED|MISSING|TBD)$/i;
function assertExecutionReady(manifest) {
  const errors = [];
  if (manifest.approval?.status !== 'APPROVED') errors.push('approval.status must be APPROVED before execution');
  if (!manifest.approval?.approved_by || PLACEHOLDER.test(manifest.approval.approved_by)) errors.push('approval.approved_by must identify an accountable approver');
  if (!manifest.approval?.evidence_uri || PLACEHOLDER.test(manifest.approval.evidence_uri)) errors.push('approval.evidence_uri must reference approval evidence');
  const nonPlaceholder = (value) => typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER.test(value.trim());
  if (!nonPlaceholder(manifest.aoi?.name) || !nonPlaceholder(manifest.aoi?.geometry_uri) || !nonPlaceholder(manifest.aoi?.watershed_delineation_uri)) errors.push('AOI geometry and watershed delineation must have named, source-backed references');
  if (manifest.aoi?.geometry_sha256 === '0'.repeat(64) || manifest.aoi?.watershed_delineation_sha256 === '0'.repeat(64)) errors.push('AOI geometry and watershed hashes must be measured, non-placeholder SHA-256 values');
  if (!nonPlaceholder(manifest.reference_system?.horizontal_crs) || !nonPlaceholder(manifest.reference_system?.vertical_datum) || !nonPlaceholder(manifest.reference_system?.datum_evidence_uri) || !nonPlaceholder(manifest.reference_system?.units_policy)) errors.push('horizontal CRS, vertical datum, units and datum evidence must be qualified');
  if (manifest.source_inputs?.some((input) => input.quality_status !== 'QUALIFIED' || !nonPlaceholder(input.source_uri) || !nonPlaceholder(input.valid_time) || !nonPlaceholder(input.license_or_terms_uri) || !nonPlaceholder(input.units) || !nonPlaceholder(input.horizontal_crs) || !nonPlaceholder(input.vertical_datum) || input.sha256 === '0'.repeat(64))) errors.push('every source input must be qualified, licensed/source-referenced, datum-aware and have a measured SHA-256');
  for (const [name, runner] of [['hec_hms', manifest.hec_hms], ['hec_ras', manifest.hec_ras]]) {
    if (!nonPlaceholder(runner?.product_version) || PLACEHOLDER.test(runner?.product_version ?? '') || runner?.command?.some((part) => PLACEHOLDER.test(part))) errors.push(name + ' must use a pinned version and configured command');
    const selector = name === 'hec_hms' ? runner?.run_name : runner?.plan_number;
    if (!nonPlaceholder(selector)) errors.push(name + (name === 'hec_hms' ? '.run_name' : '.plan_number') + ' must identify the exact run/plan to execute');
    if (!nonPlaceholder(runner?.version_evidence_uri)) errors.push(name + '.version_evidence_uri must cite installation/version evidence');
    if (!/^[a-f0-9]{64}$/.test(runner?.project_package_sha256 ?? '') || runner.project_package_sha256 === '0'.repeat(64)) errors.push(name + '.project_package_sha256 must be measured and pinned');
    if (!/^[a-f0-9]{64}$/.test(runner?.executable_sha256 ?? '') || runner.executable_sha256 === '0'.repeat(64)) errors.push(name + '.executable_sha256 must be measured and pinned');
    if (!nonPlaceholder(runner?.runtime_executable_path)) errors.push(name + '.runtime_executable_path must identify the actual vendor HEC executable');
    if (!/^[a-f0-9]{64}$/.test(runner?.runtime_executable_sha256 ?? '') || runner.runtime_executable_sha256 === '0'.repeat(64)) errors.push(name + '.runtime_executable_sha256 must be measured and pinned');
    for (const placeholder of ['{{workspace}}', '{{project}}', '{{output}}', '{{manifest}}', '{{runtime_executable}}']) {
      if (!runner?.command?.some((part) => part.includes(placeholder))) errors.push(name + '.command must include explicit placeholder ' + placeholder);
    }
  }
  if (!/^[a-f0-9]{40}$/.test(manifest.source_commit ?? '') || manifest.source_commit === '0'.repeat(40)) errors.push('source_commit must be the exact non-placeholder Git commit SHA');
  const handoff = manifest.hydrograph_handoff ?? {};
  if (!nonPlaceholder(handoff.time_zone) || !nonPlaceholder(handoff.conversion_method)) errors.push('hydrograph handoff time zone and conversion method must be documented');
  if (!nonPlaceholder(handoff.adapter_version) || handoff.adapter_command?.some((part) => PLACEHOLDER.test(part))) errors.push('hydrograph transfer adapter must be explicitly version-pinned and configured');
  if (!/^[a-f0-9]{64}$/.test(handoff.adapter_executable_sha256 ?? '') || handoff.adapter_executable_sha256 === '0'.repeat(64)) errors.push('hydrograph transfer adapter executable SHA-256 must be measured and pinned');
  if (!/^[a-f0-9]{64}$/.test(handoff.adapter_script_sha256 ?? '') || handoff.adapter_script_sha256 === '0'.repeat(64)) errors.push('hydrograph transfer adapter script SHA-256 must be measured and pinned');
  if (!nonPlaceholder(handoff.adapter_script_path)) errors.push('hydrograph transfer adapter script path must be explicit');
  for (const placeholder of ['{{workspace}}', '{{project}}', '{{output}}', '{{manifest}}', '{{source_output}}', '{{ras_input}}', '{{ras_dss}}', '{{handoff_report}}', '{{adapter_script}}']) {
    if (!handoff.adapter_command?.some((part) => part.includes(placeholder))) errors.push('hydrograph adapter_command must include explicit placeholder ' + placeholder);
  }
  const configuredScript = path.resolve(root, handoff.adapter_script_path ?? '');
  const scriptRelative = path.relative(root, configuredScript);
  if (!scriptRelative || scriptRelative === '..' || scriptRelative.startsWith('..' + path.sep) || path.isAbsolute(scriptRelative)) {
    errors.push('adapter_script_path must identify a file within the checked-out TSM repository');
  } else if (!fs.existsSync(configuredScript) || !fs.statSync(configuredScript).isFile()) {
    errors.push('handoff adapter script file is missing from the repository');
  } else {
    const scriptDigest = createHash('sha256').update(fs.readFileSync(configuredScript)).digest('hex');
    if (scriptDigest !== handoff.adapter_script_sha256) errors.push('handoff adapter script SHA-256 does not match the checked-out source');
    const scriptText = fs.readFileSync(configuredScript, 'utf8');
    const versionMatch = scriptText.match(/ADAPTER_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (!versionMatch || versionMatch[1] !== handoff.adapter_version) errors.push('handoff adapter version is inconsistent with the checked-out source');
  }
  const parts = (pathname) => {
    if (typeof pathname !== 'string' || !pathname.startsWith('/') || !pathname.endsWith('/')) return null;
    const values = pathname.startsWith('//')
      ? ['', ...pathname.slice(2, -1).split('/')]
      : pathname.slice(1, -1).split('/');
    return values.length === 6 && values.every((part, index) => part.length > 0 || index === 0 || index === 3)
      ? values
      : null;
  };
  const sourceParts = parts(handoff.source_dss_pathname);
  const rasParts = parts(handoff.ras_dss_pathname);
  if (!sourceParts || sourceParts[2]?.toUpperCase() !== 'FLOW') errors.push('source_dss_pathname must be a six-part DSS FLOW pathname');
  else {
    if (sourceParts[1].toUpperCase() !== String(handoff.source_element_name ?? '').toUpperCase()) errors.push('source_dss_pathname B-part must match source_element_name exactly');
    if (!sourceParts[5].toUpperCase().includes(String(handoff.source_run_name ?? '').toUpperCase())) errors.push('source_dss_pathname F-part must identify source_run_name');
  }
  if (!rasParts || rasParts[2]?.toUpperCase() !== 'FLOW') errors.push('ras_dss_pathname must be a six-part DSS FLOW pathname');
  else if (rasParts[4].toUpperCase() !== String(handoff.interval ?? '').toUpperCase()) errors.push('ras_dss_pathname E-part must match hydrograph handoff interval');
  const unitPair = String(handoff.source_flow_units ?? '').toUpperCase() + '>' + String(handoff.flow_units ?? '').toUpperCase();
  const allowedConversion = {
    'CFS>CFS': 'NONE_EXACT_VALUES',
    'CMS>CMS': 'NONE_EXACT_VALUES',
    'CFS>CMS': 'CFS_TO_CMS_0.028316846592',
    'CMS>CFS': 'CMS_TO_CFS_35.314666721489',
  };
  if (allowedConversion[unitPair] !== handoff.conversion_method) errors.push('conversion_method must match the explicit source/target flow units');
  if (handoff.gap_policy !== 'REJECT') errors.push('current transfer adapter only supports gap_policy=REJECT');
  const boundary = handoff.boundary_selector ?? {};
  if (boundary.mode === '1D' && (![boundary.river, boundary.reach, boundary.station].every(nonPlaceholder))) errors.push('1D boundary_selector requires explicit river, reach, and station');
  if (boundary.mode === '2D' && (![boundary.area_2d, boundary.bc_line].every(nonPlaceholder))) errors.push('2D boundary_selector requires explicit area_2d and bc_line');
  if (boundary.mode === 'INDEX' && (!Number.isInteger(boundary.boundary_index) || boundary.boundary_index < 0)) errors.push('INDEX boundary_selector requires a non-negative boundary_index');
  if (!nonPlaceholder(boundary.expected_bc_type)) errors.push('boundary_selector.expected_bc_type is required');
  if (manifest.hec_hms?.expected_outputs && !manifest.hec_hms.expected_outputs.includes(manifest.hydrograph_handoff?.source_output)) errors.push('hydrograph_handoff.source_output must be declared as a HEC-HMS expected output');
  if (manifest.hec_ras?.expected_outputs && !manifest.hec_ras.expected_outputs.some((file) => /\.hdf$/i.test(file))) errors.push('HEC-RAS expected_outputs must include a real HDF result artifact');
  return errors;
}

export function validateManifest(manifest, { execution = false } = {}) {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const errors = findUnsupportedSchemaKeywords(schema);
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push('schema dialect must be JSON Schema 2020-12');
  validateAgainstSchema(manifest, schema, '$', errors);
  if (execution) errors.push(...assertExecutionReady(manifest));
  return [...new Set(errors)];
}

function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error('Usage: node scripts/hydrology/validate-hec-run-manifest.mjs <manifest.json> [--execution]');
    process.exitCode = 2;
    return;
  }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8')); }
  catch (error) {
    console.error('Invalid manifest JSON: ' + error.message);
    process.exitCode = 2;
    return;
  }
  const execution = process.argv.includes('--execution');
  const errors = validateManifest(manifest, { execution });
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, execution_ready: false, errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ ok: true, execution_ready: execution, schema: 'hec-coupled-run-manifest-v2' }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
