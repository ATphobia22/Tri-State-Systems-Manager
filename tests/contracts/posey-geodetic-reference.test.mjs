import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const policy = JSON.parse(await readFile(new URL('../../data/posey-county/government-evidence-boundaries-v1.json', import.meta.url), 'utf8'));

test('horizontal CRS metadata is independent from vertical datum metadata', () => {
  assert.equal(policy.horizontalDatumGate.missingMetadata, 'BLOCK_PROMOTION');
  assert.equal(policy.horizontalDatumGate.incompatibleReferenceFrame, 'BLOCK_TRANSFORMATION_OR_PROMOTION');
  assert.ok(policy.horizontalDatumGate.requiredMetadata.includes('horizontalCrs'));
  assert.ok(policy.horizontalDatumGate.requiredMetadata.includes('datumOrReferenceFrame'));
  assert.ok(policy.horizontalDatumGate.rules.some((rule) => /does not identify the vertical datum/i.test(rule)));
});

test('ellipsoid, geoid, orthometric, and gage heights cannot be conflated', () => {
  const vertical = policy.verticalHeightGate;
  assert.equal(vertical.heightTypes.ellipsoidalHeight.symbol, 'h');
  assert.equal(vertical.heightTypes.orthometricHeight.symbol, 'H');
  assert.equal(vertical.heightTypes.geoidHeight.symbol, 'N');
  assert.equal(vertical.relationship.officialForm, 'h = H + N');
  assert.equal(vertical.relationship.derivedForm, 'H ≈ h - N');
  assert.equal(vertical.stageToElevationInference, 'BLOCK_PROMOTION');
  assert.ok(vertical.geoidModelCompatibility.incompatibleInputs.some((value) => /WGS 84/i.test(value)));
  for (const field of ['sourceHeightType', 'targetVerticalDatum', 'geoidOrDatumTransformationModel', 'modelAndSoftwareVersion', 'inputAndOutputUncertainty', 'validationAgainstIndependentControl']) {
    assert.ok(vertical.requiredForConversion.includes(field), `missing conversion evidence: ${field}`);
  }
});

test('modernized NSRS beta status is not confused with production adoption', () => {
  const modernization = policy.datumModernizationGate;
  assert.equal(modernization.productionAdoption, 'NOT_ASSUMED');
  assert.match(modernization.observedStatusFromOfficialPage.NAPGD2022, /BETA_PUBLIC_FEEDBACK_PERIOD_COMPLETE/);
  assert.match(modernization.observedStatusFromOfficialPage.NATRF2022, /BETA_PUBLIC_FEEDBACK_PERIOD_COMPLETE/);
  assert.match(modernization.observedStatusFromOfficialPage.NCATBeta2, /PENDING_FOR_BETA_RELEASE/);
});

test('TopoView and US Topo products remain contextual map sources, not acquired DEMs', () => {
  const byId = new Map(policy.topographicReferenceSources.map((source) => [source.id, source]));
  const topoview = byId.get('usgs-topoview');
  const usTopo = byId.get('usgs-us-topo-map-collection');
  assert.ok(topoview);
  assert.ok(usTopo);
  assert.equal(topoview.evidenceStatus, 'AVAILABLE_FOR_DISCOVERY_NOT_ACQUIRED');
  assert.equal(usTopo.evidenceStatus, 'AVAILABLE_FOR_DISCOVERY_NOT_ACQUIRED');
  assert.equal(usTopo.role, 'CARTOGRAPHIC_REFERENCE_NOT_TERRAIN_MODEL');
  assert.equal(usTopo.metadataLastUpdated, '2025-03-11');
  assert.equal(usTopo.dataLastModified, '2025-02-14');
  assert.ok(usTopo.prohibitedUse.some((value) => /terrain rasters/i.test(value)));
});

test('AOI remains unapproved despite geodetic and topo reference additions', () => {
  assert.equal(policy.scope.aoiApproval, 'NOT_APPROVED');
  assert.equal(policy.publicationGate.engineeringUseForUnverifiedEvidence, 'NOT_AUTHORIZED');
});
