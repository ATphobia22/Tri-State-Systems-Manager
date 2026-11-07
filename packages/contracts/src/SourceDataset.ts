/**
 * SourceDataset — a standalone record describing one retrieved dataset from
 * a registered government source.
 *
 * RECONCILIATION NOTE: this contract deliberately does NOT duplicate
 * EvidenceBundle (which exists only on the unmerged geodesy branch
 * feat/geodesy-evidence-gaps-20261107) or IngestionManifest (which exists
 * only on the unmerged PR #501 branch feat/ingestion-bootstrap-gaps-20261107).
 * A SourceDataset REFERENCES those concepts by hash/id only
 * (`evidenceBundleHash`, `ingestionRunId`) and never re-defines their
 * fields. When the geodesy branch and PR #501 merge, reconcile by
 * composition — a SourceDataset may point at an EvidenceBundle and an
 * IngestionManifest — not by copying their fields into this type.
 *
 * Every field is readonly. `endpoint` must be a credential-free HTTPS URL;
 * `checksumSha256` is the SHA-256 of the retrieved bytes, recorded as
 * `sha256:` followed by 64 lowercase hex characters.
 */
export interface SourceDataset {
  readonly sourceId: string;
  readonly datasetName: string;
  readonly version?: string;
  readonly endpoint: string;
  readonly access: 'REST_JSON' | 'DOWNLOAD' | 'CATALOG';
  readonly retrievedAt: string;
  readonly checksumSha256: string;
  readonly byteSize?: number;
  readonly featureCount?: number;
  /** SHA-256 hash of the EvidenceBundle this dataset belongs to, when known. */
  readonly evidenceBundleHash?: string;
  /** Ingestion run that produced this dataset record, when known. */
  readonly ingestionRunId?: string;
  readonly provenance: {
    readonly retrievedBy: string;
    readonly sourceUri: string;
    readonly notes?: string;
  };
}

const CHECKSUM_RE = /^sha256:[0-9a-f]{64}$/;

/**
 * Validate a candidate SourceDataset. Returns an array of error strings;
 * an empty array means the value is valid. Never throws on malformed input.
 */
export function validateSourceDataset(value: unknown): readonly string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['source dataset must be an object'];
  }
  const record = value as Record<string, unknown>;
  if (typeof record.sourceId !== 'string' || !record.sourceId.trim()) {
    errors.push('sourceId is required and must be a non-empty string');
  }
  if (typeof record.datasetName !== 'string' || !record.datasetName.trim()) {
    errors.push('datasetName is required and must be a non-empty string');
  }
  if (record.version !== undefined && (typeof record.version !== 'string' || !record.version.trim())) {
    errors.push('version must be a non-empty string when present');
  }
  if (typeof record.endpoint !== 'string' || !record.endpoint.trim()) {
    errors.push('endpoint is required and must be a non-empty string');
  } else {
    let url: URL | null = null;
    try {
      url = new URL(record.endpoint);
    } catch {
      errors.push('endpoint must be a valid URL');
    }
    if (url) {
      if (url.protocol !== 'https:') errors.push('endpoint must use https');
      if (url.username !== '' || url.password !== '') errors.push('endpoint must not contain credentials');
      if (url.hash !== '') errors.push('endpoint must not contain a fragment');
    }
  }
  if (record.access !== 'REST_JSON' && record.access !== 'DOWNLOAD' && record.access !== 'CATALOG') {
    errors.push("access must be one of 'REST_JSON', 'DOWNLOAD', 'CATALOG'");
  }
  if (typeof record.retrievedAt !== 'string' || !Number.isFinite(Date.parse(record.retrievedAt))) {
    errors.push('retrievedAt must be a valid ISO 8601 timestamp');
  }
  if (typeof record.checksumSha256 !== 'string' || !CHECKSUM_RE.test(record.checksumSha256)) {
    errors.push("checksumSha256 must match 'sha256:' followed by 64 lowercase hex characters");
  }
  if (record.byteSize !== undefined && (typeof record.byteSize !== 'number' || !Number.isFinite(record.byteSize) || record.byteSize < 0)) {
    errors.push('byteSize must be a non-negative number when present');
  }
  if (record.featureCount !== undefined && (typeof record.featureCount !== 'number' || !Number.isFinite(record.featureCount) || record.featureCount < 0)) {
    errors.push('featureCount must be a non-negative number when present');
  }
  if (record.evidenceBundleHash !== undefined && (typeof record.evidenceBundleHash !== 'string' || !record.evidenceBundleHash.trim())) {
    errors.push('evidenceBundleHash must be a non-empty string when present');
  }
  if (record.ingestionRunId !== undefined && (typeof record.ingestionRunId !== 'string' || !record.ingestionRunId.trim())) {
    errors.push('ingestionRunId must be a non-empty string when present');
  }
  const provenance = record.provenance as Record<string, unknown> | null | undefined;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    errors.push('provenance is required and must be an object');
  } else {
    if (typeof provenance.retrievedBy !== 'string' || !provenance.retrievedBy.trim()) {
      errors.push('provenance.retrievedBy is required and must be a non-empty string');
    }
    if (typeof provenance.sourceUri !== 'string' || !provenance.sourceUri.trim()) {
      errors.push('provenance.sourceUri is required and must be a non-empty string');
    }
    if (provenance.notes !== undefined && typeof provenance.notes !== 'string') {
      errors.push('provenance.notes must be a string when present');
    }
  }
  return errors;
}
