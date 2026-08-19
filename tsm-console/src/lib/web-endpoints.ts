/**
 * Master endpoint registry from PTDT v35 + Authority Registry v35
 * XSoft remains PROVISIONAL until response validated.
 */

export const WEB_ENDPOINTS = {
  usgs_nwis_iv: 'https://waterservices.usgs.gov/nwis/iv/',
  usgs_03378500:
    'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03378500&parameterCd=00065,00060',
  usgs_03322000:
    'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03322000&parameterCd=00065',
  noaa_nwps_api: 'https://api.water.noaa.gov/nwps/v1/',
  noaa_mtvi3: 'https://api.water.noaa.gov/nwps/v1/gauges/MTVI3',
  noaa_weather_points: 'https://api.weather.gov/points/37.9286,-87.8956',
  indiana_imagery:
    'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer',
  indiana_elevation: 'https://elevation.gio.in.gov/',
  indiana_elevation_s3: 's3://giselevationingov',
  indiana_elevation_s3_browser: 'https://giselevationingov.s3.amazonaws.com/index.html',
  indiana_elevation_docs: 'https://elevation.gio.in.gov/',
  ifa_flood_control: 'https://www.in.gov/ifa/srf/flood-control',
  ifa_srf_ppls: 'https://www.in.gov/ifa/srf/reports-and-ppls/',
  indiana_infip: 'https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal',
  fema_maps: 'https://fema.maps.arcgis.com/',
  xsoft_engage: 'https://engage.xsoftinc.com/posey/map/getparcellist', // PROVISIONAL
} as const;

export const ENDPOINT_STATUS: Record<keyof typeof WEB_ENDPOINTS, 'VERIFIED' | 'PROVISIONAL'> = {
  usgs_nwis_iv: 'VERIFIED',
  usgs_03378500: 'VERIFIED',
  usgs_03322000: 'VERIFIED',
  noaa_nwps_api: 'VERIFIED',
  noaa_mtvi3: 'VERIFIED',
  noaa_weather_points: 'VERIFIED',
  indiana_imagery: 'VERIFIED',
  indiana_elevation: 'VERIFIED',
  indiana_elevation_s3: 'VERIFIED',
  indiana_elevation_s3_browser: 'VERIFIED',
  indiana_elevation_docs: 'VERIFIED',
  ifa_flood_control: 'VERIFIED',
  ifa_srf_ppls: 'VERIFIED',
  indiana_infip: 'VERIFIED',
  fema_maps: 'VERIFIED',
  xsoft_engage: 'PROVISIONAL',
};
