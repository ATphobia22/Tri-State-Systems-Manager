/**
 * Validation outcome. Same shape as the geodesy layer's `ValidationResult`,
 * defined locally so this package stays self-contained (no cross-package
 * import for a three-field result type).
 */
export interface EvidenceBundleValidation {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

/**
 * An evidence bundle: the sealed set of hashes for one ingested artifact.
 *
 * This is the bundle `SolverEvidence.evidenceBundleHash` refers to. Hashes use
 * the evidence-runtime convention `sha256:<64 lowercase hex>` (see
 * `EvidenceCollector.HASH_PATTERN`); bare hex is rejected so a bundle can
 * never silently mix hash encodings. `outputHash` is optional: a bundle may
 * be sealed at ingest time, before any solver output exists.
 */
export interface EvidenceBundle {
  readonly bundleId: string;
  readonly artifactId: string;
  readonly inputHash: string;
  readonly outputHash?: string;
  readonly metadataHash: string;
  readonly provenanceHash: string;
  /** ISO 8601 UTC timestamp, e.g. `2026-11-07T14:00:00Z`. */
  readonly createdAt: string;
}

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/**
 * Validate an evidence bundle without throwing: malformed input returns
 * `{ valid: false, errors }` (resilient posture — callers decide how to
 * label the bundle, e.g. REJECTED with reasons, rather than crashing).
 */
export function validateEvidenceBundle(bundle: unknown): EvidenceBundleValidation {
  const errors: string[] = [];
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    return { valid: false, errors: ["EVIDENCE_BUNDLE_MUST_BE_AN_OBJECT"], warnings: [] };
  }
  const candidate = bundle as Record<string, unknown>;
  if (!isNonEmptyString(candidate.bundleId)) errors.push("MISSING_BUNDLE_ID");
  if (!isNonEmptyString(candidate.artifactId)) errors.push("MISSING_ARTIFACT_ID");
  if (typeof candidate.inputHash !== "string" || !HASH_PATTERN.test(candidate.inputHash)) {
    errors.push("INVALID_INPUT_HASH");
  }
  if (
    candidate.outputHash !== undefined &&
    (typeof candidate.outputHash !== "string" || !HASH_PATTERN.test(candidate.outputHash))
  ) {
    errors.push("INVALID_OUTPUT_HASH");
  }
  if (typeof candidate.metadataHash !== "string" || !HASH_PATTERN.test(candidate.metadataHash)) {
    errors.push("INVALID_METADATA_HASH");
  }
  if (
    typeof candidate.provenanceHash !== "string" ||
    !HASH_PATTERN.test(candidate.provenanceHash)
  ) {
    errors.push("INVALID_PROVENANCE_HASH");
  }
  if (!isIsoTimestamp(candidate.createdAt)) errors.push("INVALID_CREATED_AT");
  return { valid: errors.length === 0, errors, warnings: [] };
}
