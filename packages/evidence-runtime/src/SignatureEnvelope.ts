import { createPublicKey, verify } from "node:crypto";

/**
 * An Ed25519 signature envelope for an evidence payload.
 *
 * This is the TypeScript counterpart of the Python side's Ed25519 signing
 * (`backend/engineering_evidence.py::verify_ed25519_signature`). The repo
 * signs with Ed25519 — never with a SHA-256-only envelope: a hash proves
 * integrity, only a signature proves origin.
 *
 * Key encoding matches the Python side: `publicKey` is the raw 32-byte
 * Ed25519 public key as 64 lowercase hex characters (the same bytes
 * `Ed25519PublicKey.from_public_bytes` accepts); `signature` is the raw
 * 64-byte signature as 128 lowercase hex characters. `payloadHash` is the
 * evidence-runtime `sha256:<64 hex>` digest of the signed payload bytes.
 */
export interface SignatureEnvelope {
  /** The only algorithm this envelope supports. */
  readonly algorithm: "Ed25519";
  readonly payloadHash: string;
  /** Raw 32-byte Ed25519 public key, lowercase hex (64 chars). */
  readonly publicKey: string;
  /** Raw 64-byte Ed25519 signature, lowercase hex (128 chars). */
  readonly signature: string;
  /** Who signed, e.g. a service or operator identifier. Never a secret. */
  readonly signer: string;
  /** ISO 8601 UTC timestamp, e.g. `2026-11-07T14:00:00Z`. */
  readonly signedAt: string;
}

export interface SignatureEnvelopeValidation {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const PUBLIC_KEY_PATTERN = /^[a-f0-9]{64}$/;
const SIGNATURE_PATTERN = /^[a-f0-9]{128}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/**
 * Validate an envelope's shape without throwing: malformed input returns
 * `{ valid: false, errors }`. Shape validation is not signature
 * verification — a well-formed envelope can still carry a bad signature.
 */
export function validateSignatureEnvelope(envelope: unknown): SignatureEnvelopeValidation {
  const errors: string[] = [];
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { valid: false, errors: ["SIGNATURE_ENVELOPE_MUST_BE_AN_OBJECT"], warnings: [] };
  }
  const candidate = envelope as Record<string, unknown>;
  if (candidate.algorithm !== "Ed25519") errors.push("UNSUPPORTED_SIGNATURE_ALGORITHM");
  if (typeof candidate.payloadHash !== "string" || !HASH_PATTERN.test(candidate.payloadHash)) {
    errors.push("INVALID_PAYLOAD_HASH");
  }
  if (typeof candidate.publicKey !== "string" || !PUBLIC_KEY_PATTERN.test(candidate.publicKey)) {
    errors.push("INVALID_PUBLIC_KEY");
  }
  if (typeof candidate.signature !== "string" || !SIGNATURE_PATTERN.test(candidate.signature)) {
    errors.push("INVALID_SIGNATURE");
  }
  if (!isNonEmptyString(candidate.signer)) errors.push("MISSING_SIGNER");
  if (!isIsoTimestamp(candidate.signedAt)) errors.push("INVALID_SIGNED_AT");
  return { valid: errors.length === 0, errors, warnings: [] };
}

function hexToBuffer(hex: string): Buffer | null {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[a-f0-9]+$/.test(hex)) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

/**
 * Verify an Ed25519 signature over raw payload bytes. Returns `false` for
 * any failure — bad signature, bad key, malformed hex, wrong lengths —
 * instead of throwing (same resilient pattern as
 * `EvidenceCollector.verifyEvidenceIntegrity`). A `true` result proves the
 * payload was signed by the holder of the matching private key; it says
 * nothing about whether the payload itself is correct or trustworthy.
 */
export function verifyEd25519Signature(
  payload: Uint8Array,
  signatureHex: string,
  publicKeyHex: string,
): boolean {
  try {
    if (!(payload instanceof Uint8Array)) return false;
    const signature = hexToBuffer(signatureHex);
    const publicKeyBytes = hexToBuffer(publicKeyHex);
    if (!signature || signature.length !== 64) return false;
    if (!publicKeyBytes || publicKeyBytes.length !== 32) return false;
    const publicKey = createPublicKey({
      key: {
        kty: "OKP",
        crv: "Ed25519",
        x: publicKeyBytes.toString("base64url"),
      },
      format: "jwk",
    });
    return verify(null, payload, publicKey, signature);
  } catch {
    return false;
  }
}
