import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/lib/cesium-regional-scene.ts', import.meta.url), 'utf8');

test('source-cell screening imagery keeps hard pixel edges rather than interpolating alpha', () => {
  assert.match(scene, /minificationFilter: TextureMinificationFilter\.NEAREST/);
  assert.match(scene, /magnificationFilter: TextureMagnificationFilter\.NEAREST/);
  assert.match(scene, /new ImageryLayer\(provider,\s*\{[^}]*minificationFilter:[^}]*magnificationFilter:/s,
    'Filtering options belong to ImageryLayer constructor, not ImageryLayerCollection.addImageryProvider');
  assert.match(scene, /widget\.imageryLayers\.add\(layer\);\s*screening = layer;/,
    'Collection.add returns void; retain the constructed imagery layer for teardown');
});
