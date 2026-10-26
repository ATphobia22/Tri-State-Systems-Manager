import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { compressHlod, enumerateStitchedContents, inspectGlb, safeGlbUri, sha256 } from './compress-hlod-meshopt.mjs';

const CLI = path.resolve('tsm-console/node_modules/.bin/gltf-transform');

function buildTriangleGlb() {
  const pos = Buffer.alloc(36);
  [0, 0, 0, 10, 0, 0, 0, 10, 0].forEach((value, i) => pos.writeFloatLE(value, i * 4));
  const idx = Buffer.alloc(8);
  [0, 1, 2].forEach((value, i) => idx.writeUInt16LE(value, i * 2));
  const buffer = Buffer.concat([pos, idx]);
  const doc = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 44 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [10, 10, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  let json = Buffer.from(JSON.stringify(doc), 'utf8');
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.write('glTF', 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + buffer.length, 8);
  const jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binHeader.writeUInt32LE(buffer.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, buffer]);
}

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tsm-meshopt-test-'));
  const input = path.join(root, 'source'), output = path.join(root, 'compressed');
  await mkdir(path.join(input, 'stitched'), { recursive: true });
  await writeFile(path.join(input, 'stitched/part01.glb'), buildTriangleGlb());
  const tileset = {
    asset: { version: '1.1' },
    extras: { tsm: { sourceObjectIdsRetained: true } },
    root: {
      boundingVolume: { box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] },
      geometricError: 0,
      refine: 'REPLACE',
      content: { uri: 'stitched/part01.glb' },
      extras: { tsm: { sourceObjectIds: [10, 20] } },
    },
  };
  const manifest = {
    authorityClass: 'DERIVED', engineeringUse: false, regulatoryUse: false,
    stitchedSourceObjectIds: [10, 20],
  };
  await writeFile(path.join(input, 'tileset.json'), JSON.stringify(tileset));
  await writeFile(path.join(input, 'manifest.json'), JSON.stringify(manifest));
  return { root, input, output };
}

test('reject unsafe or duplicate content names before codec invocation', () => {
  assert.throws(() => safeGlbUri('../../secret.glb'), /unsafe/);
  assert.throws(() => safeGlbUri('stitched/../secret.glb'), /traversal/);
  assert.throws(() => safeGlbUri('https://example.org/glb'), /unsafe/);
  assert.deepEqual(enumerateStitchedContents({ root: { content: { uri: 'stitched/a.glb' } } }), ['stitched/a.glb']);
  assert.throws(() => enumerateStitchedContents({ root: {
    content: { uri: 'stitched/a.glb' },
    children: [{ content: { uri: 'stitched/a.glb' } }],
  } }), /Repeated/);
});

test('real local glTF Transform creates streamable meshopt GLB and immutable evidence receipt', async () => {
  const f = await makeFixture();
  try {
    const sourcePath = path.join(f.input, 'stitched/part01.glb');
    const sourceSha = await sha256(sourcePath);
    const { report, receiptPath } = await compressHlod({ inputDir: f.input, outputDir: f.output, cli: CLI });
    const compressed = path.join(f.output, 'stitched/part01-meshopt.glb');
    const glb = await inspectGlb(compressed);
    assert.ok(glb.extensionsRequired.includes('EXT_meshopt_compression'));
    assert.equal(report.compressedGlbCount, 1);
    assert.equal(report.sourceGlbCount, 1);
    assert.equal(report.geometricExactnessGuaranteed, false);
    assert.equal(report.entries[0].sourceSha256, sourceSha);
    assert.equal(await sha256(sourcePath), sourceSha);
    assert.equal(report.entries[0].outputSha256, await sha256(compressed));
    const tileset = JSON.parse(await readFile(path.join(f.output, 'tileset.json'), 'utf8'));
    assert.equal(tileset.root.content.uri, 'stitched/part01-meshopt.glb');
    assert.deepEqual(tileset.root.extras.tsm.sourceObjectIds, [10, 20]);
    assert.equal(tileset.extras.tsm.decoderCompatibilityVerified, false);
    const names = (await readFile(path.join(f.output, 'SHA256SUMS'), 'utf8'))
      .trim().split('\n').map((l) => l.split('  ')[1]).sort();
    assert.deepEqual(names, ['manifest.json', 'stitched/part01-meshopt.glb', 'tileset.json']);
    assert.equal(JSON.parse(await readFile(receiptPath, 'utf8')).sourceManifestSha256,
      await sha256(path.join(f.input, 'manifest.json')));
    assert.equal((await stat(compressed)).size > 0, true);
    await assert.rejects(() => compressHlod({ inputDir: f.input, outputDir: f.output, cli: CLI }),
      /not empty/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('rejects false authoritative claims without writing compressed content', async () => {
  const f = await makeFixture();
  try {
    const file = path.join(f.input, 'manifest.json');
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    manifest.regulatoryUse = true;
    await writeFile(file, JSON.stringify(manifest));
    await assert.rejects(() => compressHlod({ inputDir: f.input, outputDir: f.output, cli: CLI }),
      /non-regulatory DERIVED/);
    await assert.rejects(() => readdir(f.output), { code: 'ENOENT' });
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
