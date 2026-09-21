#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const temp = path.join(root, 'artifacts', '.loma-signing-test');
const input = path.join(temp, 'source.txt');
const packet = path.join(temp, 'packet.zip');
const manifest = path.join(temp, 'manifest.json');
const signature = path.join(temp, 'manifest.sig');

fs.rmSync(temp, { recursive: true, force: true });
fs.mkdirSync(temp, { recursive: true });

try {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  fs.writeFileSync(input, 'TSM LOMA signing integration test\\n');

  execFileSync(
    'python3',
    [
      path.join(root, 'tools', 'build_loma_packet.py'),
      '--output',
      packet,
      input,
    ],
    {
      cwd: root,
      env: { ...process.env, TSM_EVIDENCE_SIGNING_KEY_PEM: pem.toString() },
      stdio: 'pipe',
    },
  );

  const extraction = [
    'import sys, zipfile',
    'z=zipfile.ZipFile(sys.argv[1])',
    "open(sys.argv[2], 'wb').write(z.read('manifest.json'))",

  ].join(';');
  execFileSync('python3', ['-c', extraction, packet, manifest], {
    cwd: root,
    stdio: 'pipe',
  });

  execFileSync(
    process.execPath,
    [
      path.join(root, 'scripts', 'evidence', 'sign-evidence.mjs'),
      manifest,
      signature,
    ],
    {
      cwd: root,
      env: { ...process.env, TSM_EVIDENCE_SIGNING_KEY_PEM: pem.toString() },
      stdio: 'pipe',
    },
  );

  const manifestBytes = fs.readFileSync(manifest);
  const sig = Buffer.from(fs.readFileSync(signature, 'utf8').trim(), 'base64');
  assert.equal(
    crypto.verify(null, manifestBytes, publicKey, sig),
    true,
    'signed LOMA manifest must verify with the generated Ed25519 public key',
  );

  const parsed = JSON.parse(manifestBytes);
  assert.equal(parsed.signature_status, 'SIGNED');
  console.log('signed LOMA packet integration verification passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
