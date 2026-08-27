/**
 * PTDT v35 — Building Footprint & Extrusion Service
 * Offline-safe fallback for 13101 Bonebank Road.
 */
import { BONEBANK_SITE } from "./siteConstants";

export interface GeoJSONFeature {
  type: "Feature";
  properties: {
    id: string;
    height?: number;
    levels?: number;
    name?: string;
    source?: string;
    [key: string]: unknown;
  };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export type BBox = [number, number, number, number];

const EMPTY_FC: GeoJSONFeatureCollection = { type: "FeatureCollection", features: [] };

export function normalizeBuildingHeight(props: Record<string, unknown>): number {
  const levels = (props.levels ?? props.BuildingLevels ?? props.num_floors) as number | undefined;
  if (typeof levels === "number" && levels > 0) return levels * 3.2;
  return (props.height as number | undefined) ?? 7.2;
}

export function getLocalBonebankBuildings(): GeoJSONFeatureCollection {
  const lon = BONEBANK_SITE.lon;
  const lat = BONEBANK_SITE.lat;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          id: "ms-bonebank-residence",
          name: "13101 Bonebank Rd Homestead",
          height: 7.2,
          levels: 2,
          source: "local-survey-gltf-aligned",
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [lon - 0.0003, lat - 0.0002],
            [lon + 0.0003, lat - 0.0002],
            [lon + 0.0003, lat + 0.0002],
            [lon - 0.0003, lat + 0.0002],
            [lon - 0.0003, lat - 0.0002],
          ]],
        },
      },
    ],
  };
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

export async function fetchBuildings(
  bbox: BBox = BONEBANK_SITE.bbox
): Promise<GeoJSONFeatureCollection> {
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
    if (!data?.features?.length) return enrichHeights(getLocalBonebankBuildings());
    return enrichHeights(data);
  } catch {
    return enrichHeights(getLocalBonebankBuildings());
  }
}

export { EMPTY_FC };
