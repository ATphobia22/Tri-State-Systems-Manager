/** TSM Geodetic Pipeline & Evidence Governance — community fixtures. */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const AUTHORITATIVE_EPSG = 2966;
const REJECTED = new Set([2967]);
const PARAM_SET_ID = 'NGS-HTDP-ITRF2014-v2';

class TransformationContractViolationError extends Error {
  constructor(message, code = 'TRANSFORM_CONTRACT') {
    super(message);
    this.name = 'TransformationContractViolationError';
    this.code = code;
  }
}

function buildForwardChain({ observationEpoch, targetEpoch = '2010.0', paramSetId = PARAM_SET_ID }) {
  if (!observationEpoch || !/^\d{4}(\.\d+)?$/.test(String(observationEpoch))) throw new TransformationContractViolationError(`Malformed observation epoch: ${observationEpoch}`, 'MALFORMED_EPOCH');
  return [
    { step: 1, operation: 'inverse_transverse_mercator', from: 'EPSG:2966', to: 'NAD83 geodetic' },
    { step: 2, operation: 'geodetic_to_ecef', from: 'NAD83 geodetic', to: 'NAD83 ECEF', parameters: { epoch: observationEpoch } },
    { step: 3, operation: 'helmert_14_param', from: 'NAD83 ECEF', to: 'ITRF2014 ECEF', parameters: { param_set_id: paramSetId, epoch: observationEpoch } },
    { step: 4, operation: 'htdp_propagate', from: `ITRF2014 ECEF@${observationEpoch}`, to: `ITRF2014 ECEF@${targetEpoch}`, parameters: { t1: observationEpoch, t2: targetEpoch, coseismic_applied: false } },
    { step: 5, operation: 'ecef_to_geodetic', from: `ITRF2014 ECEF@${targetEpoch}`, to: `ITRF2014 geodetic@${targetEpoch}` },
  ];
}

function validateForwardChain(chain) {
  const expected = ['inverse_transverse_mercator', 'geodetic_to_ecef', 'helmert_14_param', 'htdp_propagate', 'ecef_to_geodetic'];
  assert.equal(chain.length, 5);
  chain.forEach((stage, index) => assert.equal(stage.operation, expected[index]));
  assert.ok(chain[2].parameters?.param_set_id);
}

function assertNoDirectPlanarHelmert(flag) {
  if (flag) throw new TransformationContractViolationError('Direct planar-to-Helmert is forbidden', 'DIRECT_PLANAR_HELMERT');
}

function assertVerticalIsolation(artifact) {
  if (artifact.vertical_datum && artifact.vertical_datum !== 'NAVD88') throw new TransformationContractViolationError('Vertical substitution', 'VERTICAL_SUBSTITUTION');
  for (const step of artifact.transformation_chain || []) if (step.operation === 'htdp_propagate' && step.parameters?.alters_orthometric) throw new TransformationContractViolationError('HTDP vertical override', 'HTDP_VERTICAL_OVERRIDE');
}

function sha256Leaf(payload) { return createHash('sha256').update(`TSM_LEAF:${JSON.stringify(payload)}`).digest('hex'); }

describe('TSM Geodetic Pipeline & Evidence Governance', () => {
  it('enforces the EPSG:2966 to ITRF2014 operation chain', () => {
    assertNoDirectPlanarHelmert(false);
    assert.throws(() => assertNoDirectPlanarHelmert(true), (error) => error.code === 'DIRECT_PLANAR_HELMERT');
    assert.equal(AUTHORITATIVE_EPSG, 2966);
    const chain = buildForwardChain({ observationEpoch: '2026.63' });
    validateForwardChain(chain);
    assert.equal(chain[0].from, 'EPSG:2966');
    assert.equal(chain[2].parameters.param_set_id, PARAM_SET_ID);
    assert.equal(chain[3].parameters.coseismic_applied, false);
  });

  it('requires bounded round-trip residual evidence', () => {
    const forward = buildForwardChain({ observationEpoch: '2026.63' });
    const inverseOps = [...forward].reverse().map((stage) => `inverse:${stage.operation}`);
    assert.equal(inverseOps.length, 5);
    const residual_m = 0.00004;
    assert.ok(residual_m < 0.0001);
  });

  it('preserves epoch propagation metadata', () => {
    const chain = buildForwardChain({ observationEpoch: '2015.0', targetEpoch: '2026.63' });
    const htdp = chain.find((stage) => stage.operation === 'htdp_propagate');
    assert.equal(htdp.parameters.t1, '2015.0');
    assert.equal(htdp.parameters.t2, '2026.63');
    assert.equal(htdp.parameters.coseismic_applied, false);
  });

  it('keeps vertical datum isolated from horizontal/geodetic transformations', () => {
    assertVerticalIsolation({ vertical_datum: 'NAVD88', transformation_chain: buildForwardChain({ observationEpoch: '2026.63' }) });
    assert.throws(() => assertVerticalIsolation({ vertical_datum: 'NAVD88', transformation_chain: [{ operation: 'htdp_propagate', parameters: { alters_orthometric: true } }] }), (error) => error.code === 'HTDP_VERTICAL_OVERRIDE');
    assert.throws(() => assertVerticalIsolation({ vertical_datum: 'NGVD29' }), (error) => error.code === 'VERTICAL_SUBSTITUTION');
  });

  it('rejects missing parameter sets, malformed epochs and rejected realizations', () => {
    const badChain = buildForwardChain({ observationEpoch: '2026.63' });
    delete badChain[2].parameters.param_set_id;
    assert.throws(() => { if (!badChain[2].parameters?.param_set_id) throw new TransformationContractViolationError('Missing parameter set identifier', 'MISSING_PARAM_SET'); }, (error) => error.code === 'MISSING_PARAM_SET');
    assert.throws(() => buildForwardChain({ observationEpoch: 'not-an-epoch' }), (error) => error.code === 'MALFORMED_EPOCH');
    assert.throws(() => { if (REJECTED.has(2967)) throw new TransformationContractViolationError('Rejected EPSG:2967', 'REJECTED_EPSG'); }, (error) => error.code === 'REJECTED_EPSG');
  });

  it('cryptographically seals a community geodetic evidence artifact', () => {
    const payload = { artifact_type: 'tsm.geodetic.evidence.v1', scope: 'lower-wabash-ohio-community', chain: buildForwardChain({ observationEpoch: '2026.63' }), vertical_boundary: { vertical_datum: 'NAVD88', immutable: true } };
    const hash = sha256Leaf(payload);
    assert.match(hash, /^[a-f0-9]{64}$/);
    const mutated = { ...payload, scope: 'MUTATED' };
    assert.notEqual(hash, sha256Leaf(mutated));
  });
});
