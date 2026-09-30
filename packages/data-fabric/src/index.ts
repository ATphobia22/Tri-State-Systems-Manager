import { createHash } from 'node:crypto';

export type FabricZone = 'RAW' | 'CURATED' | 'SEMANTIC';
export type DatasetAuthority =
  | 'CONTROLLED_FIELD' | 'OFFICIAL_GOVERNMENT' | 'AUTHORITATIVE_SCIENTIFIC'
  | 'PROJECT_ENGINEERING' | 'SECONDARY' | 'DISCOVERY_ONLY';
export type QualityStatus = 'UNKNOWN' | 'PASS' | 'FAIL' | 'STALE' | 'CONTRADICTED';

export interface DatasetLineage {
  readonly parentDatasetIds: readonly string[];
  readonly transformationIds: readonly string[];
  readonly sourceUri?: string;
  readonly contentHash?: string;
  readonly retrievedAt?: string;
  readonly sourceObservedAt?: string;
}

export interface DatasetContract {
  readonly datasetId: string;
  readonly title: string;
  readonly owner: string;
  readonly steward: string;
  readonly accessClass: 'PUBLIC' | 'CONTROLLED' | 'RESTRICTED';
  readonly authority: DatasetAuthority;
  readonly zone: FabricZone;
  readonly schemaVersion: string;
  readonly units?: string;
  readonly crs?: string;
  readonly verticalDatum?: string;
  readonly updateCadenceSeconds?: number;
  readonly maxAgeSeconds?: number;
  readonly lineage: DatasetLineage;
  readonly quality: {
    readonly status: QualityStatus;
    readonly requiredFields: readonly string[];
    readonly checks: readonly string[];
  };
}

export interface DatasetAssessment {
  readonly datasetId: string;
  readonly accepted: boolean;
  readonly status: QualityStatus;
  readonly issues: readonly string[];
  readonly contractHash: string;
  readonly ageSeconds?: number;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function assessDataset(contract: DatasetContract, now = new Date()): DatasetAssessment {
  const issues: string[] = [];
  let ageSeconds: number | undefined;
  if (!contract.datasetId.trim()) issues.push('datasetId is required');
  if (!contract.title.trim()) issues.push('title is required');
  if (!contract.owner.trim()) issues.push('owner is required');
  if (!contract.steward.trim()) issues.push('steward is required');
  if (contract.authority === 'DISCOVERY_ONLY') issues.push('discovery-only datasets cannot become authoritative');
  if (contract.quality.status !== 'PASS') issues.push(`quality status is ${contract.quality.status}`);
  if (contract.maxAgeSeconds !== undefined && contract.updateCadenceSeconds !== undefined &&
      contract.maxAgeSeconds < contract.updateCadenceSeconds) {
    issues.push('maxAgeSeconds must be >= updateCadenceSeconds');
  }
  if (!contract.lineage.contentHash && contract.zone !== 'RAW') {
    issues.push('curated/semantic datasets require contentHash lineage');
  }
  if (contract.lineage.retrievedAt) {
    const retrievedMs = Date.parse(contract.lineage.retrievedAt);
    if (!Number.isFinite(retrievedMs)) issues.push('lineage.retrievedAt must be an ISO-8601 timestamp');
    else {
      ageSeconds = Math.max(0, (now.getTime() - retrievedMs) / 1000);
      if (ageSeconds > 0 && contract.maxAgeSeconds !== undefined && ageSeconds > contract.maxAgeSeconds) {
        issues.push(`dataset is stale: ageSeconds=${Math.floor(ageSeconds)} maxAgeSeconds=${contract.maxAgeSeconds}`);
      }
    }
  } else if (contract.zone !== 'RAW') {
    issues.push('curated/semantic datasets require retrieval timestamp');
  }
  const contractHash = createHash('sha256').update(canonicalize(contract)).digest('hex');
  return {
    datasetId: contract.datasetId,
    accepted: issues.length === 0,
    status: issues.length === 0 ? 'PASS' : contract.quality.status === 'PASS' ? 'STALE' : contract.quality.status,
    issues,
    contractHash,
    ageSeconds,
  };
}

export function promoteZone(contract: DatasetContract, target: FabricZone): DatasetContract {
  if (target === 'RAW') return { ...contract, zone: 'RAW' };
  const assessment = assessDataset(contract);
  if (!assessment.accepted) throw new Error(`DATASET_PROMOTION_REJECTED:${assessment.issues.join('|')}`);
  if (!contract.lineage.contentHash) throw new Error('DATASET_PROMOTION_REJECTED:contentHash required');
  if (!contract.lineage.retrievedAt) throw new Error('DATASET_PROMOTION_REJECTED:retrievedAt required');
  return { ...contract, zone: target };
}
