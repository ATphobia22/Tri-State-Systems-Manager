import assert from 'node:assert/strict';
import test from 'node:test';
import { EvidenceCollector } from '../../packages/evidence-runtime/src/EvidenceCollector.ts';
import type { SolverEvidence, UnsealedSolverEvidence } from '../../packages/contracts/src/SolverEvidence.ts';
import type { ReplayVerification } from '../../packages/contracts/src/ReplayVerification.ts';
import { VerificationEngine } from '../../packages/verification/src/VerificationEngine.ts';

const hash = (value: unknown): string => EvidenceCollector.hashPayload(value);

function validPayload(): UnsealedSolverEvidence {
  return {
    runId: 'run-001',
    solverName: 'MODFLOW-6',
    solverVersion: '6.5.0',
    timestamp: '2026-10-24T10:00:00Z',
    inputManifestHash: hash({ input: 'fixture' }),
    configHash: hash({ timeStepSeconds: 30 }),
    outputArtifactHashes: { head: hash({ cells: [1, 2, 3] }) },
    status: 'VERIFIED',
    executionMetrics: { durationMs: 1250, iterations: 4, massBalanceErrorPct: 0.01 },
    spatialMetadata: { crs: 'EPSG:2966', verticalDatum: 'NAVD88', unit: 'ft' },
  };
}

test('canonical hash sorts nested object keys and is stable', () => {
  assert.equal(hash({ b: 2, a: { z: 1, y: 2 } }), hash({ a: { y: 2, z: 1 }, b: 2 }));
  assert.notEqual(hash({ a: { y: 2, z: 1 }, b: 2 }), hash({ a: { y: 3, z: 1 }, b: 2 }));
});

test('canonical hashing rejects circular and non-finite values', () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.throws(() => hash(circular), /CIRCULAR/);
  assert.throws(() => hash({ value: Number.NaN }), /FINITE/);
  assert.throws(() => hash({ value: undefined }), /UNDEFINED/);
});

test('sealed evidence verifies and is deeply frozen', () => {
  const evidence = EvidenceCollector.sealEvidence(validPayload());
  assert.equal(EvidenceCollector.verifyEvidenceIntegrity(evidence), true);
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(Object.isFrozen(evidence.executionMetrics), true);
  assert.equal(VerificationEngine.validateExecution(evidence).valid, true);
});

test('tampered evidence is rejected', () => {
  const sealed = EvidenceCollector.sealEvidence(validPayload());
  const tampered = { ...sealed, solverVersion: '0.0.0' };
  assert.equal(EvidenceCollector.verifyEvidenceIntegrity(tampered), false);
  assert.equal(VerificationEngine.validateExecution(tampered).valid, false);
});

test('non-VERIFIED status, absent outputs, bad CRS and bad datum fail closed', () => {
  const payload = validPayload();
  const blocked = EvidenceCollector.sealEvidence({
    ...payload,
    status: 'NON_CONVERGENT',
    outputArtifactHashes: {},
    spatialMetadata: { crs: 'not-a-crs', verticalDatum: '', unit: '' },
  });
  const result = VerificationEngine.validateExecution(blocked);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('NON_CONVERGENT')));
  assert.ok(result.errors.some((error) => error.includes('output artifact')));
  assert.ok(result.errors.some((error) => error.includes('Coordinate Reference System')));
  assert.ok(result.errors.some((error) => error.includes('Vertical datum')));
});

test('replay verification fails when tolerances are invalid or differences remain', () => {
  const replay: ReplayVerification = {
    originalRunId: 'run-a',
    replayRunId: 'run-b',
    equivalent: true,
    toleranceThresholds: { maxStageDifferenceFt: 0.01, maxFlowDifferenceCfs: -1 },
    differences: ['stage differed by 0.02 ft'],
    timestamp: '2026-10-24T10:00:00Z',
  };
  const result = VerificationEngine.validateReplay(replay);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Flow difference tolerance')));
  assert.ok(result.errors.some((error) => error.includes('contains differences')));
});
