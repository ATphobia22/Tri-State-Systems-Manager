export const ONTOLOGY_VERSION = '1.0.0' as const;

export type EntityKind =
  | 'river' | 'levee' | 'road' | 'parcel' | 'building' | 'utility'
  | 'vehicle' | 'sensor' | 'household' | 'business' | 'agency'
  | 'program' | 'permit' | 'process';

export type RelationshipKind =
  | 'SERVED_BY' | 'MONITORS' | 'FUNDS' | 'CONSTRAINS'
  | 'LOCATED_IN' | 'CONNECTED_TO' | 'PROTECTS' | 'AFFECTS'
  | 'PART_OF' | 'DERIVED_FROM';

export interface TemporalInterval {
  readonly validFrom: string;
  readonly validTo?: string;
}

export interface SpatialReference {
  readonly crs: string;
  readonly geometryRef?: string;
}

export interface TwinEntity {
  readonly entityId: string;
  readonly kind: EntityKind;
  readonly name?: string;
  readonly spatial?: SpatialReference;
  readonly validTime: TemporalInterval;
  readonly attributes: Readonly<Record<string, string | number | boolean | null>>;
  readonly sourceDatasetIds: readonly string[];
}

export interface TwinRelationship {
  readonly relationshipId: string;
  readonly subjectEntityId: string;
  readonly predicate: RelationshipKind;
  readonly objectEntityId: string;
  readonly validTime: TemporalInterval;
  readonly sourceDatasetIds: readonly string[];
}

export interface StateObservation {
  readonly entityId: string;
  readonly observedAt: string;
  readonly observedValue: string | number | boolean | null;
  readonly unit?: string;
  readonly datasetId: string;
  readonly evidenceId?: string;
}

export function validateTwinEntity(entity: TwinEntity): string[] {
  const issues: string[] = [];
  if (!entity.entityId.trim()) issues.push('entityId is required');
  if (!entity.kind) issues.push('kind is required');
  if (!entity.validTime.validFrom) issues.push('validTime.validFrom is required');
  if (!Array.isArray(entity.sourceDatasetIds) || entity.sourceDatasetIds.length === 0) {
    issues.push('sourceDatasetIds must contain at least one dataset');
  }
  return issues;
}

export function validateTwinRelationship(
  relationship: TwinRelationship,
  entityIds: ReadonlySet<string>,
): string[] {
  const issues: string[] = [];
  if (!entityIds.has(relationship.subjectEntityId)) issues.push('subjectEntityId does not exist');
  if (!entityIds.has(relationship.objectEntityId)) issues.push('objectEntityId does not exist');
  if (relationship.subjectEntityId === relationship.objectEntityId) issues.push('self relationships are not permitted');
  if (!relationship.validTime.validFrom) issues.push('validTime.validFrom is required');
  return issues;
}
