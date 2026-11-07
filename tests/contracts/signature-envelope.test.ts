import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  validateSignatureEnvelope,
  verifyEd25519Signature,
} from '../../packages/evidence-runtime/src/SignatureEnvelope.ts';
import type { SignatureEnvelope } from '../../packages/evidence-runtime/src/SignatureEnvelope.ts';

const PAYLOAD = Buffer.from('solver evidence payload', 'utf8');

function makeKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawPublic = Buffer.from(
    (publicKey.export({ format: 'jwk' }) as { x: string }).x,
    'base64url',
  );
  return { publicKeyHex: rawPublic.toString('hex'), privateKey };
}

function validEnvelope(): { envelope: SignatureEnvelope; payload: Buffer } {
  const { publicKeyHex, privateKey } = makeKeypair();
  const payloadHash = `sha256:${createHash('sha256').update(PAYLOAD).digest('hex')}`;
  const signature = sign(null, PAYLOAD, privateKey).toString('hex');
  return {
    payload: PAYLOAD,
    envelope: {
      algorithm: 'Ed25519',
      payloadHash,
      publicKey: publicKeyHex,
      signature,
      signer: 'tsm-test-signer',
      signedAt: '2026-11-07T14:00:00Z',
    },
  };
}

test('a well-formed envelope validates', () => {
  const { envelope } = validEnvelope();
  const result = validateSignatureEnvelope(envelope);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('SHA256-only algorithm is rejected', () => {
  const { envelope } = validEnvelope();
  const result = validateSignatureEnvelope({ ...envelope, algorithm: 'SHA256' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('UNSUPPORTED_SIGNATURE_ALGORITHM'));
});

test('bare-hex payload hash and short keys are rejected', () => {
  const { envelope } = validEnvelope();
  const result = validateSignatureEnvelope({
    ...envelope,
    payloadHash: 'a'.repeat(64),
    publicKey: 'abcd',
    signature: 'abcd',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('INVALID_PAYLOAD_HASH'));
  assert.ok(result.errors.includes('INVALID_PUBLIC_KEY'));
  assert.ok(result.errors.includes('INVALID_SIGNATURE'));
});

test('valid signature verifies', () => {
  const { envelope } = validEnvelope();
  assert.equal(
    verifyEd25519Signature(PAYLOAD, envelope.signature, envelope.publicKey),
    true,
  );
});

test('tampered payload does not verify', () => {
  const { envelope } = validEnvelope();
  assert.equal(
    verifyEd25519Signature(
      Buffer.from('tampered payload', 'utf8'),
      envelope.signature,
      envelope.publicKey,
    ),
    false,
  );
});

test('signature from a different key does not verify', () => {
  const { envelope } = validEnvelope();
  const { publicKeyHex: otherKey } = makeKeypair();
  assert.equal(
    verifyEd25519Signature(PAYLOAD, envelope.signature, otherKey),
    false,
  );
});

test('malformed hex and wrong lengths return false instead of throwing', () => {
  const { envelope } = validEnvelope();
  assert.equal(verifyEd25519Signature(PAYLOAD, 'zz', envelope.publicKey), false);
  assert.equal(verifyEd25519Signature(PAYLOAD, envelope.signature, 'zz'), false);
  assert.equal(
    verifyEd25519Signature(PAYLOAD, 'aa'.repeat(32), envelope.publicKey),
    false,
  );
  assert.equal(
    verifyEd25519Signature(null as unknown as Uint8Array, envelope.signature, envelope.publicKey),
    false,
  );
});
