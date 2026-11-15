/**
 * Optional local FGDC geologic pattern registration for a real, attributed
 * geology polygon layer. This does not create or infer geology data.
 *
 * Source: davenquinn/geologic-patterns, assets/svg/101-C.svg (CC0-1.0).
 * Use only in the headed MapLibre renderer, never in ingestion/CI.
 */
import type { Map as MapLibreMap } from 'maplibre-gl';

export const FGDC_GEOLOGY_101_C = Object.freeze({
  id: 'tsm-fgdc-geology-101-c',
  code: '101-C',
  localAsset: 'geology/fgdc/101-C.svg',
  sourceRepository: 'https://github.com/davenquinn/geologic-patterns',
  license: 'CC0-1.0',
  geologicMeaning: 'NOT_ASSIGNED_WITHOUT_AUTHORITATIVE_MAP_LEGEND',
  status: 'BUNDLED_ASSET_NOT_VISUALLY_VALIDATED',
});

export async function registerLocalFGDCGeologyPattern(
  map: Pick<MapLibreMap, 'hasImage' | 'addImage'>,
): Promise<string> {
  if (!map.hasImage(FGDC_GEOLOGY_101_C.id)) {
    // MapLibre's loadImage accepts raster URLs. Decode the local SVG with
    // the browser and register its image without an external asset request.
    const image = new Image();
    image.src = import.meta.env.BASE_URL + FGDC_GEOLOGY_101_C.localAsset;
    await image.decode();
    if (!map.hasImage(FGDC_GEOLOGY_101_C.id)) {
      map.addImage(FGDC_GEOLOGY_101_C.id, image);
    }
  }
  return FGDC_GEOLOGY_101_C.id;
}

/** Apply only to an already-authorized geology vector layer. */
export function fgdcGeologicFillPaint(patternId = FGDC_GEOLOGY_101_C.id) {
  return { 'fill-pattern': patternId, 'fill-opacity': 0.78 } as const;
}
