/**
 * scenarios.ts — flood-sim scenario registry.
 *
 * Loads the JSON scenarios in `data/scenarios/`, validates each against
 * `data/schemas/flood-sim-scenario.schema.json` with the small structural
 * validator below (subset of JSON Schema draft 2020-12 — no external
 * dependency), and maps scenarios to `FloodSimEngineConfig`.
 *
 * Historical-data honesty is structural: `getScenario()` throws on a
 * scenario that fails schema validation, and every scenario carries
 * `source`, `provenance`, `humanReviewRequired`, and `provisionalFields`.
 */

import { generateElevationGrid } from './world/terrain';
import { seedFromString } from './prng';
import type { FloodSimEngineConfig, EngineStructure } from './engine';
import type { OccupancyType } from '../hazus-depth-damage';

import scenario1937 from '../../../../data/scenarios/1937-ohio-river-flood.json';
import scenarioQ100 from '../../../../data/scenarios/q100-design-event.json';
import floodSimSchema from '../../../../data/schemas/flood-sim-scenario.schema.json';

// ---------------------------------------------------------------------------
// Types (mirror the JSON schema)
// ---------------------------------------------------------------------------

export interface ScenarioSourcedValue {
  field: string;
  value: number;
  unit: string;
  source: string;
}

export interface ScenarioStructure {
  id: string;
  name: string;
  occupancyType: OccupancyType;
  cellRow: number;
  cellCol: number;
  firstFloorElevFt: number;
  structureValueUsd: number;
  contentsValueUsd?: number;
}

export interface ScenarioEngineSpec {
  seed: number | string;
  nx: number;
  ny: number;
  dxFt: number;
  manningN: number;
  durationHrs: number;
  curveNumber: number;
  watershedAreaSqMi: number;
  terrain: {
    type: 'procedural' | 'flat';
    baseElevFt?: number;
    valleyReliefFt?: number;
    noiseAmplitudeFt?: number;
    octaves?: number;
    elevFt?: number;
  };
  gaugeDriven: boolean;
  hyetograph: { timeHrs: number[]; intensityInPerHr: number[] } | null;
  structures?: ScenarioStructure[];
}

export interface FloodSimScenario {
  scenarioId: string;
  title: string;
  description: string;
  source: string;
  provenance: string;
  humanReviewRequired: boolean;
  provisional: boolean;
  provisionalFields: string[];
  sourcedValues?: ScenarioSourcedValue[];
  engine: ScenarioEngineSpec;
  display?: { defaultTimeScale?: number; defaultQuality?: string };
}

// ---------------------------------------------------------------------------
// Minimal JSON-Schema validator (subset of draft 2020-12)
// ---------------------------------------------------------------------------

type JsonSchema = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  pattern?: string;
  additionalProperties?: boolean;
  anyOf?: JsonSchema[];
};

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function matchesType(v: unknown, t: string): boolean {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  if (t === 'integer') return actual === 'integer';
  return actual === t;
}

/**
 * Validate `data` against a subset-schema. Returns a list of error strings
 * (empty = valid). Supports: type, required, properties, items, enum,
 * minimum/maximum, exclusiveMinimum/exclusiveMaximum, minItems/maxItems,
 * minLength, pattern, additionalProperties:false, anyOf.
 */
export function validateAgainstSchema(data: unknown, schema: JsonSchema, path = '$'): string[] {
  const errors: string[] = [];
  const types = Array.isArray(schema.type) ? schema.type : schema.type !== undefined ? [schema.type] : [];

  if (types.length > 0 && !types.some((t) => matchesType(data, t))) {
    errors.push(`${path}: expected type ${types.join('|')}, got ${typeOf(data)}`);
    return errors;
  }

  if (schema.enum !== undefined && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(data))) {
    errors.push(`${path}: value not in enum ${JSON.stringify(schema.enum)}`);
  }

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) errors.push(`${path}: ${data} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum) errors.push(`${path}: ${data} > maximum ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) {
      errors.push(`${path}: ${data} <= exclusiveMinimum ${schema.exclusiveMinimum}`);
    }
    if (schema.exclusiveMaximum !== undefined && data >= schema.exclusiveMaximum) {
      errors.push(`${path}: ${data} >= exclusiveMaximum ${schema.exclusiveMaximum}`);
    }
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: string does not match pattern ${schema.pattern}`);
    }
  }

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${path}: array shorter than minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push(`${path}: array longer than maxItems ${schema.maxItems}`);
    }
    if (schema.items) {
      data.forEach((item, i) => {
        errors.push(...validateAgainstSchema(item, schema.items as JsonSchema, `${path}[${i}]`));
      });
    }
  }

  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) errors.push(`${path}: missing required property '${key}'`);
    }
    const props = schema.properties ?? {};
    for (const [key, value] of Object.entries(obj)) {
      if (key in props) {
        errors.push(...validateAgainstSchema(value, props[key], `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: additional property '${key}' not allowed`);
      }
    }
  }

  if (schema.anyOf !== undefined) {
    const ok = schema.anyOf.some((sub) => validateAgainstSchema(data, sub, path).length === 0);
    if (!ok) errors.push(`${path}: does not match anyOf`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const RAW_SCENARIOS: unknown[] = [scenario1937, scenarioQ100];

/** Validate a raw scenario object; returns error strings (empty = valid). */
export function validateScenario(data: unknown): string[] {
  const errors = validateAgainstSchema(data, floodSimSchema as JsonSchema);
  const s = data as Partial<FloodSimScenario>;
  if (errors.length === 0 && s && typeof s === 'object') {
    if (s.provisional === false && (s.provisionalFields?.length ?? 0) > 0) {
      errors.push('$.provisionalFields: must be empty when provisional=false');
    }
    if (s.provisional === true && (s.provisionalFields?.length ?? 0) === 0) {
      errors.push('$.provisionalFields: provisional=true requires a non-empty provisionalFields list');
    }
    if (s.humanReviewRequired !== true) {
      errors.push('$.humanReviewRequired: must be true — human authority remains final');
    }
    if (s.engine?.gaugeDriven === true && s.engine?.hyetograph !== null) {
      errors.push('$.engine.hyetograph: gauge-driven scenarios must set hyetograph=null (no fixed values)');
    }
  }
  return errors;
}

/** All shipped scenarios, validated (throws on any invalid scenario). */
export function listScenarios(): FloodSimScenario[] {
  return RAW_SCENARIOS.map((raw) => {
    const errors = validateScenario(raw);
    if (errors.length > 0) {
      throw new Error(
        `[flood-sim-scenarios] scenario failed schema validation:\n${errors.join('\n')}`,
      );
    }
    return raw as FloodSimScenario;
  });
}

/** Fetch one scenario by id (throws on unknown id or validation failure). */
export function getScenario(scenarioId: string): FloodSimScenario {
  const found = listScenarios().find((s) => s.scenarioId === scenarioId);
  if (!found) {
    const known = listScenarios().map((s) => s.scenarioId).join(', ');
    throw new Error(`[flood-sim-scenarios] unknown scenario ${JSON.stringify(scenarioId)} (known: ${known})`);
  }
  return found;
}

/** Numeric seed for the engine: integers pass through, strings are hashed. */
export function scenarioSeed(scenario: FloodSimScenario): number {
  const seed = scenario.engine.seed;
  return typeof seed === 'string' ? seedFromString(seed) : seed >>> 0;
}

/**
 * Map a scenario to a deterministic engine config. The elevation grid is
 * built from the scenario's terrain spec (procedural ⇒ seeded value noise;
 * flat ⇒ constant) with the scenario seed — same scenario ⇒ same grid.
 */
export function scenarioToEngineConfig(scenario: FloodSimScenario): FloodSimEngineConfig {
  const eng = scenario.engine;
  const seed = scenarioSeed(scenario);
  const t = eng.terrain;

  const elevationFt =
    t.type === 'flat'
      ? Array.from({ length: eng.ny }, () =>
          Array.from({ length: eng.nx }, () => (t.elevFt ?? 375)),
        )
      : generateElevationGrid({
          nx: eng.nx,
          ny: eng.ny,
          dxFt: eng.dxFt,
          seed,
          baseElevFt: t.baseElevFt ?? 375,
          valleyReliefFt: t.valleyReliefFt ?? 8,
          noiseAmplitudeFt: t.noiseAmplitudeFt ?? 2,
          octaves: t.octaves ?? 3,
        });

  // Gauge-driven scenarios ship a dry hyetograph; the operator supplies
  // rainfall at runtime via engine.overrideRainfallIntensity().
  const hyetograph = eng.gaugeDriven
    ? { timeHrs: [0, eng.durationHrs], intensityInPerHr: [0, 0] }
    : eng.hyetograph;

  if (!hyetograph) {
    throw new Error(`[flood-sim-scenarios] scenario ${scenario.scenarioId}: non-gauge-driven scenario requires a hyetograph`);
  }

  const structures: EngineStructure[] = (eng.structures ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    occupancyType: s.occupancyType,
    cellRow: s.cellRow,
    cellCol: s.cellCol,
    firstFloorElevFt: s.firstFloorElevFt,
    structureValueUsd: s.structureValueUsd,
    contentsValueUsd: s.contentsValueUsd,
  }));

  return {
    scenarioId: scenario.scenarioId,
    seed,
    nx: eng.nx,
    ny: eng.ny,
    dxFt: eng.dxFt,
    elevationFt,
    manningN: eng.manningN,
    rainfallTimeHrs: hyetograph.timeHrs,
    rainfallIntensityInPerHr: hyetograph.intensityInPerHr,
    curveNumber: eng.curveNumber,
    watershedAreaSqMi: eng.watershedAreaSqMi,
    durationHrs: eng.durationHrs,
    structures,
  };
}
