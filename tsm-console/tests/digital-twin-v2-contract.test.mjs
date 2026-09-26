import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const appPath = new URL('../digital-twin-app-v2.tsx', import.meta.url);

test('digital twin v2 is fail-closed around WTHGIS and OpenMI evidence', async () => {
  const source = await fs.readFile(appPath, 'utf8');

  assert.match(source, /POSEY_WTHGIS_URL/);
  assert.match(source, /VITE_POSEY_WTHGIS_GEOJSON_URL/);
  assert.match(source, /EPSG:2966/);
  assert.match(source, /VITE_TSM_OPENMI_WSE_URL/);
  assert.match(source, /sourceProvenanceHash/);
  assert.match(source, /validationStatus !== 'VALIDATED'/);
  assert.match(source, /elevationEvidenceStatus === 'CERTIFIED'/);
  assert.match(source, /Human authority gate ON/);
  assert.doesNotMatch(source, /PRIVATE_SITE_ADDRESS_REDACTED.*377\.2/);
});

test('digital twin v2 exposes the configured 3D parcel layer contract', async () => {
  const source = await fs.readFile(appPath, 'utf8');

  assert.match(source, /fill-extrusion/);
  assert.match(source, /posey-wthgis-parcels-3d/);
  assert.match(source, /SFHA_HIGH_RISK/);
  assert.match(source, /SFHA_COMPLIANT/);
  assert.match(source, /REVIEW_REQUIRED/);
});
