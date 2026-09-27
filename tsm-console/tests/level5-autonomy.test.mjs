import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function loadModule() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsm-l5-'));
  process.env.TSM_AUTONOMY_DIR = dir;
  process.env.TSM_SESSION_SECRET = 'test-secret-for-level5-autonomy-01234567890123456789';
  const url = new URL('../server/autonomy/level5-orchestrator.mjs', import.meta.url);
  return import(url.href + '?test=' + Math.random());
}

test('Level 5 evaluation is bounded and fail-closed around stale telemetry', async () => {
  const { evaluateLevel5 } = await loadModule();
  const now = Date.now();
  const proposal = evaluateLevel5({
    telemetry: [
      { sensor_id: 's1', metric: 'stage_ft', observed_at: new Date(now - 10_000).toISOString(), value: 4, unit: 'ft', quality: 1 },
      { sensor_id: 's2', metric: 'stage_ft', observed_at: new Date(now - 12_000).toISOString(), value: 6, unit: 'ft', quality: 0.5 },
    ],
    scenario: 'river_stage_rise',
    horizon_hours: 72,
    threshold: 5,
  });
  assert.equal(proposal.schema_version, 'tsm.level5.autonomy.v1');
  assert.equal(proposal.status, 'PENDING_HUMAN_APPROVAL');
  assert.equal(proposal.governance.physical_actuation, 'blocked_by_default');
  assert.equal(proposal.prediction.exceeded, true);
  assert.match(proposal.integrity_sha256, /^[a-f0-9]{64}$/);
  assert.throws(
    () => evaluateLevel5({ telemetry: [{ sensor_id: 'stale', metric: 'stage_ft', observed_at: new Date(now - 86_400_000).toISOString(), value: 4 }] }),
    /No fresh telemetry/,
  );
});

test('approval requires a human reason and execution remains disabled by default', async () => {
  const { evaluateLevel5, approveLevel5Proposal, executeLevel5Proposal } = await loadModule();
  const proposal = evaluateLevel5({
    telemetry: [{ sensor_id: 's1', metric: 'pressure', observed_at: new Date().toISOString(), value: 10, unit: 'psi' }],
    scenario: 'water_main_pressure_drop',
    threshold: 8,
  });
  assert.throws(() => approveLevel5Proposal(proposal.proposal_id, 'operator-1', 'short'), /at least 10/);
  const approval = approveLevel5Proposal(proposal.proposal_id, 'operator-1', 'Reviewed the proposed response and supporting telemetry.');
  assert.equal(approval.status, 'APPROVED');
  await assert.rejects(() => executeLevel5Proposal(proposal.proposal_id, 'reviewer-1'), /Physical execution is disabled/);
});

test('approval is durable and tamper-evident', async () => {
  const { evaluateLevel5, approveLevel5Proposal, listLevel5Proposals } = await loadModule();
  const proposal = evaluateLevel5({ telemetry: [{ sensor_id: 's1', metric: 'stage', observed_at: new Date().toISOString(), value: 4 }] });
  approveLevel5Proposal(proposal.proposal_id, 'operator-1', 'Human review completed against current evidence and safety constraints.');
  const rows = listLevel5Proposals();
  assert.equal(rows[0].proposal_id, proposal.proposal_id);
  assert.match(rows[0].integrity_sha256, /^[a-f0-9]{64}$/);
});
