# PDAL EPT · Cesium ion

## readers.ept
- filename: full ept.json URL (USGS 3DEP S3)
- bounds required (3857 for usgs-lidar-public): Posey ([−9791000,−9779000],[4562000,4577000])
- threads/requests; streamable; reproject → EPSG:26916
- resolution for preview DEMs

## ion assets (ATphobia22)
| ID | Name | Status |
|----|------|--------|
| 6204792 | Mount Vernon LOD2 Compressed | 3DTILES COMPLETE |
| 6155964 | TSM Posey 3DEP Terrain | TERRAIN_COLLECTION COMPLETE |
| 6155963 | TSM Posey LOD2 Buildings | AWAITING_FILES |
| 6155967 | TSM Posey Ortho | AWAITING_FILES |

Load: Cesium3DTileset.fromIonAssetId(6204792)
Upload CityGML: launch_ion_asset_importer type=3DTILES sourceType=CITYGML → wait_for_asset
Local 3dtiler remains default; ion optional mirror.
