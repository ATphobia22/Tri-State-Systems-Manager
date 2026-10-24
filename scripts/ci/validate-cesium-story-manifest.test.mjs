import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { validateCesiumStoryPublication } from './validate-cesium-story-manifest.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const schema = JSON.parse(readFileSync(join(root, 'packages/government/schemas/cesium-story-publication-manifest.schema.json'), 'utf8'));
const example = JSON.parse(readFileSync(join(root, 'packages/government/schemas/cesium-story-publication-manifest.example.json'), 'utf8'));

test('fixture remains unapproved, non-shared, credential-free, and hash-bound', () => {
  assert.deepEqual(validateCesiumStoryPublication(example, schema), []);
  assert.equal(example.review.publicationDecision, 'pending');
  assert.equal(example.presentation.externalSharingEnabled, false);
  assert.equal(example.presentation.embedEnabled, false);
});

test('external sharing fails closed without approval, review checks, and HTTPS URL', () => {
  const invalid = structuredClone(example);
  invalid.presentation.externalSharingEnabled = true;
  assert.ok(validateCesiumStoryPublication(invalid, schema).some((error) => error.includes('external sharing requires approved publication')));
  assert.ok(validateCesiumStoryPublication(invalid, schema).some((error) => error.includes('valid HTTPS Story URL')));
});

test('approved publication requires named reviewer, timestamp, and all review gates', () => {
  const invalid = structuredClone(example);
  invalid.review.publicationDecision = 'approved';
  assert.ok(validateCesiumStoryPublication(invalid, schema).some((error) => error.includes('reviewer identity')));
  assert.ok(validateCesiumStoryPublication(invalid, schema).some((error) => error.includes('all license')));
});

test('artifact redaction and credential-field checks are fail-closed', () => {
  const invalid = structuredClone(example);
  invalid.exportedArtifacts[0].redactionReviewed = false;
  invalid.presentation.apiKey = 'not-a-real-key';
  const errors = validateCesiumStoryPublication(invalid, schema);
  assert.ok(errors.some((error) => error.includes('redactionReviewed=true')));
  assert.ok(errors.some((error) => error.includes('credential-like field apiKey')));
});
