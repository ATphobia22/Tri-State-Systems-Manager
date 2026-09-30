import { requestJson } from './http-client.mjs';
import { getPoseyParcelGeometry } from './posey-xsoft-parcels.mjs';
import { queryFemaNfhl } from './fema-nfhl.mjs';
import { queryOpenFema } from './openfema.mjs';

export const INDIANA_BAFL_MAPSERVER = 'https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer';
export const USGS_EPQS_URL = 'https://epqs.nationalmap.gov/v1/json';

function polygonCentroid(geometry) {
  if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates?.[0])) throw new TypeError('parcel polygon required for centroid calculation');
  const ring = geometry.coordinates[0];
  if (ring.length < 4) throw new TypeError('parcel polygon ring is too short');
  let area2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    area2 += cross; cx += (x1 + x2) * cross; cy += (y1 + y2) * cross;
  }
  if (Math.abs(area2) < Number.EPSILON) {
    const sum = ring.reduce((a, p) => ({ x: a.x + p[0], y: a.y + p[1] }), { x: 0, y: 0 });
    return [sum.x / ring.length, sum.y / ring.length];
  }
  return [cx / (3 * area2), cy / (3 * area2)];
}

async function queryIndianaBafl(geometry, { signal, request }) {
  const url = new URL(INDIANA_BAFL_MAPSERVER + '/438/query');
  url.searchParams.set('geometry', JSON.stringify(geometry));
  url.searchParams.set('geometryType', 'esriGeometryPolygon');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', '*');
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('f', 'json');
  return request(url, { signal, sourceId: 'INDIANA-DNR-BAFL', timeoutMs: 20000, maxBytes: 8000000 });
}

async function queryUsgsElevation(point, { signal, request }) {
  const [x, y] = point;
  const url = new URL(USGS_EPQS_URL);
  url.searchParams.set('x', String(x)); url.searchParams.set('y', String(y));
  url.searchParams.set('wkid', '4326'); url.searchParams.set('units', 'Feet'); url.searchParams.set('includeDate', 'True');
  const payload = await request(url, { signal, sourceId: 'USGS-3DEP-EPQS', timeoutMs: 20000, maxBytes: 1000000 });
  if (!Number.isFinite(Number(payload?.value))) throw new Error('USGS EPQS did not return a numeric elevation');
  return payload;
}

export async function buildPoseySpatialChain(parcelId, { signal, request = requestJson, includeOpenFemaCommunity = false } = {}) {
  const parcel = await getPoseyParcelGeometry(parcelId, { signal, request });
  const centroid = polygonCentroid(parcel.geometry);
  const [femaPanels, femaZones, indianaBafl, elevation] = await Promise.all([
    queryFemaNfhl({ layerId: 3, geometry: parcel.geometry, signal, request }),
    queryFemaNfhl({ layerId: 28, geometry: parcel.geometry, signal, request }),
    queryIndianaBafl(parcel.geometry, { signal, request }),
    queryUsgsElevation(centroid, { signal, request }),
  ]);
  let openFemaCommunity = null;
  if (includeOpenFemaCommunity) {
    openFemaCommunity = await queryOpenFema('NfipCommunityStatusBook', { filter: "state eq 'IN'", top: 1000, signal, request });
  }
  return Object.freeze({
    chainVersion: 'posey-parcel-spatial-chain@1.0.0',
    parcel,
    centroid: { longitude: centroid[0], latitude: centroid[1], crs: 'EPSG:4326' },
    flood: { femaFirmPanels: femaPanels, femaFloodHazardZones: femaZones, indianaBestAvailable: indianaBafl },
    terrain: { usgs3depEpqs: elevation, verticalDatum: 'SOURCE_PRODUCT_NOT_INFERRED' },
    openFema: openFemaCommunity,
    engineering: { hydraulicModelStatus: 'NOT_ATTACHED', hydraulicResultStatus: 'NOT_AVAILABLE', humanReviewRequired: true },
    provenance: {
      xsoftParcelSource: parcel.sourceUri, femaPanelSource: femaPanels.sourceUri, femaZoneSource: femaZones.sourceUri,
      indianaSource: INDIANA_BAFL_MAPSERVER + '/438', usgsSource: USGS_EPQS_URL, openFemaSource: openFemaCommunity?.sourceUri ?? null,
    },
  });
}

export { polygonCentroid };
