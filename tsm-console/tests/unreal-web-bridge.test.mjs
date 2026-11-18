import test from 'node:test';
import assert from 'node:assert/strict';
import { UNREAL_WEB_BRIDGE, filterUnrealWebBridge } from '../src/lib/unreal-web-bridge.ts';
const allowedBoundaries = new Set(['EDITOR_PIPELINE','NATIVE_RUNTIME','DEVELOPER_TEST','PUBLIC_WEB_ANALOG']);
const allowedStatuses = new Set(['WEB_PRESENTATION','SOURCE_BOUND_PARTIAL','NATIVE_NOT_VERIFIED','TOOLCHAIN_ONLY']);
test('Unreal-to-web bridge has unique source-bound records and no fabricated verification', () => {
  assert.ok(UNREAL_WEB_BRIDGE.length >= 8);
  assert.equal(new Set(UNREAL_WEB_BRIDGE.map(row => row.id)).size, UNREAL_WEB_BRIDGE.length);
  for (const row of UNREAL_WEB_BRIDGE) {
    assert.match(row.id, /^[a-z0-9-]+$/);
    assert.ok(allowedBoundaries.has(row.boundary));
    assert.ok(allowedStatuses.has(row.status));
    assert.equal(row.indexVersion, '5.6');
    assert.match(row.epicReference, /^https:\/\/dev\.epicgames\.com\//);
    assert.match(row.repositoryPath, /^(tsm-console|tsm-native|scripts|packages|data-sources|\.github)\//);
    assert.ok(row.browserRole.length > 20);
    assert.ok(row.nativeRole.length > 20);
    assert.match(row.evidenceCaveat, /\b(no|not|unverified|require|requires|cannot|only)\b/i);
    assert.doesNotMatch(row.browserRole, /runs (unreal|ue5|native engine) in (the )?browser/i);
  }
});
test('search and boundary filters keep classes separate', () => {
  assert.ok(filterUnrealWebBridge('HLOD', 'all').some(x => x.id === 'world-partition-hlod'));
  assert.ok(filterUnrealWebBridge('terrain', 'all').length >= 1);
  assert.ok(filterUnrealWebBridge('', 'NATIVE_RUNTIME').every(x => x.boundary === 'NATIVE_RUNTIME'));
  assert.equal(filterUnrealWebBridge('this-will-never-be-a-module', 'all').length, 0);
});
test('Movie Render Queue and editor modules never imply browser execution', () => {
  const mrq = UNREAL_WEB_BRIDGE.find(x => x.id === 'movie-render-queue');
  const world = UNREAL_WEB_BRIDGE.find(x => x.id === 'world-partition-hlod');
  assert.equal(mrq?.status, 'NATIVE_NOT_VERIFIED');
  assert.equal(world?.boundary, 'EDITOR_PIPELINE');
  assert.match(mrq?.evidenceCaveat ?? '', /Shipping|render/i);
});
