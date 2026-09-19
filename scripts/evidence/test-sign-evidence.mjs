#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const signer = path.join(root, 'scripts/evidence/sign-evidence.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsm-evidence-sign-'));

try {
  const input = path.join(temp, 'manifest.json');
  const signature = path.join(temp, 'manifest.sig');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(input, '{"schema":"tsm.test","value":1}\n');

  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  execFileSync(process.execPath, [signer, input, signature], {
    cwd: root,
    env: { ...process.env, TSM_EVIDENCE_SIGNING_KEY_PEM: pem.toString() },
    stdio: 'pipe',
  });

  const data = fs.readFileSync(input);
  const rawSignature = Buffer.from(fs.readFileSync(signature, 'utf8').trim(), 'base64');
  assert.equal(
    crypto.verify(null, data, publicKey, rawSignature),
    true,
    'detached Ed25519 signature must verify against the signed input',
  );

  console.log('detached Ed25519 signer verification passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
