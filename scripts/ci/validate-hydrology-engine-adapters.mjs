import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const registryPath = join(root, 'integrations/hydrology-engine-adapters.json');
const ALLOWED_STATUS = new Set(['catalog-only', 'prototype-in-repository', 'external-engine']);
const ALLOWED_INTERFACES = new Set(['external-cli', 'external-cli-or-api', 'external-cli-or-python-api', 'python-api-or-cli', 'python-library', 'python-library-or-pipeline', 'openfoam-plugin', 'library-or-coupled-simulation', 'external-engineering-software']);

export function validateHydrologyAdapters(registry) {
  const errors = [];
  if (!registry || registry.schemaVersion !== 1 || !Array.isArray(registry.adapters)) {
    return ['registry must declare schemaVersion 1 and an adapters array'];
  }
  const policy = registry.policy || {};
  for (const key of ['executionEnabledByDefault', 'runtimeCredentialsRequired', 'automaticDependencyInstall', 'humanReviewRequired', 'noSilentAuthorityPromotion', 'requireContentHashes', 'requireExplicitCrsAndDatum', 'requireValidationEvidenceBeforeScientificPass']) {
    const expected = key === 'humanReviewRequired' || key === 'noSilentAuthorityPromotion' || key === 'requireContentHashes' || key === 'requireExplicitCrsAndDatum' || key === 'requireValidationEvidenceBeforeScientificPass' ? true : false;
    if (policy[key] !== expected) errors.push('policy.' + key + ' must be ' + expected);
  }
  if (!Array.isArray(registry.requiredRunEvidence) || !['engine_version_evidence', 'input_manifest_sha256', 'configuration_sha256', 'output_artifact_sha256', 'validation_report_sha256', 'source_provenance', 'crs_and_datum', 'review_status'].every(key => registry.requiredRunEvidence.includes(key))) {
    errors.push('requiredRunEvidence must retain engine version, input/config/output/validation hashes, provenance, CRS/datum and review status');
  }
  const seen = new Set();
  for (const [index, adapter] of registry.adapters.entries()) {
    const label = 'adapters[' + index + ']';
    if (!adapter || typeof adapter !== 'object' || Array.isArray(adapter)) {
      errors.push(label + ' must be an object');
      continue;
    }
    for (const key of ['id', 'project', 'modelFamily', 'interface', 'sourceUrl', 'status', 'expectedInputs', 'expectedOutputs', 'validationGates', 'limitations']) {
      if (typeof adapter[key] === 'string' && adapter[key].trim() === '') errors.push(label + '.' + key + ' must not be empty');
      if (!Object.hasOwn(adapter, key)) errors.push(label + '.' + key + ' is required');
    }
    if (typeof adapter.id === 'string') {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(adapter.id)) errors.push(label + '.id must be kebab-case');
      if (seen.has(adapter.id)) errors.push('duplicate adapter id: ' + adapter.id);
      seen.add(adapter.id);
    }
    try {
      if (new URL(adapter.sourceUrl).protocol !== 'https:') errors.push(label + '.sourceUrl must use HTTPS');
    } catch {
      errors.push(label + '.sourceUrl must be a valid URL');
    }
    if (!ALLOWED_STATUS.has(adapter.status)) errors.push(label + '.status is not allowed');
    if (!ALLOWED_INTERFACES.has(adapter.interface)) errors.push(label + '.interface is not allowed');
    if (adapter.runtimeCredentialsRequired !== false) errors.push(label + ' must not require runtime credentials by default');
    for (const field of ['expectedInputs', 'expectedOutputs', 'validationGates']) {
      if (!Array.isArray(adapter[field]) || adapter[field].length === 0 || adapter[field].some(value => typeof value !== 'string' || value.trim() === '')) {
        errors.push(label + '.' + field + ' must be a non-empty array of strings');
      }
    }
  }
  const required = ['swmm', 'delft3d-flow', 'anuga', 'modflow-6', 'flopy', 'opengeosys', 'bmi-python', 'hydroerr', 'pyrad', 'openfoam', 'turbinesfoam', 'dualsphysics', 'elmerfem', 'openfast', 'rosco', 'windpowerlib', 'hec-ras'];
  for (const id of required) if (!seen.has(id)) errors.push('required adapter missing: ' + id);
  const hec = registry.adapters.find(adapter => adapter.id === 'hec-ras');
  if (hec && hec.status !== 'external-engine') errors.push('HEC-RAS must remain explicitly classified as external software');
  return [...new Set(errors)];
}

function main() {
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const errors = validateHydrologyAdapters(registry);
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, registryPath, errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ ok: true, registryPath: resolve(registryPath), adapters: registry.adapters.length, executionEnabledByDefault: registry.policy.executionEnabledByDefault, humanReviewRequired: registry.policy.humanReviewRequired }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
