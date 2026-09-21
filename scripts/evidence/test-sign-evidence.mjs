#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsm-evidence-signer-'));
try {
  const inputPath = path.join(tempDir, 'evidence.bin');
  const signaturePath = path.join(tempDir, 'evidence.sig');
  const payload = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    artifact: 'production-test',
    timestamp: '2026-09-21T00:00:00Z'
  }));
  fs.writeFileSync(inputPath, payload);

  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/evidence/sign-evidence.mjs'),
    inputPath,
    signaturePath,
  ], {
    encoding: 'utf8',
    env: { ...process.env, TSM_EVIDENCE_SIGNING_KEY_PEM: privatePem },
  });

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.status || 1);
  }

  const signature = Buffer.from(fs.readFileSync(signaturePath, 'utf8').trim(), 'base64');
  if (!crypto.verify(null, payload, publicKey, signature)) {
    throw new Error('Ed25519 signature verification failed');
  }

  console.log('Ed25519 evidence signer: PASS');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
