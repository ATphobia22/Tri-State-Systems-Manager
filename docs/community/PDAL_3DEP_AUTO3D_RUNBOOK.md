# PDAL 3DEP → Auto-3D LoD1/2

**EPT project:** `USGS_LPC_IN_WT_B12_Posey_2013_LAS_2016` (HTTP 200)
**URL:** `https://s3-us-west-2.amazonaws.com/usgs-lidar-public/USGS_LPC_IN_WT_B12_Posey_2013_LAS_2016/ept.json`
**Bounds (3857):** `([-9791000,-9779000],[4562000,4577000])`

```bash
pdal pipeline scripts/geospatial/pdal_3dep_clip.json   # → posey_ground_1m.tif EPSG:26916
pdal pipeline scripts/geospatial/pdal_3dep_dsm.json    # → posey_dsm_1m.tif
bash auto-3d-city-builder/pipeline/lod12_from_dem.sh
```

Auto-3D: docker 3DCityDB · import_citygml.sh · build_3dtiles.sh · viewer · lod_policy.ts
LoD3 openings need MLS/IFC — not this airborne path.
