/**
 * Read-only sidecar for source-contract reviews. The server-side Merkle ledger
 * remains authoritative; imported Foundry files have NO sign/append rights.
 */
export interface FoundryReviewEntry {
  entryId: string;
  kind: 'MISSING_SOURCE_METADATA' | 'SOURCE_DRIFT';
  sourceId: string;
  field: string;
  reviewStatus: 'PENDING_HUMAN_REVIEW';
  affectedPlanes: string[];
  relationshipEvidence: 'DECLARED_ONLY';
  entryPayloadSha256: string;
}
export interface FoundryLedgerReview {
  schema: 'tsm.government.foundry-ledger-queue.v1';
  classification: 'INFORMATIONAL_ONLY';
  sourceReportSha256: string;
  catalogSha256: string;
  ledgerSubmissionState: 'NOT_SUBMITTED';
  ledgerMutationPerformed: false;
  immutableLedgerAcceptance: 'NOT_EVIDENCED';
  regulatoryDetermination: false;
  reviewItemCount: number;
  entries: FoundryReviewEntry[];
}
const sha = /^[0-9a-f]{64}$/;
const identifier = /^[a-zA-Z0-9_.:-]{1,128}$/;
const fieldName = /^[a-zA-Z0-9_-]{1,128}$/;
const rowId = /^FDR-[0-9a-f]{24}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseFoundryLedgerReview(raw: unknown): FoundryLedgerReview {
  if (!isObject(raw) || raw.schema !== 'tsm.government.foundry-ledger-queue.v1') {
    throw new Error('Unsupported Foundry review schema');
  }
  if (raw.classification !== 'INFORMATIONAL_ONLY' ||
      raw.ledgerSubmissionState !== 'NOT_SUBMITTED' ||
      raw.ledgerMutationPerformed !== false ||
      raw.immutableLedgerAcceptance !== 'NOT_EVIDENCED' ||
      raw.regulatoryDetermination !== false) {
    throw new Error('Foundry report is not an unsigned, unsubmitted human-review queue');
  }
  if (typeof raw.sourceReportSha256 !== 'string' || !sha.test(raw.sourceReportSha256) ||
      typeof raw.catalogSha256 !== 'string' || !sha.test(raw.catalogSha256)) {
    throw new Error('Missing source report or catalog SHA-256 digest');
  }
  if (!Array.isArray(raw.entries) || raw.entries.length > 20000 ||
      !Number.isSafeInteger(raw.reviewItemCount) || raw.reviewItemCount !== raw.entries.length) {
    throw new Error('Foundry review item count is invalid');
  }
  const seen = new Set<string>();
  const entries: FoundryReviewEntry[] = [];
  for (const row of raw.entries) {
    if (!isObject(row) ||
        typeof row.entryId !== 'string' || !rowId.test(row.entryId) || seen.has(row.entryId) ||
        typeof row.sourceId !== 'string' || !identifier.test(row.sourceId) ||
        typeof row.field !== 'string' || !fieldName.test(row.field) ||
        (row.kind !== 'MISSING_SOURCE_METADATA' && row.kind !== 'SOURCE_DRIFT') ||
        row.reviewStatus !== 'PENDING_HUMAN_REVIEW' ||
        row.relationshipEvidence !== 'DECLARED_ONLY' ||
        typeof row.entryPayloadSha256 !== 'string' || !sha.test(row.entryPayloadSha256) ||
        !Array.isArray(row.affectedPlanes) || row.affectedPlanes.length > 128 ||
        row.affectedPlanes.some(x => typeof x !== 'string' || !identifier.test(x))) {
      throw new Error('Invalid Foundry source identifier, review row, or SHA-256 digest');
    }
    seen.add(row.entryId);
    entries.push({
      entryId: row.entryId, sourceId: row.sourceId, kind: row.kind,
      field: row.field, reviewStatus: 'PENDING_HUMAN_REVIEW',
      affectedPlanes: [...row.affectedPlanes] as string[],
      relationshipEvidence: 'DECLARED_ONLY', entryPayloadSha256: row.entryPayloadSha256,
    });
  }
  return {
    schema: 'tsm.government.foundry-ledger-queue.v1',
    classification: 'INFORMATIONAL_ONLY',
    sourceReportSha256: raw.sourceReportSha256,
    catalogSha256: raw.catalogSha256,
    ledgerSubmissionState: 'NOT_SUBMITTED',
    ledgerMutationPerformed: false,
    immutableLedgerAcceptance: 'NOT_EVIDENCED',
    regulatoryDetermination: false,
    reviewItemCount: entries.length,
    entries,
  };
}
