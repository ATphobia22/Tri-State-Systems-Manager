import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const root = fileURLToPath(new URL('../..', import.meta.url));
const schemaPath = join(root, 'packages/government/schemas/cesium-story-publication-manifest.schema.json');
const examplePath = join(root, 'packages/government/schemas/cesium-story-publication-manifest.example.json');

const SECRET_KEY = /(token|password|secret|api[_-]?key|authorization|signed[_-]?url|access[_-]?key)/i;
const SHA256 = /^[a-f0-9]{64}$/;

export function validateCesiumStoryPublication(manifest, schema) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return ['manifest must be an object'];
  if (!schema || schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push('publication schema must use JSON Schema 2020-12');
  if (schema?.additionalProperties !== false) errors.push('publication schema must reject unknown root properties');
  if (!Array.isArray(schema?.properties?.exportedArtifacts?.items?.required) ||
      !schema.properties.exportedArtifacts.items.required.includes('redactionReviewed')) {
    errors.push('every exported artifact must require redaction review');
  }

  const visit = (value, path = '$') => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (SECRET_KEY.test(key)) errors.push(`${path} contains prohibited credential-like field ${key}`);
        visit(child, `${path}.${key}`);
      }
    }
  };
  visit(manifest);

  if (manifest.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0');
  if (!manifest.dataset || !SHA256.test(manifest.dataset.sha256 ?? '')) errors.push('dataset.sha256 must be a lowercase SHA-256 digest');
  if (!Array.isArray(manifest.exportedArtifacts) || manifest.exportedArtifacts.length === 0) {
    errors.push('at least one exported artifact is required');
  } else {
    manifest.exportedArtifacts.forEach((artifact, index) => {
      if (!SHA256.test(artifact?.sha256 ?? '')) errors.push(`exportedArtifacts[${index}].sha256 must be a lowercase SHA-256 digest`);
      if (artifact?.redactionReviewed !== true) errors.push(`exportedArtifacts[${index}] must have redactionReviewed=true`);
    });
  }

  const review = manifest.review ?? {};
  const allReviewChecksPassed = review.dataLicenseReviewed === true &&
    review.sensitiveDataReviewed === true &&
    review.propertyAllowlistReviewed === true;
  if (review.publicationDecision === 'approved') {
    if (typeof review.approver !== 'string' || !review.approver.trim()) errors.push('approved publication requires reviewer identity');
    if (typeof review.approvedAt !== 'string' || Number.isNaN(Date.parse(review.approvedAt))) errors.push('approved publication requires approvedAt timestamp');
    if (!allReviewChecksPassed) errors.push('approved publication requires all license, sensitive-data, and property-allowlist checks');
  }

  const presentation = manifest.presentation ?? {};
  if (presentation.provider !== 'cesium-ion-stories') errors.push('presentation provider must be cesium-ion-stories');
  if (presentation.externalSharingEnabled === true) {
    if (review.publicationDecision !== 'approved' || !allReviewChecksPassed) {
      errors.push('external sharing requires approved publication and all review checks');
    }
    try {
      if (new URL(presentation.storyUrl).protocol !== 'https:') errors.push('shared Story URL must use HTTPS');
    } catch {
      errors.push('external sharing requires a valid HTTPS Story URL');
    }
  }
  if (presentation.embedEnabled === true &&
      (presentation.externalSharingEnabled !== true || typeof presentation.storyUrl !== 'string')) {
    errors.push('embedding requires external sharing and a Story URL');
  }

  return errors;
}

function main() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const example = JSON.parse(readFileSync(examplePath, 'utf8'));
  const errors = validateCesiumStoryPublication(example, schema);
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({
    ok: true,
    schema: resolve(schemaPath),
    example: resolve(examplePath),
    publicationDecision: example.review.publicationDecision,
    externalSharingEnabled: example.presentation.externalSharingEnabled,
    credentialFree: true
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
