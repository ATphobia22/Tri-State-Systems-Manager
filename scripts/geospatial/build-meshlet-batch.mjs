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
    }
  }
  if (offset !== buffer.byteLength) fail('GLB chunk cursor did not end at file boundary');
  if (!json) fail('GLB JSON chunk is missing');
  if (binChunks !== 1) fail('exactly one embedded GLB BIN chunk is required');
  return { json, binByteLength };
}

function isIdentityMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 16) return false;
  const expected = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  return matrix.every((value, index) => Number.isFinite(value) && Math.abs(value - expected[index]) <= 1e-12);
}

function validateAccessor(json, index, expectedType, allowedComponentTypes, binByteLength, label) {
  const accessors = json.accessors;
  const views = json.bufferViews;
  if (!Array.isArray(accessors) || !Number.isInteger(index) || index < 0 || index >= accessors.length) {
    fail(label + ' accessor index is invalid');
  }
  const accessor = accessors[index];
  if (accessor.type !== expectedType) fail(label + ' accessor type must be ' + expectedType);
  if (!allowedComponentTypes.includes(accessor.componentType)) fail(label + ' has unsupported componentType');
  if (!Number.isInteger(accessor.count) || accessor.count <= 0) fail(label + ' accessor count is invalid');
  if (accessor.sparse) fail(label + ' sparse accessors are not supported by the current extractor');
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
    fail(label + ' interleaved/non-tightly-packed data is unsupported by the current extractor');
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

/**
 * The current extractor deliberately supports one uncompressed triangle
 * primitive in identity model space. This validator rejects unsupported GLB
 * features up front so that the batch can never silently omit scene geometry.
 */
export function validateSupportedGlb(glb, binByteLength) {
  const json = glb?.json ?? glb;
  if (!json || json.asset?.version !== '2.0') fail('asset.version must be 2.0');
  if (!Array.isArray(json.buffers) || json.buffers.length !== 1 || json.buffers[0]?.uri) {
    fail('GLB must have exactly one embedded buffer and no external URI');
  }
  if (json.buffers[0].byteLength > binByteLength) fail('GLB buffer length exceeds embedded BIN chunk');
  if (!Array.isArray(json.meshes) || json.meshes.length !== 1) {
    fail('current extractor requires exactly one mesh; found ' + (json.meshes?.length ?? 0));
  }
  const mesh = json.meshes[0];
  if (!Array.isArray(mesh.primitives) || mesh.primitives.length !== 1) {
    fail('current extractor requires exactly one primitive per GLB mesh');
  }
  const primitive = mesh.primitives[0];
  if ((primitive.mode ?? 4) !== 4) fail('only TRIANGLES primitive mode is supported');
  if (Array.isArray(primitive.targets) && primitive.targets.length) fail('morph targets are unsupported');
  if (primitive.extensions?.KHR_draco_mesh_compression || primitive.extensions?.EXT_meshopt_compression) {
    fail('compressed mesh geometry is unsupported by the current extractor');
  }
  if ((json.skins?.length ?? 0) > 0 || (json.animations?.length ?? 0) > 0) {
    fail('skinned or animated geometry is unsupported');
  }
  for (const node of json.nodes ?? []) {
    if (node.matrix != null && !isIdentityMatrix(node.matrix)) fail('non-identity node matrix would require a geometry transform');
    if (node.translation && (node.translation.length !== 3 || node.translation.some((v, i) => !Number.isFinite(v) || Math.abs(v) > 1e-12))) {
      fail('non-identity node translation would require a geometry transform');
    }
    if (node.rotation && (node.rotation.length !== 4 || !node.rotation.every(Number.isFinite) ||
      Math.abs(node.rotation[0]) > 1e-12 || Math.abs(node.rotation[1]) > 1e-12 ||
      Math.abs(node.rotation[2]) > 1e-12 || Math.abs(node.rotation[3] - 1) > 1e-12)) {
      fail('non-identity node rotation would require a geometry transform');
    }
    if (node.scale && (node.scale.length !== 3 || !node.scale.every(Number.isFinite) ||
      node.scale.some((v) => Math.abs(v - 1) > 1e-12))) {
      fail('non-identity node scale would require a geometry transform');
    }
    if (node.mesh != null && node.mesh !== 0) fail('node references a mesh outside the supported mesh');
  }
  const meshNodes = (json.nodes ?? []).filter((node) => node.mesh === 0);
  if (meshNodes.length > 1) fail('multiple node instances of the mesh would require duplicated transformed geometry');
  if (Array.isArray(json.nodes) && json.nodes.length > 0 && meshNodes.length === 0) {
    fail('mesh is not referenced by a node');
  }

  const attributes = primitive.attributes;
  if (!attributes || !Number.isInteger(attributes.POSITION)) fail('primitive POSITION attribute is missing');
  const position = validateAccessor(json, attributes.POSITION, 'VEC3', [5126], binByteLength, 'POSITION');
  if (position.count < 3 || position.count % 3 !== 0 && primitive.indices == null) {
    fail('non-indexed POSITION accessor must contain complete triangles');
  }
  if (attributes.NORMAL != null) {
    const normal = validateAccessor(json, attributes.NORMAL, 'VEC3', [5126], binByteLength, 'NORMAL');
    if (normal.count !== position.count) fail('NORMAL and POSITION counts do not match');
  }
  if (primitive.indices != null) {
    const indices = validateAccessor(json, primitive.indices, 'SCALAR', [5121, 5123, 5125], binByteLength, 'indices');
    if (indices.count % 3 !== 0) fail('index accessor must contain complete triangles');
  }
  return {
    vertexCount: position.count,
    hasNormals: attributes.NORMAL != null,
    indexed: primitive.indices != null,
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
    const [importSource, typeSource, glbSource] = await Promise.all([
      readFile(path.join(sourceRoot, 'meshlet-import.ts'), 'utf8'),
      readFile(path.join(sourceRoot, 'meshlet-types.ts'), 'utf8'),
      readFile(path.join(sourceRoot, 'glb-mesh-extract.ts'), 'utf8'),
    ]);
    const fixedImports = importSource
      .replaceAll("from './meshlet-types'", "from './meshlet-types.ts'")
      .replaceAll('from "./meshlet-types"', 'from "./meshlet-types.ts"');
    await writeFile(path.join(temporaryRoot, 'package.json'), JSON.stringify({ type: 'module' }) + '\n');
    await writeFile(path.join(temporaryRoot, 'meshlet-import.ts'), fixedImports);
    await writeFile(path.join(temporaryRoot, 'meshlet-types.ts'), typeSource);
    await writeFile(path.join(temporaryRoot, 'glb-mesh-extract.ts'), glbSource);
    const workerSource = [
      "import { extractMeshFromGlb } from './glb-mesh-extract.ts';",
      "import { buildMeshletsGreedy, exportMeshletPackJson } from './meshlet-import.ts';",
      'export function bakeMeshlets(buffer, options) {',
      '  const mesh = extractMeshFromGlb(buffer);',
      '  const result = buildMeshletsGreedy({',
      '    positions: mesh.positions, indices: mesh.indices, normals: mesh.normals,',
      "    sourceId: options.sourceId, horizontalCrs: 'LOCAL_3D_TILE_FRAME', verticalDatum: 'LOCAL_3D_TILE_Z',",
      '  });',
      '  return { mesh, result, pack: exportMeshletPackJson(result.pack) };',
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
      version: 2,
      maxVertices: MESHLET_MAX_VERTICES,
      maxTriangles: MESHLET_MAX_TRIANGLES,
      preservesTriangleOrder: true,
      generatesLocalVertexRemap: true,
      generatesLodDag: false,
      reordersTrianglesForSpatialQuality: false,
    },
    coordinateSemantics: {
      horizontalCrs: 'LOCAL_3D_TILE_FRAME',
      verticalDatum: 'LOCAL_3D_TILE_Z',
      note: 'Raw GLB model-space coordinates are preserved. No transformation into EPSG:4326 or NAVD88 is performed.',
    },
    limitations: [
      'Only one uncompressed triangle primitive in identity node space is supported; unsupported inputs are recorded as failures.',
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
        const glbContract = validateSupportedGlb(glb, glb.binByteLength);
        const rawArrayBuffer = sourceBytes.buffer.slice(
          sourceBytes.byteOffset,
          sourceBytes.byteOffset + sourceBytes.byteLength,
        );
        const baked = worker.bakeMeshlets(rawArrayBuffer, {
          sourceId: record.sourcePath,
          horizontalCrs: 'LOCAL_3D_TILE_FRAME',
          verticalDatum: 'LOCAL_3D_TILE_Z',
        });
        if (baked.mesh.vertexCount !== glbContract.vertexCount) {
          fail('extractor vertex count differs from validated POSITION accessor');
        }
        if (baked.mesh.triangleCount <= 0 || baked.mesh.indices.length % 3 !== 0) {
          fail('extracted mesh does not contain complete triangle primitives');
        }
        validateMeshletTopology(baked.pack, baked.mesh.triangleCount);

        const packObject = {
          ...baked.pack,
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
