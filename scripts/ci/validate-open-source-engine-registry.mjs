import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const root = fileURLToPath(new URL('../..', import.meta.url));
const registryPath = join(root, 'integrations/open-source-engine-registry.json');

const allowedClasses = new Set(['core', 'complement', 'optional', 'external-engineering-software']);
const allowedStatuses = new Set(['in-repo-reference', 'candidate', 'external-non-open-source']);
const requiredStrings = ['id', 'project', 'category', 'sourceUrl', 'license', 'integrationClass', 'status', 'role', 'authorityBoundary'];

export function validateRegistry(registry) {
  const errors = [];
  if (!registry || registry.schemaVersion !== 1 || !Array.isArray(registry.engines)) {
    return ['registry must declare schemaVersion 1 and an engines array'];
  }

  const seen = new Set();
  for (const [index, engine] of registry.engines.entries()) {
    const label = `engines[${index}]`;
    if (!engine || typeof engine !== 'object' || Array.isArray(engine)) {
      errors.push(`${label} must be an object`);
      continue;
    }

    for (const key of requiredStrings) {
      if (typeof engine[key] !== 'string' || engine[key].trim() === '') {
        errors.push(`${label}.${key} must be a non-empty string`);
      }
    }

    if (typeof engine.id === 'string') {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(engine.id)) errors.push(`${label}.id must be kebab-case`);
      if (seen.has(engine.id)) errors.push(`duplicate engine id: ${engine.id}`);
      seen.add(engine.id);
    }

    if (typeof engine.sourceUrl === 'string') {
      try {
        const url = new URL(engine.sourceUrl);
        if (url.protocol !== 'https:') errors.push(`${label}.sourceUrl must use HTTPS`);
      } catch {
        errors.push(`${label}.sourceUrl must be a valid URL`);
      }
    }

    if (!allowedClasses.has(engine.integrationClass)) errors.push(`${label}.integrationClass is not allowed`);
    if (!allowedStatuses.has(engine.status)) errors.push(`${label}.status is not allowed`);
    if (typeof engine.openSource !== 'boolean') errors.push(`${label}.openSource must be boolean`);
    if (typeof engine.runtimeCredentialsRequired !== 'boolean') errors.push(`${label}.runtimeCredentialsRequired must be boolean`);
    if (engine.runtimeCredentialsRequired !== false) errors.push(`${label} requires runtime credentials; exclude it from the credential-free catalog`);

    if (engine.openSource === false && engine.integrationClass !== 'external-engineering-software') {
      errors.push(`${label} non-open-source projects must use external-engineering-software classification`);
    }
    if (engine.openSource === true && engine.integrationClass === 'external-engineering-software') {
      errors.push(`${label} open-source projects cannot use external-engineering-software classification`);
    }
    if (engine.openSource === false && engine.status !== 'external-non-open-source') {
      errors.push(`${label} non-open-source projects must be marked external-non-open-source`);
    }
    if (engine.openSource === true && engine.status === 'external-non-open-source') {
      errors.push(`${label} open-source projects cannot be marked external-non-open-source`);
    }
  }

  if (registry.policy?.noSilentAuthorityPromotion !== true) errors.push('policy.noSilentAuthorityPromotion must be true');
  if (registry.policy?.licenseReviewBeforeBundling !== true) errors.push('policy.licenseReviewBeforeBundling must be true');
  if (registry.policy?.noAutomaticDependencyInstall !== true) errors.push('policy.noAutomaticDependencyInstall must be true');

  const hecRas = registry.engines.find((engine) => engine.id === 'hec-ras');
  if (hecRas && hecRas.openSource !== false) errors.push('HEC-RAS must not be represented as open source');
  const cesiumIon = registry.engines.find((engine) => /cesium.?ion/i.test(engine.id + ' ' + engine.project));
  if (cesiumIon) errors.push('Cesium ion is a hosted optional service and must not be part of the credential-free engine catalog');

  return errors;
}

function main() {
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const errors = validateRegistry(registry);
  if (errors.length > 0) {
    console.error(JSON.stringify({ ok: false, registryPath, errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({
    ok: true,
    registryPath: resolve(registryPath),
    engines: registry.engines.length,
    credentialFree: registry.engines.every((engine) => engine.runtimeCredentialsRequired === false),
    openSourceCount: registry.engines.filter((engine) => engine.openSource).length,
    externalNonOpenSourceCount: registry.engines.filter((engine) => !engine.openSource).length,
    noSilentAuthorityPromotion: registry.policy.noSilentAuthorityPromotion
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
