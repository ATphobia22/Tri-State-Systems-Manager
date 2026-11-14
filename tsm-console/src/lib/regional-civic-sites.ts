/**
 * Official public regional heritage and conservation feature services.
 * Browser queries are contextual; neither site locations nor park boundaries
 * are survey control, excavation clearance, or preservation determinations.
 */
export type CivicSiteKind = 'historic' | 'dnr' | 'preserve' | 'illinois' | 'kentucky';
export type CivicSiteInfo = {
  kind: CivicSiteKind;
  title: string;
  category: string;
  county: string;
  description: string;
  access: string;
  sourceUrl: string;
  website: string | null;
  reference: string;
};
type Properties = Record<string, unknown>;
export const REGIONAL_SITE_BOUNDS = '-89.6,36.9,-86.8,38.8';
export const REGIONAL_SITE_SOURCES = {
  historic: 'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0',
  dnr: 'https://gisdata.in.gov/server/rest/services/Hosted/Sites_StateParks/FeatureServer/8',
  preserve: 'https://gisdata.in.gov/server/rest/services/Hosted/DNRGIS_DnrNPSites_DNR_IN_1/FeatureServer/18',
  illinois: 'https://maps.dnr.illinois.gov/geoservices/rest/services/BaseLayers/MapServer/11',
  kentucky: 'https://kygisserver.ky.gov/arcgis/rest/services/WGS84WM_Services/Ky_State_Parks_Features_WGS84WM/MapServer/5',
} as const;
const fieldSets: Record<CivicSiteKind,string> = {
  historic:'RESNAME,NRIS_Refnum,ResType,County,State',
  dnr:'site,activities,website,phone,category,objectid',
  preserve:'npname,county,ownership,description,externalurl,link,objectid',
  illinois:'OBJECTID,SITE_NAME,CLASSIFICATION,REGION',
  kentucky:'OBJECTID,PUBLIC_NAM,PARK_TYPE,HYPERLINK,Phone,SOURCE',
};
export function regionalSiteQuery(kind: CivicSiteKind): string {
  const url = new URL(REGIONAL_SITE_SOURCES[kind] + '/query');
  url.searchParams.set('where','1=1');
  url.searchParams.set('geometry',REGIONAL_SITE_BOUNDS);
  url.searchParams.set('geometryType','esriGeometryEnvelope');
  url.searchParams.set('spatialRel','esriSpatialRelIntersects');
  url.searchParams.set('inSR','4326');
  url.searchParams.set('outSR','4326');
  url.searchParams.set('outFields',fieldSets[kind]);
  url.searchParams.set('returnGeometry','true');
  url.searchParams.set('resultRecordCount','1000');
  url.searchParams.set('f','geojson');
  if (kind === 'illinois') {
    // Simplify polygons for a *contextual preview* only; not source parcel boundaries.
    url.searchParams.set('maxAllowableOffset','0.003');
    url.searchParams.set('geometryPrecision','5');
  }
  return url.toString();
}
const read = (p: Properties,key: string): string => typeof p[key] === 'string' ? (p[key] as string).trim().slice(0,600) : '';
function httpsLink(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}
export function civicSiteInfo(kind: CivicSiteKind,p: Properties): CivicSiteInfo {
  const sourceUrl = REGIONAL_SITE_SOURCES[kind];
  const title = kind === 'historic' ? read(p,'RESNAME') : kind === 'dnr' ? read(p,'site')
    : kind === 'preserve' ? read(p,'npname') : kind === 'illinois' ? read(p,'SITE_NAME') : read(p,'PUBLIC_NAM');
  const website = kind === 'dnr' ? httpsLink(read(p,'website')) : kind === 'preserve'
    ? httpsLink(read(p,'externalurl')) ?? httpsLink(read(p,'link'))
    : kind === 'kentucky' ? httpsLink(read(p,'HYPERLINK')) : null;
  return {
    kind, title: title || 'Unnamed registered location',
    category: kind === 'historic' ? read(p,'ResType') || 'National Register historic place'
      : kind === 'dnr' ? read(p,'category') || 'Indiana DNR recreation site'
      : kind === 'preserve' ? 'Indiana nature preserve'
      : kind === 'illinois' ? read(p,'CLASSIFICATION') || 'Illinois DNR managed land'
      : read(p,'PARK_TYPE') || 'Kentucky State Park',
    county: kind === 'historic' ? read(p,'County') : kind === 'preserve' ? read(p,'county') : '',
    description: kind === 'dnr' ? read(p,'activities') : kind === 'preserve' ? read(p,'description') : '',
    access: kind === 'historic' ? 'Register status does not imply public access.'
      : 'Check current site-specific visiting rules and ownership before entering.',
    sourceUrl, website,
    reference: kind === 'historic' ? read(p,'NRIS_Refnum') : String(p.objectid ?? p.OBJECTID ?? ''),
  };
}
