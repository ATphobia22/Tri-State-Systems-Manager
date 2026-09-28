#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${TSM_DATA_OUT:-${ROOT}/.data/public}"
MANIFEST="${OUT}/tri-state-acquisition-manifest.json"
mkdir -p "${OUT}"

TNM_BBOX="${TSM_TNM_BBOX:--89.0,37.4,-87.0,38.6}"
TNM_API="https://tnmaccess.nationalmap.gov/api/v1/products?bbox=${TNM_BBOX}&prodFormats=LAZ,GeoTIFF"

cat > "${MANIFEST}" <<JSON
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "aoi": {"bbox_wgs84": "${TNM_BBOX}", "note": "Replace with HUC/river-reach AOI for production acquisition."},
  "sources": [
    {"id":"USGS-3DEP","url":"${TNM_API}","method":"TNM Access API"},
    {"id":"USGS-NHDPLUS-HR","url":"https://www.usgs.gov/national-hydrography/nhdplus-high-resolution","method":"official download"},
    {"id":"FEMA-NFHL","url":"https://hazards.fema.gov/arcgis/rest/services/FIRMette/NFHLREST_FIRMette/MapServer","method":"ArcGIS REST"},
    {"id":"USACE-NLD","url":"https://levees.sec.usace.army.mil/","method":"official portal"},
    {"id":"USDA-SSURGO","url":"https://sdmdataaccess.nrcs.usda.gov/","method":"Soil Data Access"},
    {"id":"USDA-CDL","url":"https://nassgeodata.gmu.edu/CropScape/","method":"CropScape"},
    {"id":"IND-INFIP","url":"https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/","method":"official portal"}
  ]
}
JSON

if [[ "${TSM_DOWNLOAD_3DEP:-false}" == "true" ]]; then
  curl --fail --silent --show-error --location --max-time 120 "${TNM_API}" --output "${OUT}/usgs-3dep-products.json"
fi

if [[ "${TSM_DOWNLOAD_NFHL_METADATA:-false}" == "true" ]]; then
  curl --fail --silent --show-error --location --max-time 60 "https://hazards.fema.gov/arcgis/rest/services/FIRMette/NFHLREST_FIRMette/MapServer?f=pjson" --output "${OUT}/fema-nfhl-service.json"
fi

echo "Manifest: ${MANIFEST}"
