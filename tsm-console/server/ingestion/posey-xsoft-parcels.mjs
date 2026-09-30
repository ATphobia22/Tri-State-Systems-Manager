import { requestJson } from './http-client.mjs';

export const XSOFT_POSEY_PARCEL_SEARCH_URL = 'https://engage.xsoftinc.com/posey/map/getparcellist';
export const XSOFT_POSEY_ARCGIS_FEATURE_LAYER = 'https://services6.arcgis.com/y6TIO0vqbm8Ixd4w/ArcGIS/rest/services/Posey_Parcels_(Public)/FeatureServer/0';

export function normalizePoseyParcelId(parcelId) {
  const normalized = String(parcelId ?? '').replace(/[^0-9]/g, '');
  if (normalized.length !== 18) throw new TypeError('Posey parcel identifier must contain 18 digits');
  return normalized;
}

export async function searchPoseyXSoft({ searchEnvelope = 'Posey County', signal, request = requestJson } = {}) {
  const url = new URL(XSOFT_POSEY_PARCEL_SEARCH_URL);
  url.searchParams.set('search-envelop', searchEnvelope);
  return request(url, { signal, sourceId: 'POSEY-XSOFT-PARCELS', timeoutMs: 20000, maxBytes: 8000000 });
}

export async function getPoseyParcelGeometry(parcelId, { signal, request = requestJson } = {}) {
  const stateCombi = normalizePoseyParcelId(parcelId);
  const url = new URL(XSOFT_POSEY_ARCGIS_FEATURE_LAYER + '/query');
  url.searchParams.set('where', "StateCombi='" + stateCombi + "'");
  url.searchParams.set('outFields', '*');
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('f', 'geojson');
  const payload = await request(url, {
    signal, sourceId: 'POSEY-XSOFT-ARCGIS-PARCELS', timeoutMs: 20000, maxBytes: 8000000,
  });
  if (payload?.type !== 'FeatureCollection' || !Array.isArray(payload.features)) throw new TypeError('Posey parcel geometry response must be GeoJSON FeatureCollection');
  if (payload.features.length !== 1) throw new Error('Posey parcel geometry query expected exactly one feature, received ' + payload.features.length);
  const feature = payload.features[0];
  if (!feature.geometry) throw new Error('Posey parcel feature has no geometry');
  return Object.freeze({
    parcelId: stateCombi, sourceUri: url.toString(), crs: 'EPSG:4326', feature,
    geometry: feature.geometry, attributes: feature.properties ?? {}, retrievedAt: new Date().toISOString(),
  });
}
