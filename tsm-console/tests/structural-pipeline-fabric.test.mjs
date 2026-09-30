import test from 'node:test';
import assert from 'node:assert/strict';

const { TSM_STRUCTURAL_PIPELINE_FABRIC, assertStructuralPipelineComplete, getStructuralPipelineLayer } =
  await import('../src/lib/structural-pipeline-fabric.ts');

test('defines the canonical twelve-layer structural pipeline', () => {
  assertStructuralPipelineComplete();
  assert.equal(TSM_STRUCTURAL_PIPELINE_FABRIC.length, 12);
  assert.deepEqual(TSM_STRUCTURAL_PIPELINE_FABRIC.map((layer) => layer.index), [1,2,3,4,5,6,7,8,9,10,11,12]);
});

test('preserves the requested layer semantics', () => {
  assert.equal(getStructuralPipelineLayer(1).name, 'Continuous Terrain-RGB DEM Engine');
  assert.equal(getStructuralPipelineLayer(5).name, 'FEMA NFHL Effective Special Hazard Zones');
  assert.equal(getStructuralPipelineLayer(6).name, 'Indiana DNR Best Available Flood Planes');
  assert.equal(getStructuralPipelineLayer(12).authority, 'PRESENTATION');
});

test('does not pretend presentation/API planes are direct MapLibre data sources', () => {
  assert.equal(getStructuralPipelineLayer(3).mapRenderable, false);
  assert.equal(getStructuralPipelineLayer(7).mapRenderable, false);
  assert.equal(getStructuralPipelineLayer(10).mapRenderable, false);
  assert.equal(getStructuralPipelineLayer(12).mapRenderable, true);
});
