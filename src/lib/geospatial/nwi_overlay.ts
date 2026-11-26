/** NWI overlay contract — FWS National Wetlands Inventory. Screening only, not JD. */
export const NWI_WMS = {
  baseUrl: 'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetlands/MapServer/WMSServer',
  layers: '1',
  format: 'image/png',
  transparent: true,
  version: '1.3.0',
  crs: 'EPSG:3857',
} as const;
export const NWI_DOWNLOAD = {
  portal: 'https://www.fws.gov/program/national-wetlands-inventory/data-download',
  preferredFormats: ['GeoPackage', 'FileGDB', 'Shapefile'] as const,
  classification: 'Cowardin',
};
export function defaultNwiLayer() {
  return {
    id: 'nwi-wetlands',
    name: 'NWI Wetlands (FWS)',
    opacity: 0.55,
    visible: true,
    attribution: 'Wetlands data: U.S. Fish & Wildlife Service National Wetlands Inventory',
  };
}
export function nwiIntersectionGateMessage(intersects: boolean) {
  if (!intersects) return { severity: 'info' as const, code: 'NWI_NO_HIT', message: 'No NWI screening hit' };
  return {
    severity: 'warn' as const,
    code: 'NWI_SCREENING_HIT',
    message: 'NWI wetland screening hit — obtain USACE JD before earthwork; NWI ≠ JD',
  };
}
