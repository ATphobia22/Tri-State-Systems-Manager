/**
 * Interpret only an explicit, informational 3D-tiles coverage declaration.
 * A numeric count match is never proof of source identity or engineering quality.
 */
export interface BuildingCoverageSummary {
  published: number;
  expected: number;
  gap: number;
  percent: number;
  identityReconciled: boolean;
  sourceInventoryVerified: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parsePublishedBuildingCoverage(value: unknown): BuildingCoverageSummary | null {
  const root = asRecord(value);
  const asset = asRecord(root?.asset);
  const extras = asRecord(asset?.extras);
  const tsm = asRecord(extras?.tsm);
  if (!tsm || tsm.authorityClass !== 'DERIVED' ||
      tsm.engineeringUse !== false || tsm.regulatoryUse !== false) {
    return null;
  }
  const published = tsm.publishedFeatureCount;
  const expected = tsm.expectedAuthoritativeFeatureCount;
  if (!Number.isSafeInteger(published) || !Number.isSafeInteger(expected) ||
      typeof published !== 'number' || typeof expected !== 'number' ||
      published < 0 || expected <= 0) {
    return null;
  }
  return {
    published,
    expected,
    gap: expected - published,
    percent: (published / expected) * 100,
    identityReconciled: tsm.sourceIdsReconciled === true,
    sourceInventoryVerified: tsm.sourceInventoryVerified === true,
  };
}
