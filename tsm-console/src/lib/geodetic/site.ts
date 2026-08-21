import { SITE } from '../../types/site';
import { AUTHORITATIVE_VERTICAL } from './constants';

export function siteSpatialReference() {
  return {
    horizontal_crs: `EPSG:${SITE.crs.horizontalEpsg}`,
    horizontal_crs_name: SITE.crs.horizontalName,
    units: 'US survey feet',
  };
}

export function siteVerticalReference() {
  return {
    vertical_datum: SITE.crs.verticalDatum,
    units: 'ft',
  };
}

export function siteVerticalBoundary() {
  return {
    vertical_datum: AUTHORITATIVE_VERTICAL,
    bfe_ft: SITE.elevations.bfe_ft,
    lag_ft: SITE.elevations.lag_ft,
    ffe_ft: SITE.elevations.ffe_ft,
    berm_crest_ft: SITE.elevations.bermCrest_ft,
    immutable: true as const,
  };
}

export function siteCenterWgs84(): [number, number] {
  const { minLon, maxLon, minLat, maxLat } = SITE.boundingEnvelope;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}
