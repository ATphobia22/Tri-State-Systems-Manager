#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = new URL('../../data/fabrics/fema-ble-depth-layer-v1.json', import.meta.url);
const ble = JSON.parse(await readFile(path, 'utf8'));

assert.equal(ble.layer_id, 'fema_ble_depth_1pct');
assert.equal(ble.status, 'UNAVAILABLE_NOT_INGESTED');
assert.equal(ble.evidence_class, 'ADVISORY_ENGINEERING_MODEL');
assert.equal(ble.regulatory_status, 'NON_REGULATORY');
assert.equal(ble.coverage_verification, 'UNVERIFIED');
assert.equal(ble.missing_coverage_flag, 'EXPLICIT_UNAVAILABLE');
assert.equal(ble.publication_policy.may_appear_in_regulatory_compliance_panel, false);
assert.equal(ble.publication_policy.may_replace_effective_nfhl, false);
assert.equal(ble.publication_policy.may_supply_regulatory_bfe_without_authoritative_bfe_evidence, false);
assert.deepEqual(ble.requested_huc8_coverage, ['05140202', '05120113']);
assert.ok(ble.provenance_requirements.includes('artifact_sha256'));
console.log('PASS FEMA BLE contract: advisory/non-regulatory, explicitly unavailable until coverage and artifact evidence are verified.');
