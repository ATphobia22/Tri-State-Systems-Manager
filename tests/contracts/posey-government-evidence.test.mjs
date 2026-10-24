import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const contractUrl = new URL('../../data/posey-county/government-evidence-boundaries-v1.json', import.meta.url);
const contract = JSON.parse(await readFile(contractUrl, 'utf8'));

test('Posey evidence contract keeps county scope distinct from site approval', () => {
  assert.equal(contract.scope.geoid, '18129');
  assert.equal(contract.scope.aoiApproval, 'NOT_APPROVED');
  assert.match(contract.scope.rule, /does not approve a parcel\/site AOI/i);
});

test('FEMA regulatory NFHL, DNR BAFM, and BLE authority classes cannot collapse', () => {
  assert.ok(contract.authorityClasses.EFFECTIVE_FEMA_NFHL.regulatoryRole.includes('effective FEMA'));
  assert.equal(contract.authorityClasses.INDIANA_DNR_BAFM.regulatoryRole, 'NON_NFIP_REGULATORY');
  assert.equal(contract.authorityClasses.FEMA_BLE.status, 'UNVERIFIED');
  assert.ok(contract.authorityClasses.FEMA_BLE.prohibited.some((value) => /manifest entry/i.test(value)));
});

test('USGS and USACE reports are explicitly reference-only and site-specific', () => {
  const usgs = contract.authorityClasses.USGS_SIR_2016_5119;
  const usace = contract.authorityClasses.USACE_ERDC_CHL_TR_22_4;
  assert.equal(usgs.reachMiles, 3.68);
  assert.equal(usgs.station, 'USGS 03378500');
  assert.equal(usgs.horizontalDatum, 'NAD83');
  assert.ok(usgs.prohibited.some((value) => /transferring calibration/i.test(value)));
  assert.equal(usace.model, 'Adaptive Hydraulics (AdH), 2D shallow-water hydraulics and sediment transport');
  assert.ok(usace.prohibited.some((value) => /reusing study calibration/i.test(value)));
});

test('datum promotion blocks unknown/conflicting semantics and implicit conversion', () => {
  assert.equal(contract.datumGate.missingDatum, 'BLOCK_PROMOTION');
  assert.equal(contract.datumGate.conflictingDatum, 'BLOCK_PROMOTION');
  assert.equal(contract.datumGate.implicitUnitConversion, 'BLOCK_PROMOTION');
  assert.equal(contract.datumGate.stageToElevationInference, 'BLOCK_PROMOTION');
  for (const field of ['sourceVerticalDatum', 'targetVerticalDatum', 'method', 'toolAndVersion', 'areaOfApplicability', 'units', 'validationEvidence', 'reviewerDisposition']) {
    assert.ok(contract.datumGate.requiredForConversion.includes(field), `missing required conversion field: ${field}`);
  }
});

test('acquisition and publication fail closed with complete receipts and atomic promotion', () => {
  assert.deepEqual(contract.acquisitionGate.allowedStates, ['NOT_ACQUIRED', 'ACQUIRED_UNVERIFIED', 'VALIDATED', 'PUBLISHED']);
  for (const field of ['sourceId', 'sourceUrl', 'retrievedAt', 'sourceVersion', 'byteLength', 'sha256', 'horizontalCrs', 'verticalDatum', 'featureCount', 'geometryBounds']) {
    assert.ok(contract.acquisitionGate.requiredReceiptFields.includes(field), `missing receipt field: ${field}`);
  }
  assert.equal(contract.publicationGate.atomic, true);
  assert.equal(contract.publicationGate.failClosed, true);
  assert.equal(contract.publicationGate.noSilentSkips, true);
  assert.equal(contract.publicationGate.requiredStatusForRelease, 'VALIDATED');
  assert.equal(contract.publicationGate.engineeringUseForUnverifiedEvidence, 'NOT_AUTHORIZED');
  assert.match(contract.acquisitionGate.promotionRule, /Partial manifests must not be promoted/);
});
