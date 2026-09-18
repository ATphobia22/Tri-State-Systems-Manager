#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('usage: node sign-evidence.mjs <input-file> <signature-file>');
  process.exit(2);
}
const keyPem = process.env.TSM_EVIDENCE_SIGNING_KEY_PEM;
if (!keyPem) {
  console.error('fail-closed: TSM_EVIDENCE_SIGNING_KEY_PEM is required for signing');
  process.exit(3);
}
const input = fs.readFileSync(inputPath);
const privateKey = crypto.createPrivateKey(keyPem);
if (privateKey.asymmetricKeyType !== 'ed25519') {
  console.error('fail-closed: evidence signing key must be Ed25519');
  process.exit(4);
}
const signature = crypto.sign(null, input, privateKey);
fs.writeFileSync(outputPath, signature.toString('base64') + '\n', { mode: 0o600 });
console.log(JSON.stringify({
  algorithm: 'Ed25519',
  input_sha256: crypto.createHash('sha256').update(input).digest('hex'),
  signature_file: outputPath,
}, null, 2));
