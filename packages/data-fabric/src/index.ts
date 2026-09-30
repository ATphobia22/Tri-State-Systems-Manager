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
}

export interface DatasetContract {
  readonly datasetId: string;
  readonly title: string;
  readonly owner: string;
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
}

export function assessDataset(contract: DatasetContract, now = new Date()): DatasetAssessment {
  const issues: string[] = [];
  if (!contract.datasetId.trim()) issues.push('datasetId is required');
  if (!contract.title.trim()) issues.push('title is required');
  if (!contract.owner.trim()) issues.push('owner is required');
  if (contract.authority === 'DISCOVERY_ONLY') issues.push('discovery-only datasets cannot become authoritative');
  if (contract.quality.status !== 'PASS') issues.push(`quality status is ${contract.quality.status}`);
  if (contract.maxAgeSeconds !== undefined && contract.updateCadenceSeconds !== undefined) {
    if (contract.maxAgeSeconds < contract.updateCadenceSeconds) issues.push('maxAgeSeconds must be >= updateCadenceSeconds');
  }
  if (!contract.lineage.contentHash && contract.zone !== 'RAW') issues.push('curated/semantic datasets require contentHash lineage');
  if (contract.maxAgeSeconds !== undefined && contract.lineage.sourceUri) {
    const retrieval = contract.lineage.sourceUri;
    if (!retrieval) issues.push('source URI is empty');
  }
  const canonical = JSON.stringify(contract, Object.keys(contract).sort());
  const contractHash = createHash('sha256').update(canonical).digest('hex');
  return {
    datasetId: contract.datasetId,
    accepted: issues.length === 0,
    status: issues.length === 0 ? 'PASS' : contract.quality.status,
    issues,
    contractHash,
  };
}

export function promoteZone(contract: DatasetContract, target: FabricZone): DatasetContract {
  if (target === 'RAW') return { ...contract, zone: 'RAW' };
  const assessment = assessDataset(contract);
  if (!assessment.accepted) throw new Error(`DATASET_PROMOTION_REJECTED:${assessment.issues.join('|')}`);
  if (!contract.lineage.contentHash) throw new Error('DATASET_PROMOTION_REJECTED:contentHash required');
  return { ...contract, zone: target };
}
