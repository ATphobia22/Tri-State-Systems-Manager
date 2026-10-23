import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  makeAnalyticHeightGrid,
  planTransvoxelStitch,
  runRepresentativeAreaStitch,
  discoverLodBoundaryEdges,
} from '../src/gpu/transvoxel-stitch.ts';

test('analytic grids at same LOD share a seamless boundary', () => {
  const extent = 100;
  const gA = makeAnalyticHeightGrid(0, 0, extent, 17, 'NAVD88', 'local-ENU-approx');
  const gB = makeAnalyticHeightGrid(extent, 0, extent, 17, 'NAVD88', 'local-ENU-approx');
  const tiles = [
    { id: 'a', lod: 0, originEastM: 0, originNorthM: 0, extentM: extent, grid: gA },
    { id: 'b', lod: 0, originEastM: extent, originNorthM: 0, extentM: extent, grid: gB },
  ];
  const edges = discoverLodBoundaryEdges(tiles);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].axis, 'east-west');
  const plan = planTransvoxelStitch(tiles, 0.05, 64);
  assert.equal(plan.allSeamsPass, true);
  assert.equal(plan.authority, 'PRESENTATION_ONLY');
});

test('checkerboard LOD representative AOI run measures seams', () => {
  const run = runRepresentativeAreaStitch({
    aoiId: 'posey-bonebank-13101',
    originEastM: -200,
    originNorthM: -200,
    tileExtentM: 100,
    gridTiles: 2,
    fineLod: 0,
    coarseLod: 1,
    fineRes: 33,
    coarseRes: 17,
    toleranceM: 0.5,
    verticalDatum: 'NAVD88',
    horizontalCrs: 'local-ENU-approx',
  });
  assert.equal(run.tiles, 4);
  assert.ok(run.edgesChecked >= 2);
  assert.ok(run.elapsedMs >= 0);
  assert.equal(run.verticalDatum, 'NAVD88');
  assert.ok(run.maxSeamDeltaM < 1.0, `maxSeamDeltaM=${run.maxSeamDeltaM}`);
  assert.equal(run.allSeamsPass, true);
});

test('empty tile list refused', () => {
  assert.throws(() => planTransvoxelStitch([]));
});
