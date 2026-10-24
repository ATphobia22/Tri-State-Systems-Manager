import { createHash } from 'node:crypto';
import type { SolverEvidence, UnsealedSolverEvidence } from '../../contracts/src/SolverEvidence.js';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

/**
 * Serialize JSON-compatible values deterministically. Unlike JSON.stringify's
 * replacer-array approach, this recursively sorts each object's own keys.
 * Ambiguous/non-JSON values are rejected instead of silently omitted.
 */
export function canonicalJson(value: unknown): string {
  const ancestors = new WeakSet<object>();

  const encode = (current: unknown): string => {
    if (current === null) return 'null';
    if (typeof current === 'string') return JSON.stringify(current);
    if (typeof current === 'boolean') return current ? 'true' : 'false';
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new TypeError('EVIDENCE_NUMBER_MUST_BE_FINITE');
      return Object.is(current, -0) ? '0' : JSON.stringify(current);
    }
    if (typeof current !== 'object') throw new TypeError('EVIDENCE_VALUE_MUST_BE_JSON_COMPATIBLE');
    if (ancestors.has(current)) throw new TypeError('EVIDENCE_VALUE_MUST_NOT_BE_CIRCULAR');

    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        for (let index = 0; index < current.length; index += 1) {
          if (!(index in current)) throw new TypeError('EVIDENCE_ARRAY_MUST_NOT_BE_SPARSE');
        }
        return '[' + current.map(encode).join(',') + ']';
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('EVIDENCE_OBJECT_MUST_BE_PLAIN');
      }
      const record = current as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      for (const key of keys) {
        if (record[key] === undefined) throw new TypeError('EVIDENCE_UNDEFINED_FIELD_REJECTED');
      }
      return '{' + keys.map((key) => JSON.stringify(key) + ':' + encode(record[key])).join(',') + '}';
    } finally {
      ancestors.delete(current);
    }
  };

  return encode(value);
}

function sha256(value: string | Uint8Array): string {
  return 'sha256:' + createHash('sha256').update(value).digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export class EvidenceCollector {
  /** Computes a deterministic SHA-256 hash for JSON-compatible data. */
  public static hashPayload(payload: unknown): string {
    return sha256(canonicalJson(payload));
  }

  /** Hash raw artifact bytes without decoding or normalizing the byte stream. */
  public static hashArtifact(bytes: Uint8Array): string {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
      throw new TypeError('EVIDENCE_ARTIFACT_BYTES_REQUIRED');
    }
    return sha256(bytes);
  }

  /** Seal the exact evidence payload with its own digest and freeze it at runtime. */
  public static sealEvidence(evidence: UnsealedSolverEvidence): SolverEvidence {
    const stableEvidence = JSON.parse(canonicalJson(evidence)) as UnsealedSolverEvidence;
    const evidenceBundleHash = this.hashPayload(stableEvidence);
    return deepFreeze({ ...stableEvidence, evidenceBundleHash });
  }

  /**
   * Verify integrity. Invalid structures and unsupported payload values fail
   * closed by returning false; callers must not treat this as a signature.
   */
  public static verifyEvidenceIntegrity(evidence: SolverEvidence): boolean {
    try {
      if (!evidence || typeof evidence !== 'object' || !HASH_PATTERN.test(evidence.evidenceBundleHash)) {
        return false;
      }
      const { evidenceBundleHash, ...payload } = evidence;
      return this.hashPayload(payload) === evidenceBundleHash;
    } catch {
      return false;
    }
  }
}
