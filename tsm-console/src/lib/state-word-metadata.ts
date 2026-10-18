/**
 * Runtime bridge from glTF EXT_mesh_features / EXT_structural_metadata to the
 * TSM state-word codec. This module only reads the canonical `stateWord`
 * property; legacy OBJECTID-only property tables intentionally return null.
 */
import { assertValidStateWord } from './state-word-codec';

export interface MeshFeatureInfo {
  label?: string | null;
  propertyTable: number | null;
  nullFeatureId?: number | null;
}

export interface MeshFeaturesReader {
  getFeatureInfo(): MeshFeatureInfo[];
}

export interface StructuralMetadataReader {
  getPropertyTableData(
    tableIndices: number[],
    ids: number[],
    target?: unknown[],
  ): unknown[];
  getPropertyTableInfo(tableIndices: number[] | null): Array<{ name: string; className: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read a TSM state word from the feature's structural-metadata property table.
 * Returns null when the asset has no stateWord property, preserving legacy
 * geometry rendering without inventing scheduling values.
 */
export function decodeFeatureStateWord(
  metadata: StructuralMetadataReader,
  meshFeatures: MeshFeaturesReader,
  featureId: number,
): number | null {
  if (!Number.isSafeInteger(featureId) || featureId < 0) {
    throw new RangeError(`Feature ID must be a non-negative safe integer; received ${featureId}`);
  }

  for (const featureInfo of meshFeatures.getFeatureInfo()) {
    const tableIndex = featureInfo.propertyTable;
    if (!Number.isInteger(tableIndex) || tableIndex === null || tableIndex < 0) continue;

    const rows = metadata.getPropertyTableData([tableIndex], [featureId], []);
    const row = rows[0];
    if (!isRecord(row) || !Object.hasOwn(row, 'stateWord')) continue;

    // `stateWord` is the canonical TSM property. `StateWord` is accepted
    // for older source schemas that used PascalCase; both are uint16 values.
    const word = Object.hasOwn(row, 'stateWord') ? row.stateWord : row.StateWord;
    if (typeof word !== 'number') {
      throw new TypeError(`Structural metadata stateWord must be a number; received ${typeof word}`);
    }
    assertValidStateWord(word);
    return word;
  }

  return null;
}
