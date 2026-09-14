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
    if (!data?.features?.length) return EMPTY_FC;
    return enrichHeights(data);
  } catch {
    return EMPTY_FC;
  }
}

export { EMPTY_FC };
