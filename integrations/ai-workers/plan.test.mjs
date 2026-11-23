import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createWorkerPlan } from './plan.mjs';

async function fixture(run) {
  const parent = await mkdtemp(join(tmpdir(), 'tsm-ai-worker-'));
  const root = join(parent, 'capture');
  await mkdir(root);
  await writeFile(join(root, 'photo.jpg'), Buffer.from('fixture not a measured observation'));
  try { await run(root, parent); }
  finally { await rm(parent, { recursive: true, force: true }); }
}
const request = (workerId = 'synthetic-pbr-prop') => ({
  workerId,
  autonomy: 'S1',
  rightsCleared: true,
  sources: [{ sourceId: 'photo-001', path: 'photo.jpg', declaredSourceClass: 'LOCAL_CAPTURE' }],
});

test('hashes actual source bytes and never claims authoritative geometry or execution', async () => {
  await fixture(async (root) => {
    const plan = await createWorkerPlan(request(), root);
    assert.equal(plan.sources[0].sha256, createHash('sha256')
      .update('fixture not a measured observation').digest('hex'));
    assert.equal(plan.authorityClass, 'DERIVED');
    assert.equal(plan.governanceStatus, 'human_review_required');
    assert.equal(plan.publishable, false);
    assert.equal(plan.executed, false);
    assert.equal(plan.engineeringUseAllowed, false);
    assert.equal(plan.sources[0].independentlyVerified, false);
    assert.ok(plan.blockers.includes('MODEL_RUNTIME_NOT_PROVISIONED_OR_EXECUTED'));
  });
});

test('plans are deterministic across repeated reads of unchanged local input', async () => {
  await fixture(async (root) => {
    const one = await createWorkerPlan(request(), root);
    const two = await createWorkerPlan(request(), root);
    assert.deepEqual(one, two);
    await writeFile(join(root, 'photo.jpg'), 'changed capture');
    const three = await createWorkerPlan(request(), root);
    assert.notEqual(three.planSha256, one.planSha256);
    assert.notEqual(three.sources[0].sha256, one.sources[0].sha256);
  });
});

test('photogrammetry requires spatial reference and independent checkpoints for assessment', async () => {
  await fixture(async (root) => {
    const blocked = await createWorkerPlan(request('photogrammetry-mesh'), root);
    assert.ok(blocked.blockers.includes('GEOREFERENCING_CRS_AND_VERTICAL_DATUM_MISSING'));
    assert.ok(blocked.blockers.includes('INDEPENDENT_CHECKPOINTS_MISSING'));
    const supplied = await createWorkerPlan({
      ...request('photogrammetry-mesh'),
      spatialReference: { crs: 'EPSG:2966', verticalDatum: 'NAVD88' },
      independentCheckpointsAvailable: true,
    }, root);
    assert.ok(!supplied.blockers.includes('GEOREFERENCING_CRS_AND_VERTICAL_DATUM_MISSING'));
    assert.equal(supplied.publishable, false);
    assert.equal(supplied.engineeringUseAllowed, false);
  });
});

test('unverified rights remain an explicit blocker; appearance-only data is never engineering geometry', async () => {
  await fixture(async (root) => {
    const plan = await createWorkerPlan({ ...request('gaussian-appearance'), rightsCleared: false }, root);
    assert.ok(plan.blockers.includes('INPUT_USAGE_RIGHTS_UNVERIFIED'));
    assert.equal(plan.outputKind, 'visual_context');
    assert.equal(plan.engineeringUseAllowed, false);
  });
});

test('rejects traversal, remote paths, and symbolic links escaping source root', async () => {
  await fixture(async (root, parent) => {
    await writeFile(join(parent, 'outside.jpg'), 'outside');
    for (const path of ['../outside.jpg', 'https://example.org/asset.glb']) {
      await assert.rejects(createWorkerPlan({
        ...request(), sources: [{ sourceId: 'escape', path }],
      }, root), /source|ENOENT/);
    }
    await symlink(join(parent, 'outside.jpg'), join(root, 'linked.jpg'));
    await assert.rejects(createWorkerPlan({
      ...request(), sources: [{ sourceId: 'escape', path: 'linked.jpg' }],
    }, root), /escapes/);
  });
});

test('rejects unknown worker, unauthorized autonomy, duplicate IDs and missing source files', async () => {
  await fixture(async (root) => {
    await assert.rejects(createWorkerPlan(request('delete-evidence'), root), /unrecognized/);
    await assert.rejects(createWorkerPlan({ ...request(), autonomy: 'S2' }, root), /S1/);
    const source = request().sources[0];
    await assert.rejects(createWorkerPlan({ ...request(), sources: [source, source] }, root), /duplicate/);
    await assert.rejects(createWorkerPlan({
      ...request(), sources: [{ ...source, path: 'missing.jpg' }],
    }, root), /ENOENT/);
  });
});
