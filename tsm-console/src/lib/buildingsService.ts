/**
 * Community building footprint service.
 * No private residence fallback geometry is embedded in the application.
 */

export interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    id: string;
    height?: number;
    levels?: number;
    name?: string;
    source?: string;
    [key: string]: unknown;
  };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export type BBox = [number, number, number, number];

const EMPTY_FC: GeoJSONFeatureCollection = { type: 'FeatureCollection', features: [] };

export function normalizeBuildingHeight(props: Record<string, unknown>): number {
  const levels = (props.levels ?? props.BuildingLevels ?? props.num_floors) as number | undefined;
  if (typeof levels === 'number' && levels > 0) return levels * 3.2;
  return (props.height as number | undefined) ?? 7.2;
}

function enrichHeights(fc: GeoJSONFeatureCollection): GeoJSONFeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => ({
      ...f,
      properties: { ...f.properties, height_m: normalizeBuildingHeight(f.properties) },
    })),
  };
}

async function fetchPublishedIgIoBuildings(bbox: BBox): Promise<GeoJSONFeatureCollection> {
  const res = await fetch('/data/posey-buildings-igio-enriched.geojson');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as {
    type: string;
    features: Array<{ geometry: GeoJSONFeature['geometry']; properties?: Record<string, unknown> }>;
  };
  if (raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) return EMPTY_FC;

  const [xmin, ymin, xmax, ymax] = bbox;
  const features = raw.features
    .filter((feature) => {
      const coordinates = feature.geometry?.coordinates.flat(2) ?? [];
      const xs = coordinates.filter((v): v is number => typeof v === 'number').filter((_, i) => i % 2 === 0);
      const ys = coordinates.filter((v): v is number => typeof v === 'number').filter((_, i) => i % 2 === 1);
      if (!xs.length || !ys.length) return false;
      return Math.max(...xs) >= xmin && Math.min(...xs) <= xmax &&
        Math.max(...ys) >= ymin && Math.min(...ys) <= ymax;
    })
    .map((feature) => ({
      type: 'Feature' as const,
      geometry: feature.geometry,
      properties: {
        id: String(feature.properties?.igioObjectId ?? ''),
        source: 'Indiana GIO Building Footprints 2016-2020',
        ...(feature.properties ?? {}),
      },
    }));

  return enrichHeights({ type: 'FeatureCollection', features });
}

export async function fetchBuildings(bbox: BBox): Promise<GeoJSONFeatureCollection> {
  try {
    const params = new URLSearchParams({
      xmin: String(bbox[0]),
      ymin: String(bbox[1]),
      xmax: String(bbox[2]),
      ymax: String(bbox[3]),
    });
    const res = await fetch(`/api/gis/buildings?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as GeoJSONFeatureCollection;
    if (data?.features?.length) return enrichHeights(data);
    return await fetchPublishedIgIoBuildings(bbox);
  } catch {
    try {
      return await fetchPublishedIgIoBuildings(bbox);
    } catch {
      return EMPTY_FC;
    }
  }
}

export { EMPTY_FC };
