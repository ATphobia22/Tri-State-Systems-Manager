import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract = JSON.parse(readFileSync(new URL('../../integrations/apple-platform/apple-developer-forums-findings.json', import.meta.url), 'utf8'));
const waypointSchema = JSON.parse(readFileSync(new URL('../../schemas/compass-waypoint.schema.json', import.meta.url), 'utf8'));
const shortcut = JSON.parse(readFileSync(new URL('../../integrations/apple-shortcuts/tsm-shortcuts-api.json', import.meta.url), 'utf8'));

test('Apple platform research is traceable and implementation status is honest', () => {
  assert.equal(contract.status, 'research-applied-to-contracts');
  assert.equal(contract.principles.length, 4);
  assert.ok(contract.principles.every((item) => /^https:\/\//.test(item.source)));
  assert.equal(contract.guardrails.nativeAppIntentsBuilt, false);
  assert.equal(contract.guardrails.forumPostsAreNormativeApiContracts, false);
});

test('waypoint heading metadata supports quality reporting without promoting authority', () => {
  const heading = waypointSchema.properties.heading;
  assert.equal(heading.properties.accuracyDegrees.type[1], 'null');
  assert.equal(heading.properties.accuracyDegrees.minimum, 0);
  assert.ok(heading.properties.deviceOrientation.enum.includes('unknown'));
  assert.ok(heading.properties.activityType.enum.includes('unknown'));
  assert.equal(waypointSchema.properties.engineeringUse.const, 'not-authorized');
  assert.ok(waypointSchema.required.includes('coordinateReferenceSystem'));
  assert.ok(waypointSchema.required.includes('reviewStatus'));
});

test('Shortcuts remains read-only and user-triggered', () => {
  assert.equal(shortcut.request.method, 'GET');
  assert.equal(shortcut.request.body, null);
  assert.equal(shortcut.operatingConstraints.userTriggeredOnly, true);
  assert.equal(shortcut.operatingConstraints.automaticPollingAllowed, false);
  assert.equal(shortcut.operatingConstraints.mutationsAllowed, false);
});
