/**
 * CountyGISMaps.com Posey County reference source.
 *
 * This is a secondary, non-government GIS visualization/data source.
 * It must never be promoted to authoritative deed, survey, FEMA, or
 * county-assessor evidence merely because it depicts a parcel.
 */

export const POSEY_COUNTY_GISMAPS_URL = 'https://countygismaps.com/map/in/posey';
export const POSEY_COUNTY_GISMAPS_OVERVIEW_URL = 'https://countygismaps.com/in/posey';

export interface CountyGISMapsSourceManifest {
  sourceId: 'POSEY_COUNTYGISMAPS';
  authorityClass: 'SECONDARY_DATA_SERVICE';
  jurisdiction: 'Posey County, Indiana';
  mapUrl: string;
  overviewUrl: string;
  parcelGeometryAuthority: 'UNVERIFIED';
  propertyRecordAuthority: 'NONE';
  elevationCertificationAuthority: 'NONE';
}

export function sourceManifest(): CountyGISMapsSourceManifest {
  return {
    sourceId: 'POSEY_COUNTYGISMAPS',
    authorityClass: 'SECONDARY_DATA_SERVICE',
    jurisdiction: 'Posey County, Indiana',
    mapUrl: POSEY_COUNTY_GISMAPS_URL,
    overviewUrl: POSEY_COUNTY_GISMAPS_OVERVIEW_URL,
    parcelGeometryAuthority: 'UNVERIFIED',
    propertyRecordAuthority: 'NONE',
    elevationCertificationAuthority: 'NONE',
  };
}
