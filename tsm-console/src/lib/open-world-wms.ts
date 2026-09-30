export function buildArcGisWmsTileTemplate(serviceUrl: string, layer = '0'): string {
  const base = serviceUrl.replace(/\/$/, '');
  return `${base}/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${encodeURIComponent(layer)}&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&WIDTH=512&HEIGHT=512&BBOX={bbox-epsg-3857}`;
}

/**
 * ArcGIS ImageServer exportImage tile template. ImageServer services do not
 * reliably expose a WMSServer endpoint (verified 2026-09-30: Indiana Current
 * Imagery returns 404 "Invalid URL" for /WMSServer) — exportImage is the
 * canonical raster tile access for ImageServer and is verified live.
 *
 * An optional server-side rendering rule (e.g. USGS 3DEP "Hillshade Gray",
 * verified live 2026-09-30 against the service's rasterFunctionInfos) keeps
 * dynamic visualization on the server — no client-side elevation math.
 */
export function buildArcGisImageServerExportTemplate(serviceUrl: string, renderingRule?: string): string {
  const base = serviceUrl.replace(/\/$/, '');
  const rule = renderingRule ? `&renderingRule=${encodeURIComponent(renderingRule)}` : '';
  return `${base}/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=png32&transparent=true${rule}&f=image`;
}

/** USGS 3DEP server-side hillshade — official rendering rule on the 3DEPElevation ImageServer (azimuth 315°, altitude 45°). */
export const USGS_3DEP_HILLSHADE_RENDERING_RULE = '{"rasterFunction":"Hillshade Gray"}';

export const INDIANA_CURRENT_IMAGERY_WMS =
  'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer';

export const USGS_3DEP_ELEVATION_WMS =
  'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer';
