/**
 * Community building footprint service.
 * No private residence fallback geometry is embedded in the application.
 */

import {
  attachStateWordToFeatureProperties,
  STATE_WORD_DEFAULT,
  StateWordDecoder,
} from '../geospatial/state-word';

export type BBox = [number, number, number, number];

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: Record<string, unknown> & {
    height?: number;
    height_m?: number;
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

const EMPTY_FC: GeoJSONFeatureCollection = { type: 'FeatureCollection', features: [] };

export function normalizeBuildingHeight(props: Record<string, unknown>): number {
  const hm = props.height_m ?? props.heightM;
  if (typeof hm === 'number' && Number.isFinite(hm) && hm > 0) return hm;
  const h = props.height;
  if (typeof h === 'number' && Number.isFinite(h) && h > 0) return h;
  const levels = (props.levels ?? props.BuildingLevels ?? props.num_floors) as number | undefined;
  if (typeof levels === 'number' && levels > 0) return levels * 3.2;
  return 7.2;
}

function enrichHeights(fc: GeoJSONFeatureCollection): GeoJSONFeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => ({
      ...f,
      properties: attachStateWordToFeatureProperties(
        { ...f.properties, height_m: normalizeBuildingHeight(f.properties) },
        STATE_WORD_DEFAULT,
      ),
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
      return (
        Math.max(...xs) >= xmin &&
        Math.min(...xs) <= xmax &&
        Math.max(...ys) >= ymin &&
        Math.min(...ys) <= ymax
      );
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

export function degradeBuildingStateWord(
  feature: GeoJSONFeature,
  vramUsageRatio: number,
  bandwidthMbps: number,
): number {
  const current =
    typeof feature.properties.tsmStateWord === 'number'
      ? feature.properties.tsmStateWord
      : StateWordDecoder.encode(STATE_WORD_DEFAULT);
  return StateWordDecoder.evaluateDegradation(current, vramUsageRatio, bandwidthMbps);
}

export { EMPTY_FC, StateWordDecoder, STATE_WORD_DEFAULT };
