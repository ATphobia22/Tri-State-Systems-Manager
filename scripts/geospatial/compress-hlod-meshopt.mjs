#!/usr/bin/env node
/**
 * Opt-in meshopt GLB compressor for validated, stitched TSM HLOD tiles.
 *
 * Use only with a runtime that explicitly decodes EXT_meshopt_compression.
 * Never replaces uncompressed evidence or the default Draco release pipeline.
 *
 * Locally installed @gltf-transform/cli is required. No remote npx/network.
 * Quantization is NOT bit-exact; keep the immutable uncompressed source.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, lstat, mkdir, open, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_ENCODER = path.join(ROOT, 'tsm-console/node_modules/.bin/gltf-transform');
const EXTENSION = 'EXT_meshopt_compression';
const MAX_JSON_BYTES = 16 * 1024 * 1024;

export function safeGlbUri(uri) {
  if (typeof uri !== 'string' || !/^stitched\/[a-zA-Z0-9_.\/-]+\.glb$/.test(uri)) {
    throw new Error('Unexpected or unsafe stitched GLB URI');
  }
  if (uri.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    throw new Error('GLB content path contains a traversal or empty component');
  }
  return uri;
}

export function enumerateStitchedContents(tileset) {
  if (!tileset || typeof tileset !== 'object' || !tileset.root) {
    throw new Error('Missing tileset root');
  }
  const seen = new Set();
  const references = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') throw new Error('Malformed tileset node');
    if (node.content?.uri != null) {
      const uri = safeGlbUri(node.content.uri);
      if (seen.has(uri)) throw new Error('Repeated GLB content URI');
      seen.add(uri);
      references.push(uri);
    }
    if (node.contents != null) throw new Error('Multiple content entries require separate verified support');
    for (const child of node.children ?? []) walk(child);
  };
  walk(tileset.root);
  if (!references.length) throw new Error('No stitched GLB content found');
  return references.sort();
}

export async function sha256(file) {
  const h = createHash('sha256');
  for await (const data of createReadStream(file)) h.update(data);
  return h.digest('hex');
}

export async function inspectGlb(file) {
  const fh = await open(file, 'r');
  try {
    const hdr = Buffer.alloc(20);
    const { bytesRead } = await fh.read(hdr, 0, 20, 0);
    if (bytesRead !== 20 || hdr.toString('utf8', 0, 4) !== 'glTF' || hdr.readUInt32LE(4) !== 2) {
      throw new Error('Output is not a valid GLB 2 header');
    }
    const declared = hdr.readUInt32LE(8);
    if (declared !== (await fh.stat()).size) throw new Error('GLB declared length differs from file length');
    const length = hdr.readUInt32LE(12);
    if (hdr.readUInt32LE(16) !== 0x4e4f534a || length > MAX_JSON_BYTES || length + 20 > declared) {
      throw new Error('Invalid GLB JSON chunk');
    }
    const data = Buffer.alloc(length);
    if ((await fh.read(data, 0, length, 20)).bytesRead !== length) throw new Error('Truncated GLB JSON');
    return JSON.parse(data.toString('utf8').trim());
  } finally {
    await fh.close();
  }
}

async function runLocalCli(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let errorText = '';
    child.stderr.on('data', (chunk) => { errorText = (errorText + chunk.toString()).slice(-4096); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() :
      reject(new Error('Local glTF Transform command failed (exit ' + code + '): ' + errorText)));
  });
}

async function assertOrdinaryFile(file) {
  const s = await lstat(file);
  if (!s.isFile() || s.isSymbolicLink()) throw new Error('Refusing nonregular file or symlink');
}

export async function compressHlod({ inputDir, outputDir, cli = DEFAULT_ENCODER }) {
  const input = path.resolve(inputDir);
  const output = path.resolve(outputDir);
  if (output === input || output.startsWith(input + path.sep) || input.startsWith(output + path.sep)) {
    throw new Error('Input and output must be separate, nonnested directories');
  }
  const meta = await lstat(input);
  if (!meta.isDirectory() || meta.isSymbolicLink()) throw new Error('Input must be a real directory');
  await assertOrdinaryFile(path.join(input, 'tileset.json'));
  await assertOrdinaryFile(path.join(input, 'manifest.json'));
  // npm creates executable symlinks under node_modules/.bin. The CLI may be
  // a symlink, but its resolved target must still be a normal local file.
  if (!(await stat(cli)).isFile()) throw new Error('Local glTF Transform CLI is not a regular file');
  const sourceTileset = JSON.parse(await readFile(path.join(input, 'tileset.json'), 'utf8'));
  const sourceManifest = JSON.parse(await readFile(path.join(input, 'manifest.json'), 'utf8'));
  if (sourceManifest.authorityClass !== 'DERIVED' ||
      sourceManifest.engineeringUse !== false || sourceManifest.regulatoryUse !== false) {
    throw new Error('Input must preserve non-regulatory DERIVED source status');
  }
  const uris = enumerateStitchedContents(sourceTileset);
  if (await stat(output).then(() => true, (e) => e.code === 'ENOENT' ? false : Promise.reject(e))) {
    if ((await readdir(output)).length) throw new Error('Output is not empty; refusing overwrite');
  }
  await mkdir(output, { recursive: true });
  const tileSet = structuredClone(sourceTileset);
  const rewrite = (node) => {
    if (node.content?.uri) node.content.uri = node.content.uri.replace(/\.glb$/, '-meshopt.glb');
    for (const child of node.children ?? []) rewrite(child);
  };
  rewrite(tileSet.root);
  tileSet.extras = tileSet.extras ?? {};
  tileSet.extras.tsm = {
    ...(tileSet.extras.tsm ?? {}),
    geometryCodec: EXTENSION,
    meshopt: true,
    draco: false,
    geometricExactnessGuaranteed: false,
    decoderCompatibilityVerified: false,
    classification: 'INFORMATIONAL_ONLY',
  };
  const inputManifestSha256 = await sha256(path.join(input, 'manifest.json'));
  const receipts = [];
  const outputGlbs = [];
  for (const uri of uris) {
    const src = path.join(input, uri);
    await assertOrdinaryFile(src);
    const dstRel = uri.replace(/\.glb$/, '-meshopt.glb');
    const dst = path.join(output, dstRel);
    await mkdir(path.dirname(dst), { recursive: true });
    await runLocalCli(cli, ['meshopt', src, dst, '--level', 'high', '--quantize-position', '16']);
    await assertOrdinaryFile(dst);
    const doc = await inspectGlb(dst);
    if (!(doc.extensionsUsed ?? []).includes(EXTENSION) ||
        !(doc.extensionsRequired ?? []).includes(EXTENSION)) {
      throw new Error('Encoder output missing required EXT_meshopt_compression extension');
    }
    await runLocalCli(cli, ['validate', dst, '--limit', '1']);
    const inputSize = (await stat(src)).size, outputSize = (await stat(dst)).size;
    receipts.push({
      sourceUri: uri, outputUri: dstRel, sourceSha256: await sha256(src),
      outputSha256: await sha256(dst), sourceBytes: inputSize, outputBytes: outputSize,
    });
    outputGlbs.push(dstRel);
  }
  const tileSetPath = path.join(output, 'tileset.json');
  const manifestPath = path.join(output, 'manifest.json');
  await writeFile(tileSetPath, JSON.stringify(tileSet, null, 2) + '\n');
  await cp(path.join(input, 'manifest.json'), manifestPath, { errorOnExist: true, force: false });
  // Production tileset validator expects *exactly* referenced GLBs + these two files.
  const verifiedPaths = ['tileset.json', 'manifest.json', ...outputGlbs].sort();
  await writeFile(path.join(output, 'SHA256SUMS'),
    (await Promise.all(verifiedPaths.map(async p => (await sha256(path.join(output, p))) + '  ' + p))).join('\n') + '\n');
  const totalInput = receipts.reduce((sum, item) => sum + item.sourceBytes, 0);
  const totalOutput = receipts.reduce((sum, item) => sum + item.outputBytes, 0);
  const report = {
    schemaVersion: 'tsm.meshopt-compression-receipt.v1',
    codec: EXTENSION,
    classification: 'INFORMATIONAL_ONLY',
    geometricExactnessGuaranteed: false,
    quantizePositionBits: 16,
    decoderCompatibilityVerified: false,
    sourceManifestSha256: inputManifestSha256,
    outputTilesetSha256: await sha256(tileSetPath),
    sourceGlbCount: uris.length,
    compressedGlbCount: outputGlbs.length,
    totalSourceBytes: totalInput,
    totalCompressedBytes: totalOutput,
    compressionRatio: totalInput ? totalOutput / totalInput : null,
    entries: receipts,
  };
  // Outside the validator's exact-content set; retains lossless evidence receipts.
  const receiptPath = output + '.meshopt-receipt.json';
  if (await stat(receiptPath).then(() => true, (e) => e.code === 'ENOENT' ? false : Promise.reject(e))) {
    throw new Error('Refusing to overwrite existing external compression receipt');
  }
  await writeFile(receiptPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return { report, receiptPath };
}

function argsOf(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--input-dir', '--output-dir', '--cli'].includes(argv[i]) || !argv[i + 1]) {
      throw new Error('Usage: node compress-hlod-meshopt.mjs --input-dir DIR --output-dir DIR [--cli PATH]');
    }
    options[argv[i]] = argv[i + 1];
  }
  if (!options['--input-dir'] || !options['--output-dir']) throw new Error('Missing input/output directory');
  return {
    inputDir: options['--input-dir'], outputDir: options['--output-dir'],
    cli: options['--cli'] || DEFAULT_ENCODER,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  compressHlod(argsOf(process.argv.slice(2))).then(({ report, receiptPath }) => {
    console.log(JSON.stringify({
      status: 'INFORMATIONAL_ONLY', codec: report.codec,
      sourceGlbCount: report.sourceGlbCount,
      compressedGlbCount: report.compressedGlbCount,
      compressionRatio: report.compressionRatio,
      receiptPath,
    }));
  }).catch((error) => { console.error('TSM meshopt compressor: ' + error.message); process.exitCode = 1; });
}
