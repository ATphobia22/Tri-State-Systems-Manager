import type { TwinEntity, TwinRelationship, StateObservation } from '../../ontology/src/index.ts';
import { validateTwinEntity, validateTwinRelationship } from '../../ontology/src/index.ts';

export interface TwinState {
  readonly stateId: string;
  readonly effectiveAt: string;
  readonly entities: readonly TwinEntity[];
  readonly relationships: readonly TwinRelationship[];
  readonly observations: readonly StateObservation[];
  readonly sourceDatasetIds: readonly string[];
}

export interface TwinScenario {
  readonly scenarioId: string;
  readonly parentStateId: string;
  readonly createdAt: string;
  readonly assumptions: Readonly<Record<string, number | string | boolean>>;
  readonly interventions: readonly {
    readonly entityId: string;
    readonly attribute: string;
    readonly value: string | number | boolean | null;
  }[];
}

export function validateTwinState(state: TwinState): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const entity of state.entities) {
    issues.push(...validateTwinEntity(entity).map((issue) => `entity:${issue}`));
    if (ids.has(entity.entityId)) issues.push(`duplicate entityId:${entity.entityId}`);
    ids.add(entity.entityId);
  }
  for (const relationship of state.relationships) {
    issues.push(...validateTwinRelationship(relationship, ids).map((issue) => `relationship:${issue}`));
  }
  if (!state.stateId.trim()) issues.push('stateId is required');
  if (!state.effectiveAt) issues.push('effectiveAt is required');
  return issues;
}

export function createScenario(state: TwinState, scenario: TwinScenario): TwinScenario {
  const issues = validateTwinState(state);
  if (issues.length) throw new Error(`TWIN_STATE_INVALID:${issues.join('|')}`);
  if (scenario.parentStateId !== state.stateId) throw new Error('SCENARIO_PARENT_STATE_MISMATCH');
  return Object.freeze({ ...scenario, assumptions: Object.freeze({ ...scenario.assumptions }) });
}
