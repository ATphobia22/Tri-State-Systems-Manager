import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readGlbJson, validateSupportedGlb, extractBatchMesh, findGlbFiles } from './build-meshlet-batch.mjs';

function makeGlb({ primitiveMode = 4, nodeTranslation = null, nodeMatrix = null, secondPrimitive = false } = {}) {
  const positionBytes = Buffer.alloc(36);
  const positions = [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ];
  positions.forEach((value, index) => positionBytes.writeFloatLE(value, index * 4));
  const indexBytes = Buffer.alloc(8);
  indexBytes.writeUInt16LE(0, 0);
  indexBytes.writeUInt16LE(1, 2);
  indexBytes.writeUInt16LE(2, 4);
  const bin = Buffer.concat([positionBytes, indexBytes]);
  const json = {
    asset: { version: '2.0', generator: 'TSM meshlet contract fixture' },
    buffers: [{ byteLength: 42 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    meshes: [{
      primitives: [
        { attributes: { POSITION: 0 }, indices: 1, mode: primitiveMode },
        ...(secondPrimitive ? [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] : []),
      ],
    }],
    nodes: [{ mesh: 0, ...(nodeTranslation ? { translation: nodeTranslation } : {}), ...(nodeMatrix ? { matrix: nodeMatrix } : {}) }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  let jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);
  const binPadding = (4 - (bin.length % 4)) % 4;
  const paddedBin = Buffer.concat([bin, Buffer.alloc(binPadding)]);
  const totalLength = 12 + 8 + jsonBytes.length + 8 + paddedBin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonBytes, binHeader, paddedBin]);
}

test('reads a GLB 2.0 and validates one supported triangle primitive', () => {
  const buffer = makeGlb();
  const decoded = readGlbJson(buffer);
  assert.equal(decoded.json.asset.version, '2.0');
  assert.equal(decoded.binByteLength, 44);
  assert.deepEqual(validateSupportedGlb(decoded, decoded.binByteLength), {
    primitiveCount: 1,
    accessorVertexCount: 3,
    meshCount: 1,
  });
  const mesh = extractBatchMesh(decoded.json, decoded.binChunk);
  assert.equal(mesh.vertexCount, 3);
  assert.equal(mesh.triangleCount, 1);
  assert.deepEqual(Array.from(mesh.indices), [0, 1, 2]);
});

test('rejects truncated, non-GLB, and inconsistent-length containers', () => {
  assert.throws(() => readGlbJson(Buffer.alloc(8)), /GLB too small/);
  assert.throws(() => readGlbJson(Buffer.concat([Buffer.from('this is definitely not a GLB file'), Buffer.alloc(8)])), /not a GLB file/);
  const valid = makeGlb();
  const invalidLength = Buffer.from(valid);
  invalidLength.writeUInt32LE(valid.length - 4, 8);
  assert.throws(() => readGlbJson(invalidLength), /declared length does not match/);
});

test('rejects unsupported primitives but flattens multiple primitives and applies node transforms', () => {
  const unsupportedMode = readGlbJson(makeGlb({ primitiveMode: 1 }));
  assert.throws(
    () => validateSupportedGlb(unsupportedMode, unsupportedMode.binByteLength),
    /only TRIANGLES/,
  );

  const multiplePrimitives = readGlbJson(makeGlb({ secondPrimitive: true }));
  const multiContract = validateSupportedGlb(multiplePrimitives, multiplePrimitives.binByteLength);
  assert.equal(multiContract.primitiveCount, 2);
  const multi = extractBatchMesh(multiplePrimitives.json, multiplePrimitives.binChunk);
  assert.equal(multi.vertexCount, 6);
  assert.equal(multi.triangleCount, 2);
  assert.equal(multi.primitiveGroups.length, 2);
  assert.deepEqual(Array.from(multi.indices), [0, 1, 2, 3, 4, 5]);

  const translated = readGlbJson(makeGlb({ nodeTranslation: [10, 0, 0] }));
  validateSupportedGlb(translated, translated.binByteLength);
  const moved = extractBatchMesh(translated.json, translated.binChunk);
  assert.equal(moved.positions[0], 10);
  assert.equal(moved.positions[3], 11);
  assert.equal(moved.positions[7], 1);

  const identityExceptTranslation = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1];
  const matrix = readGlbJson(makeGlb({ nodeMatrix: identityExceptTranslation }));
  validateSupportedGlb(matrix, matrix.binByteLength);
  assert.equal(extractBatchMesh(matrix.json, matrix.binChunk).positions[0], 10);
});

test('discovers GLBs deterministically, case-insensitively, and skips symlinks', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tsm-glb-inventory-'));
  try {
    await mkdir(path.join(root, 'nested'));
    await writeFile(path.join(root, 'b.GLB'), 'b');
    await writeFile(path.join(root, 'nested', 'a.glb'), 'a');
    await writeFile(path.join(root, 'nested', 'ignore.gltf'), 'text');
    await symlink(path.join(root, 'b.GLB'), path.join(root, 'alias.glb'));
    const files = await findGlbFiles(root);
    assert.deepEqual(files.map((file) => path.relative(root, file).split(path.sep).join('/')), [
      'b.GLB',
      'nested/a.glb',
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
