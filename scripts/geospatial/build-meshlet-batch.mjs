#!/usr/bin/env node
/**
 * Deterministic offline meshlet candidate bake for all checked-in TSM GLBs.
 *
 * It deliberately reuses the TSM greedy builder, validates that each GLB fits
 * its current parser contract, writes gzip-compressed MeshletPack JSON files,
 * and emits an input/output SHA-256 manifest. Unsupported inputs fail closed.
 * Packs are SIMULATION_DEMO artifacts, not engineering or regulatory evidence.
 */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readdir, readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_INPUT = path.join(ROOT, 'tsm-console/public/3d-tiles');
const OUTPUT_SCHEMA = 'tsm.meshlet-batch-manifest.v1';
const MESHLET_MAX_VERTICES = 64;
const MESHLET_MAX_TRIANGLES = 124;
const GLB_MAGIC = 0x46546c67;
const GLB_JSON = 0x4e4f534a;
const GLB_BIN = 0x004e4942;

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function fail(message) {
  throw new Error(message);
}

export function readGlbJson(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  if (buffer.byteLength < 20) fail('GLB too small');
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) fail('not a GLB file');
  if (buffer.readUInt32LE(4) !== 2) fail('only GLB 2.0 is supported');
  if (buffer.readUInt32LE(8) !== buffer.byteLength) fail('GLB declared length does not match file length');

  let offset = 12;
  let json = null;
  let jsonChunks = 0;
  let binChunks = 0;
  let binByteLength = 0;
  let binChunk = null;
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) fail('truncated GLB chunk header');
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkLength > buffer.byteLength - offset) fail('GLB chunk exceeds file boundary');
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === GLB_JSON) {
      jsonChunks += 1;
      if (jsonChunks > 1) fail('GLB contains more than one JSON chunk');
      json = JSON.parse(chunk.toString('utf8').replace(/\0+$/u, '').trim());
    } else if (chunkType === GLB_BIN) {
      binChunks += 1;
      binByteLength = chunkLength;
      binChunk = chunk;
    }
  }
  if (offset !== buffer.byteLength) fail('GLB chunk cursor did not end at file boundary');
  if (!json) fail('GLB JSON chunk is missing');
  if (binChunks !== 1) fail('exactly one embedded GLB BIN chunk is required');
  return { json, binByteLength, binChunk };
}

function validateAccessor(json, index, expectedType, allowedComponentTypes, binByteLength, label) {
  const accessors = json.accessors;
  const views = json.bufferViews;
  if (!Array.isArray(accessors) || !Number.isInteger(index) || index < 0 || index >= accessors.length) {
    fail(label + ' accessor index is invalid');
  }
  const accessor = accessors[index];
  if (!accessor || accessor.type !== expectedType) fail(label + ' accessor type must be ' + expectedType);
  if (!allowedComponentTypes.includes(accessor.componentType)) fail(label + ' has unsupported componentType');
  if (!Number.isInteger(accessor.count) || accessor.count <= 0) fail(label + ' accessor count is invalid');
  if (accessor.sparse) fail(label + ' sparse accessors are not supported');
  if (accessor.normalized === true) fail(label + ' normalized accessors are not supported');
  if (!Number.isInteger(accessor.bufferView) || accessor.bufferView < 0 || accessor.bufferView >= views.length) {
    fail(label + ' bufferView index is invalid');
  }
  const view = views[accessor.bufferView];
  if ((view.buffer ?? 0) !== 0) fail(label + ' must reference the embedded GLB buffer');
  const byteOffset = Number.isInteger(view.byteOffset) ? view.byteOffset : 0;
  const accessorOffset = Number.isInteger(accessor.byteOffset) ? accessor.byteOffset : 0;
  const componentBytes = accessor.componentType === 5126 || accessor.componentType === 5125 ? 4
    : accessor.componentType === 5123 ? 2 : 1;
  const components = expectedType === 'VEC3' ? 3 : 1;
  const elementBytes = componentBytes * components;
  if (view.byteStride != null && view.byteStride !== elementBytes) {
    fail(label + ' interleaved/non-tightly-packed data is unsupported by this batch version');
  }
  if (accessorOffset % componentBytes !== 0 || (byteOffset + accessorOffset) % componentBytes !== 0) {
    fail(label + ' accessor byte alignment is invalid');
  }
  const byteLength = Number.isInteger(view.byteLength) ? view.byteLength : -1;
  const needed = accessorOffset + accessor.count * elementBytes;
  if (byteLength < 0 || needed > byteLength) fail(label + ' accessor exceeds its bufferView');
  if (byteOffset + needed > binByteLength) fail(label + ' accessor exceeds the embedded BIN chunk');
  return accessor;
}

function validateNodeTransform(node, index) {
  const hasMatrix = node.matrix != null;
  const hasTrs = node.translation != null || node.rotation != null || node.scale != null;
  if (hasMatrix && hasTrs) fail('node ' + index + ' must not combine matrix and TRS transforms');
  if (hasMatrix && (!Array.isArray(node.matrix) || node.matrix.length !== 16 || !node.matrix.every(Number.isFinite))) {
    fail('node ' + index + ' matrix must contain 16 finite values');
  }
  if (node.translation != null && (!Array.isArray(node.translation) || node.translation.length !== 3 || !node.translation.every(Number.isFinite))) {
    fail('node ' + index + ' translation must contain three finite values');
  }
  if (node.rotation != null && (!Array.isArray(node.rotation) || node.rotation.length !== 4 || !node.rotation.every(Number.isFinite))) {
    fail('node ' + index + ' rotation must contain four finite values');
  }
  if (node.scale != null && (!Array.isArray(node.scale) || node.scale.length !== 3 || !node.scale.every(Number.isFinite))) {
    fail('node ' + index + ' scale must contain three finite values');
  }
}

export function validateSupportedGlb(glb, binByteLength) {
  const json = glb?.json ?? glb;
  if (!json || json.asset?.version !== '2.0') fail('asset.version must be 2.0');
  if (!Array.isArray(json.buffers) || json.buffers.length !== 1 || json.buffers[0]?.uri) {
    fail('GLB must have exactly one embedded buffer and no external URI');
  }
  if (json.buffers[0].byteLength > binByteLength) fail('GLB buffer length exceeds embedded BIN chunk');
  if (!Array.isArray(json.meshes) || json.meshes.length === 0) fail('GLB has no meshes');
  if ((json.skins?.length ?? 0) > 0 || (json.animations?.length ?? 0) > 0) {
    fail('skinned or animated geometry is unsupported');
  }

  let primitiveCount = 0;
  let accessorVertexCount = 0;
  for (let meshIndex = 0; meshIndex < json.meshes.length; meshIndex++) {
    const mesh = json.meshes[meshIndex];
    if (!Array.isArray(mesh.primitives) || mesh.primitives.length === 0) {
      fail('mesh ' + meshIndex + ' contains no primitives');
    }
    for (let primitiveIndex = 0; primitiveIndex < mesh.primitives.length; primitiveIndex++) {
      const primitive = mesh.primitives[primitiveIndex];
      const label = 'mesh ' + meshIndex + ' primitive ' + primitiveIndex;
      if ((primitive.mode ?? 4) !== 4) fail(label + ': only TRIANGLES primitive mode is supported');
      if (Array.isArray(primitive.targets) && primitive.targets.length) fail(label + ': morph targets are unsupported');
      if (primitive.extensions?.KHR_draco_mesh_compression || primitive.extensions?.EXT_meshopt_compression) {
        fail(label + ': compressed mesh geometry is unsupported');
      }
      const attributes = primitive.attributes;
      if (!attributes || !Number.isInteger(attributes.POSITION)) fail(label + ': POSITION attribute is missing');
      const position = validateAccessor(json, attributes.POSITION, 'VEC3', [5126], binByteLength, label + ' POSITION');
      if (position.count < 3) fail(label + ': POSITION must contain at least three vertices');
      accessorVertexCount += position.count;
      if (primitive.indices != null) {
        const indices = validateAccessor(json, primitive.indices, 'SCALAR', [5121, 5123, 5125], binByteLength, label + ' indices');
        if (indices.count % 3 !== 0) fail(label + ': index accessor must contain complete triangles');
      } else if (position.count % 3 !== 0) {
        fail(label + ': non-indexed POSITION accessor must contain complete triangles');
      }
      if (attributes.NORMAL != null) {
        const normal = validateAccessor(json, attributes.NORMAL, 'VEC3', [5126], binByteLength, label + ' NORMAL');
        if (normal.count !== position.count) fail(label + ': NORMAL and POSITION counts do not match');
      }
      primitiveCount += 1;
    }
  }

  if (Array.isArray(json.nodes)) {
    for (let nodeIndex = 0; nodeIndex < json.nodes.length; nodeIndex++) {
      const node = json.nodes[nodeIndex];
      validateNodeTransform(node, nodeIndex);
      if (node.mesh != null && (!Number.isInteger(node.mesh) || node.mesh < 0 || node.mesh >= json.meshes.length)) {
        fail('node ' + nodeIndex + ' references an invalid mesh');
      }
      if (node.children != null && (!Array.isArray(node.children) || node.children.some((child) =>
        !Number.isInteger(child) || child < 0 || child >= json.nodes.length))) {
        fail('node ' + nodeIndex + ' contains an invalid child reference');
      }
    }
  }
  if (Array.isArray(json.scenes)) {
    for (let sceneIndex = 0; sceneIndex < json.scenes.length; sceneIndex++) {
      const roots = json.scenes[sceneIndex]?.nodes ?? [];
      if (!Array.isArray(roots) || roots.some((node) => !Number.isInteger(node) || node < 0 || node >= (json.nodes?.length ?? 0))) {
        fail('scene ' + sceneIndex + ' contains an invalid root node');
      }
    }
    if (json.scene != null && (!Number.isInteger(json.scene) || json.scene < 0 || json.scene >= json.scenes.length)) {
      fail('default scene index is invalid');
    }
  }
  return { primitiveCount, accessorVertexCount, meshCount: json.meshes.length };
}

function identityMatrix() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiplyMatrices(a, b) {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return out;
}

function composeNodeMatrix(node) {
  if (node.matrix != null) return [...node.matrix];
  const t = node.translation ?? [0, 0, 0];
  const q = node.rotation ?? [0, 0, 0, 1];
  const s = node.scale ?? [1, 1, 1];
  const qLength = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!Number.isFinite(qLength) || qLength < 1e-12) fail('node rotation quaternion is degenerate');
  const x = q[0] / qLength, y = q[1] / qLength, z = q[2] / qLength, w = q[3] / qLength;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * s[0], (2 * (xy + wz)) * s[0], (2 * (xz - wy)) * s[0], 0,
    (2 * (xy - wz)) * s[1], (1 - 2 * (xx + zz)) * s[1], (2 * (yz + wx)) * s[1], 0,
    (2 * (xz + wy)) * s[2], (2 * (yz - wx)) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function transformPoint(matrix, x, y, z) {
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) fail('node transform produced an invalid homogeneous coordinate');
  const inverseW = 1 / w;
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) * inverseW,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) * inverseW,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) * inverseW,
  ];
}

function readVec3Accessor(json, binChunk, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const viewOffset = Number.isInteger(view.byteOffset) ? view.byteOffset : 0;
  const accessorOffset = Number.isInteger(accessor.byteOffset) ? accessor.byteOffset : 0;
  const start = viewOffset + accessorOffset;
  const result = new Float64Array(accessor.count * 3);
  for (let i = 0; i < accessor.count; i++) {
    const offset = start + i * 12;
    result[i * 3] = binChunk.readFloatLE(offset);
    result[i * 3 + 1] = binChunk.readFloatLE(offset + 4);
    result[i * 3 + 2] = binChunk.readFloatLE(offset + 8);
  }
  return result;
}

function readIndexAccessor(json, binChunk, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const viewOffset = Number.isInteger(view.byteOffset) ? view.byteOffset : 0;
  const accessorOffset = Number.isInteger(accessor.byteOffset) ? accessor.byteOffset : 0;
  const start = viewOffset + accessorOffset;
  const result = new Uint32Array(accessor.count);
  for (let i = 0; i < accessor.count; i++) {
    const offset = start + i * (accessor.componentType === 5125 ? 4 : accessor.componentType === 5123 ? 2 : 1);
    result[i] = accessor.componentType === 5125 ? binChunk.readUInt32LE(offset)
      : accessor.componentType === 5123 ? binChunk.readUInt16LE(offset)
        : binChunk.readUInt8(offset);
  }
  return result;
}

function transformNormal(matrix, x, y, z) {
  const a = matrix[0], b = matrix[4], c = matrix[8];
  const d = matrix[1], e = matrix[5], f = matrix[9];
  const g = matrix[2], h = matrix[6], i = matrix[10];
  const A = e * i - f * h, B = c * h - b * i, C = b * f - c * e;
  const D = f * g - d * i, E = a * i - c * g, F = c * d - a * f;
  const G = d * h - e * g, H = b * g - a * h, I = a * e - b * d;
  const determinant = a * A + b * D + c * G;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-15) fail('node transform has a singular normal matrix');
  const inverse = 1 / determinant;
  const nx = (A * x + D * y + G * z) * inverse;
  const ny = (B * x + E * y + H * z) * inverse;
  const nz = (C * x + F * y + I * z) * inverse;
  const length = Math.hypot(nx, ny, nz);
  if (!Number.isFinite(length) || length < 1e-15) return [0, 0, 0];
  return [nx / length, ny / length, nz / length];
}

export function extractBatchMesh(json, binChunk) {
  if (!Buffer.isBuffer(binChunk)) binChunk = Buffer.from(binChunk);
  const meshes = json.meshes;
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const sourceInstances = [];
  if (nodes.length > 0) {
    const roots = Array.isArray(json.scenes) && json.scenes.length > 0
      ? (json.scenes[json.scene ?? 0]?.nodes ?? [])
      : nodes.map((_, index) => index).filter((index) => !nodes.some((node) => (node.children ?? []).includes(index)));
    const active = new Set();
    const visit = (nodeIndex, parentMatrix) => {
      if (active.has(nodeIndex)) fail('node hierarchy contains a cycle at node ' + nodeIndex);
      const node = nodes[nodeIndex];
      if (!node) fail('node hierarchy references a missing node');
      active.add(nodeIndex);
      const worldMatrix = multiplyMatrices(parentMatrix, composeNodeMatrix(node));
      if (node.mesh != null) sourceInstances.push({ nodeIndex, meshIndex: node.mesh, worldMatrix });
      for (const child of node.children ?? []) visit(child, worldMatrix);
      active.delete(nodeIndex);
    };
    for (const root of roots) visit(root, identityMatrix());
    const usedMeshIndices = new Set(sourceInstances.map((instance) => instance.meshIndex));
    if (meshes.some((_, index) => !usedMeshIndices.has(index))) {
      fail('one or more GLB meshes are not reachable from the selected scene; refusing to omit scene geometry');
    }
  } else {
    meshes.forEach((_, meshIndex) => sourceInstances.push({ nodeIndex: null, meshIndex, worldMatrix: identityMatrix() }));
  }
  if (sourceInstances.length === 0) fail('selected GLB scene contains no mesh instances');

  const positions = [];
  const indices = [];
  const normals = [];
  const groups = [];
  let allPrimitivesHaveNormals = true;
  for (const instance of sourceInstances) {
    const mesh = meshes[instance.meshIndex];
    for (let primitiveIndex = 0; primitiveIndex < mesh.primitives.length; primitiveIndex++) {
      const primitive = mesh.primitives[primitiveIndex];
      const label = 'mesh ' + instance.meshIndex + ' primitive ' + primitiveIndex;
      const positionAccessor = json.accessors[primitive.attributes.POSITION];
      const localPositions = readVec3Accessor(json, binChunk, primitive.attributes.POSITION);
      const vertexOffset = positions.length / 3;
      for (let index = 0; index < localPositions.length; index += 3) {
        positions.push(...transformPoint(instance.worldMatrix, localPositions[index], localPositions[index + 1], localPositions[index + 2]));
      }
      let localIndices;
      if (primitive.indices != null) {
        localIndices = readIndexAccessor(json, binChunk, primitive.indices);
      } else {
        localIndices = Uint32Array.from({ length: positionAccessor.count }, (_, index) => index);
      }
      for (const localIndex of localIndices) {
        if (localIndex >= positionAccessor.count) fail(label + ' index references a vertex outside POSITION');
        indices.push(vertexOffset + localIndex);
      }
      if (primitive.attributes.NORMAL != null) {
        const localNormals = readVec3Accessor(json, binChunk, primitive.attributes.NORMAL);
        for (let index = 0; index < localNormals.length; index += 3) {
          normals.push(...transformNormal(instance.worldMatrix, localNormals[index], localNormals[index + 1], localNormals[index + 2]));
        }
      } else {
        allPrimitivesHaveNormals = false;
      }
      groups.push({
        nodeIndex: instance.nodeIndex,
        meshIndex: instance.meshIndex,
        primitiveIndex,
        materialIndex: Number.isInteger(primitive.material) ? primitive.material : null,
        firstTriangle: (indices.length - localIndices.length) / 3,
        triangleCount: localIndices.length / 3,
      });
    }
  }
  if (indices.length === 0 || indices.length % 3 !== 0) fail('flattened mesh contains no complete triangles');
  return {
    positions: Float32Array.from(positions),
    indices: Uint32Array.from(indices),
    normals: allPrimitivesHaveNormals ? Float32Array.from(normals) : undefined,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    primitiveCount: groups.length,
    primitiveGroups: groups,
  };
}

export async function findGlbFiles(inputRoot) {
  const root = path.resolve(inputRoot);
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.glb') files.push(fullPath);
    }
  }
  await visit(root);
  return files.sort((left, right) => path.relative(root, left).split(path.sep).join('/').localeCompare(
    path.relative(root, right).split(path.sep).join('/'), 'en',
  ));
}

function getArgument(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(name + ' requires a value');
  return value;
}

async function loadGreedyWorker() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'tsm-meshlet-worker-'));
  const sourceRoot = path.join(ROOT, 'tsm-console/src/lib/webgpu-nanite');
  try {
    const [importSource, typeSource] = await Promise.all([
      readFile(path.join(sourceRoot, 'meshlet-import.ts'), 'utf8'),
      readFile(path.join(sourceRoot, 'meshlet-types.ts'), 'utf8'),
    ]);
    const fixedImports = importSource
      .replaceAll("from './meshlet-types'", "from './meshlet-types.ts'")
      .replaceAll('from "./meshlet-types"', 'from "./meshlet-types.ts"');
    await writeFile(path.join(temporaryRoot, 'package.json'), JSON.stringify({ type: 'module' }) + '\n');
    await writeFile(path.join(temporaryRoot, 'meshlet-import.ts'), fixedImports);
    await writeFile(path.join(temporaryRoot, 'meshlet-types.ts'), typeSource);
    const workerSource = [
      "import { buildMeshletsGreedy, exportMeshletPackJson } from './meshlet-import.ts';",
      'export function bakeMeshlets(mesh, options) {',
      '  const positions = Float32Array.from(mesh.positions);',
      '  const indices = Uint32Array.from(mesh.indices);',
      '  const normals = mesh.normals ? Float32Array.from(mesh.normals) : undefined;',
      '  const result = buildMeshletsGreedy({',
      '    positions, indices, normals,',
      "    sourceId: options.sourceId, horizontalCrs: 'LOCAL_3D_TILE_FRAME', verticalDatum: 'LOCAL_3D_TILE_Z',",
      '  });',
      '  return { mesh: { ...mesh, positions, indices, normals }, result, pack: exportMeshletPackJson(result.pack) };',
      '}',
      '',
    ].join('\n');
    const workerPath = path.join(temporaryRoot, 'worker.mts');
    await writeFile(workerPath, workerSource);
    const worker = await import(pathToFileURL(workerPath).href);
    return { temporaryRoot, bakeMeshlets: worker.bakeMeshlets };
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

function validateMeshletTopology(pack, expectedTriangleCount) {
  const geometry = pack.geometry;
  if (!geometry?.meshletVertexIndices || !geometry?.meshletTriangles) {
    fail('greedy builder did not emit local meshlet topology');
  }
  let expectedVertexOffset = 0;
  let expectedTriangleOffset = 0;
  for (let index = 0; index < pack.meshlets.length; index++) {
    const meshlet = pack.meshlets[index];
    if (!Number.isInteger(meshlet.vertexCount) || meshlet.vertexCount < 3 || meshlet.vertexCount > MESHLET_MAX_VERTICES) {
      fail('meshlet ' + index + ' exceeds or violates vertex limits');
    }
    if (!Number.isInteger(meshlet.triangleCount) || meshlet.triangleCount < 1 || meshlet.triangleCount > MESHLET_MAX_TRIANGLES) {
      fail('meshlet ' + index + ' exceeds or violates triangle limits');
    }
    if (meshlet.vertexOffset !== expectedVertexOffset || meshlet.triangleOffset !== expectedTriangleOffset) {
      fail('meshlet ' + index + ' has a non-contiguous packed offset');
    }
    const localVertexEnd = meshlet.vertexOffset + meshlet.vertexCount;
    const localTriangleEnd = (meshlet.triangleOffset + meshlet.triangleCount) * 3;
    if (localVertexEnd > geometry.meshletVertexIndices.length || localTriangleEnd > geometry.meshletTriangles.length) {
      fail('meshlet ' + index + ' exceeds packed topology arrays');
    }
    for (let i = meshlet.vertexOffset; i < localVertexEnd; i++) {
      const globalIndex = geometry.meshletVertexIndices[i];
      if (globalIndex >= geometry.positions.length / 3) fail('meshlet vertex map references an invalid global vertex');
    }
    const localIndices = geometry.meshletTriangles.subarray(meshlet.triangleOffset * 3, localTriangleEnd);
    for (const localIndex of localIndices) {
      if (localIndex >= meshlet.vertexCount) fail('meshlet local triangle index exceeds its meshlet vertex range');
    }
    expectedVertexOffset = localVertexEnd;
    expectedTriangleOffset += meshlet.triangleCount;
  }
  if (expectedTriangleOffset !== expectedTriangleCount) fail('meshlet triangle coverage does not match source triangle count');
  if (geometry.meshletTriangles.length !== expectedTriangleCount * 3) fail('packed local triangle array length is inconsistent');
}

async function main() {
  const inputRoot = path.resolve(getArgument('--input-dir', DEFAULT_INPUT));
  const outputRoot = path.resolve(getArgument('--output-dir', path.join(os.tmpdir(), 'tsm-meshlet-batch')));
  const expectedCountText = getArgument('--expected-count');
  const expectedCount = expectedCountText == null ? null : Number(expectedCountText);
  if (expectedCount != null && (!Number.isInteger(expectedCount) || expectedCount < 1)) fail('--expected-count must be a positive integer');
  if (!(await import('node:fs/promises')).stat) fail('node:fs/promises stat unavailable');
  if (outputRoot === inputRoot || outputRoot.startsWith(inputRoot + path.sep)) {
    fail('output directory must be outside the input GLB tree');
  }

  await mkdir(outputRoot, { recursive: true });
  const packRoot = path.join(outputRoot, 'packs');
  await mkdir(packRoot, { recursive: true });
  const files = await findGlbFiles(inputRoot);
  const sourceCommit = process.env.GITHUB_SHA || 'local-uncommitted';
  const sourceRootRelative = path.relative(ROOT, inputRoot).split(path.sep).join('/');
  const manifest = {
    schemaVersion: OUTPUT_SCHEMA,
    sourceCommit,
    sourceRoot: sourceRootRelative,
    generatedAt: new Date().toISOString(),
    authority: 'SIMULATION_DEMO',
    algorithm: {
      name: 'TSM greedy sequential meshlet clustering',
      version: 3,
      maxVertices: MESHLET_MAX_VERTICES,
      maxTriangles: MESHLET_MAX_TRIANGLES,
      preservesTriangleOrder: true,
      appliesGltfNodeTransforms: true,
      supportsMultipleMeshesAndPrimitives: true,
      generatesLocalVertexRemap: true,
      generatesLodDag: false,
      reordersTrianglesForSpatialQuality: false,
    },
    coordinateSemantics: {
      horizontalCrs: 'LOCAL_3D_TILE_FRAME',
      verticalDatum: 'LOCAL_3D_TILE_Z',
      nodeTransformsApplied: true,
      note: 'GLB scene node transforms are applied to preserve model geometry in the tile-local frame; no transformation into EPSG:4326 or NAVD88 is performed.',
    },
    limitations: [
      'Only embedded GLB 2.0 buffers, tightly-packed float POSITION/NORMAL accessors, triangle primitives, and uncompressed geometry are supported.',
      'Meshlet packs preserve positions, triangle topology, primitive-group metadata and optional normals, but do not bake UVs, colors, textures or materials for final shading.',
      'This is a greedy clustering bake, not a meshoptimizer cone-aware clustering pass or continuous LOD DAG.',
      'Packs are SIMULATION_DEMO/DERIVED rendering artifacts and are not survey or regulatory evidence.',
    ],
    expectedGlbCount: expectedCount,
    discoveredGlbCount: files.length,
    builtCount: 0,
    failedCount: 0,
    totals: {
      sourceBytes: 0,
      packBytes: 0,
      vertexCount: 0,
      triangleCount: 0,
      meshletCount: 0,
    },
    inputs: [],
  };

  let worker = null;
  try {
    worker = await loadGreedyWorker();
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const filePath = files[fileIndex];
      const relativePath = path.relative(inputRoot, filePath).split(path.sep).join('/');
      const record = {
        sourcePath: path.posix.join(sourceRootRelative, relativePath),
        sourceBytes: 0,
        sourceSha256: null,
        status: 'failed',
        error: null,
        vertexCount: 0,
        triangleCount: 0,
        meshletCount: 0,
        packPath: null,
        packSha256: null,
        packBytes: 0,
        packContentSha256: null,
        warnings: [],
      };
      try {
        const sourceBytes = await readFile(filePath);
        record.sourceBytes = sourceBytes.byteLength;
        record.sourceSha256 = sha256(sourceBytes);
        const glb = readGlbJson(sourceBytes);
        validateSupportedGlb(glb, glb.binByteLength);
        const mesh = extractBatchMesh(glb.json, glb.binChunk);
        const baked = worker.bakeMeshlets(mesh, {
          sourceId: record.sourcePath,
          horizontalCrs: 'LOCAL_3D_TILE_FRAME',
          verticalDatum: 'LOCAL_3D_TILE_Z',
        });
        if (baked.mesh.triangleCount <= 0 || baked.mesh.indices.length % 3 !== 0) {
          fail('flattened geometry does not contain complete triangle primitives');
        }
        validateMeshletTopology(baked.pack, baked.mesh.triangleCount);

        const packObject = {
          ...baked.pack,
          primitiveGroups: baked.mesh.primitiveGroups,
          authority: 'SIMULATION_DEMO',
          sourceId: record.sourcePath,
          horizontalCrs: 'LOCAL_3D_TILE_FRAME',
          verticalDatum: 'LOCAL_3D_TILE_Z',
          contentSha256: null,
        };
        const packContentSha256 = sha256(Buffer.from(JSON.stringify(packObject)));
        packObject.contentSha256 = packContentSha256;
        const serialized = Buffer.from(JSON.stringify(packObject));
        const compressed = gzipSync(serialized, { level: 9, mtime: 0 });
        const packRelativePath = path.posix.join(
          'packs',
          relativePath + '.meshletpack.json.gz',
        );
        const packPath = path.join(outputRoot, ...packRelativePath.split('/'));
        await mkdir(path.dirname(packPath), { recursive: true });
        await writeFile(packPath, compressed);

        record.status = 'built';
        record.vertexCount = baked.mesh.vertexCount;
        record.triangleCount = baked.mesh.triangleCount;
        record.meshletCount = baked.result.meshletCount;
        record.packPath = packRelativePath;
        record.packSha256 = sha256(compressed);
        record.packBytes = compressed.byteLength;
        record.packContentSha256 = packContentSha256;
        record.warnings = [...baked.result.warnings];
        record.primitiveCount = baked.mesh.primitiveCount;
        manifest.builtCount += 1;
        manifest.totals.sourceBytes += record.sourceBytes;
        manifest.totals.packBytes += record.packBytes;
        manifest.totals.vertexCount += record.vertexCount;
        manifest.totals.triangleCount += record.triangleCount;
        manifest.totals.meshletCount += record.meshletCount;
      } catch (error) {
        record.error = error instanceof Error ? error.message : String(error);
        manifest.failedCount += 1;
      }
      manifest.inputs.push(record);
      if ((fileIndex + 1) % 100 === 0 || fileIndex + 1 === files.length) {
        console.log(JSON.stringify({
          processed: fileIndex + 1,
          total: files.length,
          built: manifest.builtCount,
          failed: manifest.failedCount,
        }));
      }
    }
  } finally {
    if (worker?.temporaryRoot) await rm(worker.temporaryRoot, { recursive: true, force: true });
  }

  const expectedCountMismatch = expectedCount != null && files.length !== expectedCount;
  manifest.complete = manifest.failedCount === 0 && !expectedCountMismatch && manifest.builtCount === files.length && files.length > 0;
  manifest.expectedCountMismatch = expectedCountMismatch
    ? 'expected ' + expectedCount + ' GLBs, discovered ' + files.length
    : null;
  manifest.manifestContentSha256 = sha256(Buffer.from(JSON.stringify({ ...manifest, manifestContentSha256: null })));
  await writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(
    path.join(outputRoot, 'failures.json'),
    JSON.stringify(manifest.inputs.filter((input) => input.status !== 'built'), null, 2) + '\n',
  );

  const summary = {
    complete: manifest.complete,
    discoveredGlbCount: manifest.discoveredGlbCount,
    builtCount: manifest.builtCount,
    failedCount: manifest.failedCount,
    expectedGlbCount: manifest.expectedGlbCount,
    totals: manifest.totals,
    manifest: path.join(outputRoot, 'manifest.json'),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!manifest.complete) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
