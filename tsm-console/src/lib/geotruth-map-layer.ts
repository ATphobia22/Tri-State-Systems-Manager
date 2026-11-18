/**
 * GeoTruth map staging contract. This is informational QA of *published*
 * screening geometry, not acquisition, survey control, roof validation,
 * 3D Tiles content or a NAVD88 transformation.
 */
export const GEOTRUTH_QA_STATUS = {
  estimated: 'HEIGHT_ESTIMATE_UNVERIFIED',
  notEvidenced: 'HEIGHT_NOT_EVIDENCED',
  invalid: 'HEIGHT_INVALID',
  aliasConflict: 'SOURCE_ID_CONFLICT',
  duplicate: 'DUPLICATE_SOURCE_ID',
  missingId: 'SOURCE_ID_UNAVAILABLE',
} as const;

export const GEOTRUTH_SOURCE_ID = 'tsm-geotruth-qa-source';
export const GEOTRUTH_FILL_ID = 'tsm-geotruth-qa-fill';
export const GEOTRUTH_OUTLINE_ID = 'tsm-geotruth-qa-outline';
const MAX_FEATURES = 30000;

type QaStatus = typeof GEOTRUTH_QA_STATUS[keyof typeof GEOTRUTH_QA_STATUS];
type Props = Record<string, unknown>;
type Geometry = { type: string; coordinates: unknown };
type QaFeature = {
  type: 'Feature';
  geometry: Geometry;
  properties: {
    sourceObjectId: number | null;
    qaStatus: QaStatus;
    estimatedHeightM: number | null;
    heightEvidence: 'DERIVED_OR_IMPORTED_NOT_SURVEYED';
    verticalDatumVerified: false;
    sourceLineageIndependentlyVerified: false;
  };
};

const idKeys = ['igioObjectId', 'sourceObjectId', 'OBJECTID', 'objectid', 'source_object_id'] as const;

function numericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d{1,16}$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function featureId(props: Props): { id: number | null; conflicting: boolean } {
  const ids = idKeys.map((key) => numericId(props[key])).filter((id): id is number => id !== null);
  return { id: ids[0] ?? null, conflicting: new Set(ids).size > 1 };
}

export function buildGeoTruthMapData(payload: unknown): {
  data: { type: 'FeatureCollection'; features: QaFeature[] };
  counts: Record<QaStatus, number>;
  omittedNonPolygons: number;
  sourceFeatureCount: number;
  scientificValidation: false;
} {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Expected GeoJSON FeatureCollection');
  const root = payload as { type?: unknown; features?: unknown };
  if (root.type !== 'FeatureCollection' || !Array.isArray(root.features) ||
      root.features.length === 0 || root.features.length > MAX_FEATURES) {
    throw new Error('GeoTruth feature limit exceeded, empty, or not a FeatureCollection');
  }
  type Candidate = { id: number | null; conflicting: boolean; height: unknown; geometry: Geometry };
  const candidates: Candidate[] = [];
  let omittedNonPolygons = 0;
  for (const value of root.features) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { omittedNonPolygons++; continue; }
    const f = value as { type?: unknown; properties?: unknown; geometry?: unknown };
    if (f.type !== 'Feature' || !f.geometry || typeof f.geometry !== 'object' ||
        !['Polygon', 'MultiPolygon'].includes((f.geometry as Geometry).type) ||
        !Array.isArray((f.geometry as Geometry).coordinates)) {
      omittedNonPolygons++;
      continue;
    }
    const props: Props = f.properties && typeof f.properties === 'object' &&
      !Array.isArray(f.properties) ? f.properties as Props : {};
    candidates.push({ ...featureId(props), height: props.height_m, geometry: f.geometry as Geometry });
  }
  const identityCount = new Map<number, number>();
  for (const c of candidates) if (c.id !== null && !c.conflicting)
    identityCount.set(c.id, (identityCount.get(c.id) ?? 0) + 1);

  const counts = Object.fromEntries(
    Object.values(GEOTRUTH_QA_STATUS).map((name) => [name, 0])
  ) as Record<QaStatus, number>;
  const features: QaFeature[] = candidates.map((entry) => {
    let qaStatus: QaStatus = GEOTRUTH_QA_STATUS.notEvidenced;
    const number = entry.height;
    let height: number | null = null;
    if (entry.conflicting) qaStatus = GEOTRUTH_QA_STATUS.aliasConflict;
    else if (entry.id === null) qaStatus = GEOTRUTH_QA_STATUS.missingId;
    else if ((identityCount.get(entry.id) ?? 0) > 1) qaStatus = GEOTRUTH_QA_STATUS.duplicate;
    else if (number !== null && number !== undefined) {
      if (typeof number === 'number' && Number.isFinite(number) && number > 0) {
        qaStatus = GEOTRUTH_QA_STATUS.estimated;
        height = number;
      } else qaStatus = GEOTRUTH_QA_STATUS.invalid;
    }
    counts[qaStatus]++;
    return {
      type: 'Feature',
      geometry: entry.geometry,
      properties: {
        sourceObjectId: entry.conflicting ? null : entry.id,
        qaStatus,
        estimatedHeightM: height,
        heightEvidence: 'DERIVED_OR_IMPORTED_NOT_SURVEYED',
        verticalDatumVerified: false,
        sourceLineageIndependentlyVerified: false,
      },
    };
  });
  if (!features.length) throw new Error('No supported building polygons in GeoTruth source');
  return {
    data: { type: 'FeatureCollection', features },
    counts,
    omittedNonPolygons,
    sourceFeatureCount: root.features.length,
    scientificValidation: false,
  };
}
