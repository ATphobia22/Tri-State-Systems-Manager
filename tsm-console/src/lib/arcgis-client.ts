/**
 * Standardized ArcGIS REST client for TSM.
 * 
 * Replaces manual fetch() calls with typed @esri/arcgis-rest-js clients.
 * Covers all ArcGIS services used by the console:
 * - Indiana gisdata.in.gov (flood, parcels, DEM, imagery)
 * - Indiana DNR ArcGIS Online (flood hazard layers)
 * - FEMA NFHL, USGS 3DEP, USACE NLD
 */

import { request } from '@esri/arcgis-rest-request';
import { queryFeatures } from '@esri/arcgis-rest-feature-service';
import { geocode } from '@esri/arcgis-rest-geocoding';

// ---------------------------------------------------------------------------
// Service URLs
// ---------------------------------------------------------------------------

export const ARCGIS_SERVICES = {
  // Indiana gisdata.in.gov
  indianaFloodHazard: 'https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer',
  indianaParcels2025: 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0',
  indianaBuildings: 'https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer',
  indianaRoads: 'https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer',
  indianaAddressPoints: 'https://gisdata.in.gov/server/rest/services/Hosted/Address_Points_of_Indiana_Current/FeatureServer',
  poseyCSLF: 'https://gisdata.in.gov/server/rest/services/Hosted/Posey_CSLF_Feb2025/FeatureServer',
  indianaDEM: 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer',
  indianaImagery: 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer',
  
  // Indiana DNR (ArcGIS Online)
  dnrFloodHazard: 'https://gisdata.in.gov/server/rest/services/Hosted/FloodHazard_BestAvai_DNR_Water_PROD/FeatureServer/0',
  dnrFloodElevationPoints: 'https://gisdata.in.gov/server/rest/services/Hosted/FLOOD_FEPv2_PROD/FeatureServer/0',
  dnr500yrFloodplain: 'https://services.arcgis.com/tKsJAIiLjd90D5q2/ArcGIS/rest/services/500_Yr_Floodplain_updated/FeatureServer',
  
  // Federal
  femaNFHL: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
  usgs3DEP: 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
  usaceNLD: 'https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer',
} as const;

// ---------------------------------------------------------------------------
// Typed query helpers
// ---------------------------------------------------------------------------

export interface ArcGISQueryOptions {
  where?: string;
  outFields?: string[];
  returnGeometry?: boolean;
  resultRecordCount?: number;
  geometry?: string; // envelope JSON
  inSR?: number;
  outSR?: number;
}

/**
 * Query a FeatureServer layer with typed parameters.
 */
export async function queryFeatureLayer(
  url: string,
  options: ArcGISQueryOptions = {}
) {
  const queryParams: any = {
    url,
    where: options.where || '1=1',
    outFields: options.outFields || ['*'],
    returnGeometry: options.returnGeometry ?? true,
    resultRecordCount: options.resultRecordCount || 1000,
  };
  if (options.geometry) queryParams.geometry = options.geometry;
  if (options.inSR) queryParams.inSR = options.inSR;
  if (options.outSR) queryParams.outSR = options.outSR;
  return queryFeatures(queryParams);
}

/**
 * Query Indiana parcels by APN.
 */
export async function queryParcelByAPN(apn: string) {
  return queryFeatureLayer(ARCGIS_SERVICES.indianaParcels2025, {
    where: `APN = '${apn}'`,
    outFields: ['*'],
  });
}

/**
 * Query flood hazard at a point (longitude, latitude).
 */
export async function queryFloodHazardAtPoint(lon: number, lat: number) {
  const point = JSON.stringify({
    x: lon,
    y: lat,
    spatialReference: { wkid: 4326 },
  });
  return queryFeatureLayer(ARCGIS_SERVICES.dnrFloodHazard, {
    geometry: point,
    inSR: 4326,
    outSR: 4326,
  });
}

/**
 * Geocode an Indiana address.
 */
export async function geocodeIndianaAddress(address: string) {
  return geocode({
    address,
    countryCode: 'USA',
  });
}

// ---------------------------------------------------------------------------
// Tri-state county GEOIDs
// ---------------------------------------------------------------------------

export const TRI_STATE_COUNTIES = {
  '18129': 'Posey, IN',
  '18163': 'Vanderburgh, IN',
  '18051': 'Gibson, IN',
  '18173': 'Warrick, IN',
  '17059': 'Gallatin, IL',
  '17193': 'White, IL',
  '21101': 'Henderson, KY',
  '21225': 'Union, KY',
} as const;
