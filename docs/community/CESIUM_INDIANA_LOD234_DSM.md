# Cesium · Indiana GIS · PDAL DSM · CityGML LoD2–4

## Indiana
- https://www.in.gov/gis/ — Data Harvest, imagery program (Posey in leaf-on releases)
- IndianaMap · IGWS · FEMA NFHL screening · NOAA/USACE public river stages
- Mt Vernon ≈ -87.895, 37.930

## Cesium
- Sandcastle photogrammetry classification: ClassificationType.CESIUM_3D_TILE
- Cesium3DTileset.fromUrl / fromIonAssetId; ion optional vs local 3dtiler

## PDAL DSM
ReturnNumber[1:1] + writers.gdal output_type max → posey_dsm_1m.tif EPSG:26916
DEM: Classification[2:2] idw · Buildings: Classification[6:6]

## LoD
- LoD2: roof shapes + boundary surfaces (airborne OK)
- LoD3: openings/installations (MLS/IFC)
- LoD4 indoor: private; publicAllowsIndoor=false
