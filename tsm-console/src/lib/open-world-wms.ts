export function buildArcGisWmsTileTemplate(serviceUrl: string, layer = '0'): string {
  const base = serviceUrl.replace(/\/$/, '');
  return `${base}/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${encodeURIComponent(layer)}&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&WIDTH=512&HEIGHT=512&BBOX={bbox-epsg-3857}`;
}

export const INDIANA_CURRENT_IMAGERY_WMS =
  'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer';

export const USGS_3DEP_ELEVATION_WMS =
  'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer';
